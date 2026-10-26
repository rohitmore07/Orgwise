# Security & RBAC Audit Report

Conducted as an end-to-end AuthN/RBAC audit + bug-fix sprint on the orgwise
API (NestJS + Prisma) and web app (Next.js App Router).

Scope: authentication, authorization, RBAC scope enforcement, IDOR/BOLA,
input validation, secrets in client state, and route protection.

---

## Findings & fixes

### 🔴 CRITICAL — Type-only imports silently disabled DI _and_ DTO validation

Every controller and service imported its injected classes and DTOs with
`import { type X }`. With `emitDecoratorMetadata`, TypeScript erases those
bindings from a **fresh** build, so:

- `design:paramtypes` for every controller constructor degraded to
  `[Function]` → **Nest cannot resolve dependencies** → the freshly built API
  fails to boot (`Nest can't resolve dependencies of the PrismaService`).
- `design:paramtypes` for `@Body()` / `@Query()` parameters degraded to
  `Object`/`Function` → **the global ValidationPipe silently skipped
  validation** (no whitelist, no DTO defaults, no bounds) for employees,
  departments, teams, users, imports, audit and dashboard endpoints.

The regression was invisible because the running server was serving a stale
`dist` (built before the imports were changed to type-only). The regression
guards (`src/common/tests/controller-dto-metadata.spec.ts` and
`signals.controller.spec.ts`) failed on a fresh check — 7 failing tests.

**Fix** (`apps/api/src/**`): converted every DI'd class and DTO import back to
a value import across all 8 controllers, all 7 services, both guards,
`NeonAuthService`, `RbacService`, `AppService`, and `PrismaService`. Only
genuinely type-only bindings remain type-only (`Observable`, `Request`,
`Role` casts, `ParsedRow`).

**Verified**: fresh `pnpm build` now emits
`[Object, create_employee_dto_1.CreateEmployeeDto, Object]`,
`[signals_service_1.SignalsService]`, `[config_1.ConfigService]`; the API
boots from fresh `dist`; `GET /employees?pageSize=1000` now returns
`400 "pageSize must not be greater than 100"` (was silently accepted).

---

### 🟠 HIGH — Cross-scope data exposure (IDOR/BOLA)

| #   | Endpoint                                                  | Issue                                                                                                                                                                                                                                                                     | Fix                                                                                                                                                          |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `GET /api/v1/imports` · `GET /api/v1/imports/:id`         | Any authenticated role could enumerate **all** org-wide import history — filenames, counts, and per-row error reports containing employee emails/codes from other departments.                                                                                            | Non-admins see only imports they performed (`importedByUserId = actor.sub`); admins see all. Out-of-scope ids → 404 (opaque).                                |
| 2   | `GET /api/v1/teams` · `GET /api/v1/teams/:id`             | Managers could list/read teams in any department (names, leads, headcounts).                                                                                                                                                                                              | Manager scope is authoritative: list intersects `departmentId ∈ scope`; an out-of-scope `departmentId` filter matches nothing; `findOne` 404s out of scope.  |
| 3   | `GET /api/v1/departments` · `GET /api/v1/departments/:id` | Managers could read the full org chart (names, hierarchy, manager accounts/emails, headcounts).                                                                                                                                                                           | List scoped to `id ∈ scope` for managers; `findOne` 404s out of scope. Viewers keep read-only access to everything (documented product rule).                |
| 4   | `GET /api/v1/employees?departmentId=`                     | **Pre-existing IDOR found during review**: `findAll` spread the scope constraint first, then the user-supplied `departmentId` — duplicate object keys made the filter **overwrite** the scope, so a manager could read another department's employees by guessing its id. | Applied the same authoritative-intersect pattern as the dashboard/teams services: an in-scope id narrows, an out-of-scope id matches nothing (`{ in: [] }`). |

Files: `apps/api/src/imports/imports.service.ts`, `apps/api/src/teams/teams.service.ts`,
`apps/api/src/departments/departments.service.ts`, `apps/api/src/departments/departments.controller.ts`,
`apps/api/src/employees/employees.service.ts`.

