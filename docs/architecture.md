# orgwise — Architecture

This document describes the _implemented_ system, not just the intent.
Engineers should read this before changing cross-cutting behavior.

---

## 1. System overview

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│          apps/web           │        │        Neon Auth             │
│   Next.js 15 · App Router   │        │  Managed Better Auth         │
│                             │        │  (identity provider)         │
│  sign-in/sign-up · OAuth    │───────▶│  email/password · Google/Git │
│  session marker (cookie)    │        └──────────────────────────────┘
└──────────────┬──────────────┘
               │  Authorization: Bearer <neon-session-token>
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         apps/api  (NestJS 11, /api/v1)                       │
│                                                                             │
│  Global guards (ordered):                                                    │
│   1. ThrottlerGuard   — per-user (auth) / per-IP (anonymous) rate limits    │
│   2. SessionGuard     — validates token against Neon Auth `get-session`     │
│   3. RolesGuard       — @Roles(admin|manager|viewer) metadata               │
│                                                                             │
│  Controllers → Services → RbacService (department scoping) → PrismaService │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        ▼
                            PostgreSQL (Prisma ORM)
                            User · Department · Team · Employee ·
                            ImportHistory · AuditLog
```

Two request paths share one client:

- **Web → Neon Auth** — authentication. The web app owns sign-in/sign-up
  (email/password + Google/GitHub). Neon issues the session (HTTP-only cookies
  set via the `/api/auth` proxy) and the web app mirrors a _marker_ (identity +
  expiry + role) into `localStorage` + a plain cookie so the edge middleware can
  do UX redirects without hitting the auth server.
- **Web → API** — authorization. The browser sends its HttpOnly
  `__Secure-neon-auth.session_token` cookie with every request
  (`credentials: 'include'`); the API forwards that cookie to Neon's
  `get-session` endpoint — the same request pattern the Neon SDK's own proxy
  uses, which is the only form Neon's managed server accepts. A
  `Authorization: Bearer <session-value>` fallback keeps non-browser API
  clients working. The validated identity is mapped to a local `User` row and
  the platform role is resolved. **The backend never trusts anything the
  frontend claims about the user.**

## 2. Authentication vs authorization

| Concern             | Owner          | Mechanism                                            |
| ------------------- | -------------- | ---------------------------------------------------- |
| _Who is the user?_  | Neon Auth      | Session token validated server-side on every request |
| _What may they do?_ | orgwise API | `User.role` + `RbacService` scope rules              |

No passwords, tokens, or authentication secrets are stored in the orgwise
database. The local `User` row holds only application data: email (join key),
display name, role, and status.

**Identity mapping** (first-contact provisioning):

```
Neon Auth user ──(validated session)──▶ find local User by email
                                          ├─ exists → use its role/status
                                          └─ missing → create (first account
                                             becomes admin; later sign-ups
                                             become viewers) and proceed
```

## 3. RBAC model

Three roles, enforced at the **service layer** (never by hidden buttons):

| Role        | Write access                        | Scope                                                       |
| ----------- | ----------------------------------- | ----------------------------------------------------------- |
| **admin**   | Everything                          | Whole organization                                          |
| **manager** | Create/update/delete/import/restore | Only departments where `Department.managerUserId = user.id` |
| **viewer**  | None                                | Read-only everywhere                                        |

`RbacService` is the single decision point:

- `assertCanWrite(user, departmentId?)` — rejects viewers, and rejects managers
  operating outside their assigned departments.
- `departmentScope(user)` — the department ids a manager may see; `null` for
  admins/viewers (no scoping).
- `isDepartmentInScope(user, departmentId)` — used for single-record checks.

**Resource-level authorization** — role checks are never the end of the story.
`EmployeesService.findOne`/`update`/`remove`/`restore` verify the _specific
record_ is inside the manager's scope. The dashboard and list endpoints apply
the scope to the query's `where` clause. The CSV import rejects rows whose
department is outside the importer's scope.

## 4. Request pipeline

```
middleware (Express)
  request-id      → X-Request-Id header + req.id (correlation)
  request-logger  → one line per request: [id] METHOD path → status (ms)
global pipes
  ValidationPipe  → whitelist + forbidNonWhitelisted + transform
guards (APP_GUARD, in order)
  Throttler → Session → Roles
interceptors
  ResponseInterceptor → { success, message, data, timestamp }
  GlobalExceptionFilter → { success:false, statusCode, message, error,
                            path, requestId?, details? }
```

Error semantics: `401` = missing/invalid/expired session; `403` = authenticated
but not permitted; `422`-style messages from DTO validation arrive as `400`
with a `details` array. Stack traces are logged server-side and never returned.

## 5. CSV import pipeline

```
upload (≤10 MB, .csv)
   │
   ▼
CsvService.parse        — structural: header presence, non-empty, parseable
   │                      (fail-fast, whole-file)
   ▼
row validation          — required fields, email format, enum membership,
   │                      date parseability (per-row, collected not fatal)
   ▼
resolveReferences       — department / team by name, manager by email;
                          manager scope is enforced here
   ▼
detectDuplicates        — within file + against database (incl. soft-deleted)
   │
   ▼
$transaction            — sequential inserts of insertable rows only
   │
   ▼
ImportHistory row       — status (completed | partial | failed) + per-row
                          error report (row number, code/email, messages)
   │
   ▼