---

### 🟡 MEDIUM

1. **Viewers could read soft-deleted employees.** `findAll` honored
   `includeDeleted=true` for every role and `findOne` returned deleted records
   to everyone — letting a viewer enumerate terminated profiles.
   **Fix** (`employees.service.ts`): `includeDeleted` is honored only for
   writers (admin/manager); viewers requesting a deleted record get a 404.

2. **Session token persisted in localStorage.** `setStoredSession` wrote the
   raw Better Auth session token to `localStorage`, making it XSS-exfiltratable
   and persistent across pages.
   **Fix** (`apps/web/src/lib/auth.ts`): the token now lives only in module
   memory for the current page load. Reloads authenticate via the HttpOnly
   `__Secure-neon-auth.*` cookie (`credentials: 'include'`), which the API
   already validates. `localStorage` holds only the non-sensitive marker
   (id/email/role/expiry).

---

### 🟢 LOW

- **Manager referencing an out-of-scope manager employee** in create/update
  leaked employee existence by id through the `managerId` field.
  **Fix** (`employees.service.ts` `validateReferences`): managers may only
  reference manager employees inside their scope; admin actors are unrestricted.

---

## Verified — not issues

- **Null / empty scopes**: `RbacService.departmentScope` returns `[]` (not
  `null`) for a manager with no departments; services gate on `scope ? { in: scope } : {}`
  and `[]` is truthy, so an empty scope matches **zero** rows — never full
  access. Regression-tested.
- **DTO validation active in fresh builds** (see Critical above) — protected by
  `controller-dto-metadata.spec.ts`.
- **401/403 semantics**: missing/invalid session → 401; authenticated but not
  allowed → 403; out-of-scope resource ids → 404 (opaque). Verified live.
- **Global exception filter** never leaks stack traces (generic 500 message;
  stack logged server-side only).
- **CORS** is an explicit origin allowlist with `credentials: true` — never a
  wildcard.
- **Cookies**: session cookie uses the `__Secure-` prefix (Secure); the
  client-side marker cookie is `SameSite=Lax`; the real session cookie is
  HttpOnly and set by Neon Auth. CSRF risk is mitigated by SameSite on
  cross-site mutations.
- **Audit logs** store only operational details (actor, action, entity,
  timestamp, ip) — never passwords, tokens, or secrets.
- **`/signals/live`** is public by design and returns static, non-PII
  marketing data (no DB, no employee data).
- **Role-change guards**: self-demotion blocked; last-active-admin demotion
  blocked (documented count+update race, MVP-acceptable).
- **First-account-becomes-admin** bootstrap is a deliberate warm-start tradeoff;
  `ADMIN_EMAILS` env is the durable admin grant.
- **Session revocation** is bounded by the 60s in-memory cache TTL — documented.

---

## Tests added / strengthened (Jest)

- `rbac.service.spec.ts` — empty-scope semantics (manager with no departments
  → `[]` = zero access).
- `departments.service.spec.ts` (new) — manager list scope, empty-scope → zero,
  `findOne` 404 out of scope, admin unrestricted, mutation guard.
- `teams.service.spec.ts` (new) — manager list scope, department-filter
  intersect, out-of-scope filter → `{ in: [] }`, `findOne` 404, empty scope.
- `imports.service.spec.ts` — history reads: admin sees all, managers scoped to
  own, cross-user `findOne` → 404, unknown id → 404.
- `employees.service.spec.ts` — viewer `includeDeleted` forced off, viewer
  `findOne` on deleted → 404, manager out-of-scope `managerId` rejected,
  in-scope reference allowed, **manager `departmentId` filter can never widen
  scope** (out-of-scope id → `{ in: [] }`, empty scope → zero results).

**Result: 101 API tests + 22 web tests pass · typecheck ✓ · lint ✓ ·
API + web production builds ✓ · API boots from a fresh `dist` ✓ · live probes
confirm 401/403/400 validation semantics**