audit record            — action 'import', entity 'import'
```

A single bad row never blocks a good file, and a good file never partially
corrupts state: only rows passing all three stages (validation, references,
duplicates) are inserted, inside one transaction. Import history is retained
for replay and audit.

## 6. Data model highlights

- **`Employee`** — `deletedAt` soft delete keeps history/audit/dashboards
  intact; `employeeCode`/`email` unique globally (so deleted rows still occupy
  their identifiers — the API checks this explicitly). Indexed on
  `departmentId`, `teamId`, `managerId`, `status`, `hiredAt`, `deletedAt`,
  and `(firstName, lastName)`.
- **`Department`** — self-referencing hierarchy (`parentId`), assigned manager
  (`managerUserId` → RBAC scope), unique on `(name, deletedAt)`.
- **`Team`** — belongs to a department (cascade delete), unique on
  `(name, departmentId, deletedAt)`.
- **`AuditLog`** — actor, action, entity type/id, JSON details, IP, timestamp;
  indexed for the filterable feed. Writes are best-effort (never fail the
  primary operation).
- **`ImportHistory`** — outcome of every CSV import incl. the error report.

### Index review (why each index exists)

Every index maps to a real query pattern in the code — none are speculative:

| Index                                                                            | Serves                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Employee(departmentId)`                                                         | The hottest filter: the employees list, dashboard distribution, manager department scoping, and CSV reference resolution all filter by department                                                                           |
| `Employee(teamId)`                                                               | Employee list `?teamId=` filter and team→employees lookups                                                                                                                                                                  |
| `Employee(managerId)`                                                            | Reporting-line navigation (`manager` / `reports` self-relation) and `managerId` assignment checks                                                                                                                           |
| `Employee(status)`                                                               | List `?status=` filter and the dashboard status distribution                                                                                                                                                                |
| `Employee(hiredAt)`                                                              | The "recent hires" list (ordered by hire date)                                                                                                                                                                              |
| `Employee(deletedAt)`                                                            | Soft-deleted records are excluded on every list/read (`deletedAt: null`); a partial index would be ideal but Prisma's global-unique design keeps the simple column index                                                    |
| `Employee(firstName, lastName)`                                                  | Name-prefix lookups and the employee table's common ordering patterns; the free-text `contains` search is a `%term%` scan a B-tree cannot accelerate (acceptable at this scale — a trigram index would be the upgrade path) |
| `Employee(employeeCode)`, `Employee(email)`                                      | Unique constraints — also the duplicate-detection lookups in CSV import                                                                                                                                                     |
| `Department(parentId)`                                                           | Org-hierarchy traversal (children of a parent)                                                                                                                                                                              |
| `Department(managerUserId)`                                                      | RBAC scope lookup: which departments a manager is assigned to                                                                                                                                                               |
| `Department(deletedAt)`                                                          | Excluding soft-deleted departments on list/import reference resolution                                                                                                                                                      |
| `Team(departmentId)`                                                             | Teams-by-department list and import team resolution                                                                                                                                                                         |
| `Team(deletedAt)`                                                                | Excluding soft-deleted teams                                                                                                                                                                                                |
| `ImportHistory(importedByUserId)`, `ImportHistory(createdAt)`                    | Import history feed (ordered by created, filtered by importer)                                                                                                                                                              |
| `AuditLog(entityType, entityId)`, `AuditLog(actorUserId)`, `AuditLog(createdAt)` | The audit feed's filters and sort                                                                                                                                                                                           |
| `User(role)`, `User(email)`                                                      | Role listing (`/users`) and identity lookup by email (join key with Neon)                                                                                                                                                   |

Unique constraints doubled as indexes: `Employee.employeeCode`, `Employee.email`,
`Employee.userId`, `Department(name, deletedAt)`, `Team(name, departmentId,
deletedAt)`.

**Query hygiene** — list endpoints use `include` with narrow `select`s (only
fields the view needs), the dashboard aggregates in SQL, and import reference
lookups batch by `IN` clauses instead of per-row queries. The only N+1-shaped
spot (per-row `employee.create` inside the import transaction) is deliberate:
it produces exact per-row outcomes and stays transactional.

## 7. Observability

- `GET /api/v1/health` — liveness + `db: up|down` probe (`SELECT 1`); the
  status degrades to `degraded` when Postgres is unreachable. Public and
  exempt from rate limiting.
- Request logging with correlation ids (`X-Request-Id` round-trips through
  responses and the error envelope).
- Config-gated: `REQUEST_LOGGING_ENABLED`, `TRUST_PROXY` (X-Forwarded-For),
  `SWAGGER_ENABLED` (off in production by default).

## 8. Frontend architecture

Feature-based slices under `apps/web/src`:

```
app/(app)/         protected workspace routes (grouped under the app shell)
app/signin|signup  auth pages (Neon client)
components/        app-shell · dashboard · employees · ui kit
lib/               api client · auth facade · auth-context · format utils
middleware.ts      edge route guards (UX layer; API is the security boundary)
```

The `useAsync` hook standardizes loading/error/data states per screen; skeletons
and empty states guide every fetch. The `api` client attaches the session token,
unwraps the response envelope, and retries once after a 401 session re-sync.

## 9. Decisions & trade-offs

| Decision                         | Rationale                                            | Cost                                                    |
| -------------------------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| Neon Auth as IdP                 | No bespoke password handling; focus on authorization | Vendor lock-in for identity                             |
| Marker cookie for guards         | Edge middleware can't read `localStorage`            | UX-only; must never be treated as security              |
| 60s in-memory session cache      | Avoids per-request Neon round-trips                  | Revoked tokens valid ≤60s                               |
| Soft deletes with global uniques | History + audit survive removal                      | Deleted rows keep identifiers; restore checks conflicts |
| Per-row inserts in imports       | Exact per-row outcomes, transactional                | Slower than `createMany` for huge files                 |
| No React Query yet               | `useAsync` suffices at this scale                    | Manual refetch wiring                                   |

## 10. What's next

- Reports, notifications, email service, workflow automation
- Integrations, billing, multi-tenancy, background jobs
