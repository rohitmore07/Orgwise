# orgwise — Phase 3 Production-Readiness Audit

_Principal review before product launch. Written after a full pass over the
codebase: authentication, authorization, RBAC, CSV pipeline, database,
analytics, API quality, frontend UX, testing, and documentation._

---

## 1. Audit summary

### Critical issues (fixed)

| #   | Issue                                                                                                                                                                                                                                                                                                                                                                                                                    | Fix                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Authentication was broken end-to-end.** The API validated sessions with `Authorization: Bearer <token>`, but Neon Auth's managed server only honors the signed `__Secure-neon-auth.session_token` **cookie** (proven by direct HTTP probing of `get-session` with every token form). Every authenticated API call returned 401 — a signed-in user saw an empty shell.                                                  | `SessionGuard` now reads the session cookie and forwards it to Neon `get-session` (the exact request pattern the SDK's own proxy uses); the web client sends `credentials: 'include'`. A Bearer fallback keeps API clients working. |
| C2  | **DTO validation was silently disabled.** Every DTO was imported as `import { type X }` in controllers. TypeScript erases type-only imports, so `design:paramtypes` degraded to `Function`; the global `ValidationPipe` had no class to validate against. Query defaults never applied (the employees list 500'd on `orderBy: { undefined }`), every query param was whitelist-rejected, and body DTOs were unvalidated. | Controllers now import DTOs as **value imports** (6 controllers, 9 imports), with a guard comment and a metadata regression test (`controller-dto-metadata.spec.ts`) that fails the build if the pattern returns.                   |

### High-priority issues (fixed)

- **New-user experience** — a fresh account landed on a bare dashboard. Added a
  role-aware welcome card, an empty-org guidance state, and a profile-error
  retry block; stale sessions now bounce cleanly to `/signin`.
- **OAuth callback routing** — callbacks landing on `/` never established the
  session (the verifier was consumed only by the workspace's `AuthProvider`).
  Added a landing-page session sync + redirect, and middleware now preserves the
  verifier on redirects.
- **Admin bootstrapping** — only the very first account became admin; there was
  no durable way to grant a specific identity admin across reseeds. Added the
  `ADMIN_EMAILS` env mechanism (provision + re-promote on every sign-in) with 8
  tests, documented in README/env examples.
- **Soft-delete restore** — records could be deleted but never brought back.
  Added `PATCH /employees/:id/restore` with an audited `restore` action and a
  conflict guard when the identifiers were reused meanwhile.
- **Audit log viewer** — added the admin audit-log page with 30s auto-refresh
  and employee entities linked to their profile pages.

### Medium-priority items (addressed)

- SSR/client hydration mismatches (portal rendering) — fixed.
- Locale-dependent number/date formatting — centralized in `lib/format.ts`
  with a fixed `en-US` locale.
- Landing header showed "Sign In" to signed-in users — now swaps to
  "Open dashboard".
- Logout was hidden in a menu — a persistent **Sign out** button now sits in
  the sidebar footer for every role.

### Nice-to-have / deferred

- Email verification flow polish (vendor-side; handled gracefully with a
  friendly message).
- Advanced charts beyond the MVP set (deliberately out of scope).
- A `createMany` fast path for very large imports (per-row inserts are
  intentional for exact reporting; fine up to the 10 MB cap).

## 2. Verification performed

- **Tests:** 70 API unit tests (Jest) + 22 frontend tests (Vitest) — RBAC,
  resource-level scoping, employee CRUD/restore, dashboard scoping, the full
  CSV pipeline, Neon session validation, bootstrap-admin provisioning, DTO
  metadata, formatting, auth form.
- **Typecheck & lint:** clean across both apps.
- **End-to-end (HTTP):** sign-up through the web proxy → session cookie →
  protected endpoints (`/users/me`, `/dashboard/overview`, `/employees`,
  `/departments`) all return 200; invalid cookies return 401; viewers get 403
  on writes and admin routes; invalid query params return 400 with details;
  Swagger documents every parameter.
- **Auth round-trip:** the Neon `get-session` validation path was verified
  against the live Neon server with real signed cookies.

## 3. Definition-of-Done check

| Requirement                                                                  | Status      |
| ---------------------------------------------------------------------------- | ----------- |
| Neon Auth integration correct · no duplicate auth                            | ✅          |
| Authentication state handled · stale sessions bounce                         | ✅          |
| Backend authorization · RBAC · resource-level checks                         | ✅          |
| Employee data protected (scoped reads/writes for managers)                   | ✅          |
| CSV import robust (file type/size, malformed, per-row errors, transaction)   | ✅ + tests  |
| Analytics calculations verified · no invented metrics                        | ✅          |
| Dashboard polished · filters coherent · charts answer questions              | ✅          |
| APIs documented (Swagger) · consistent envelope · correct status codes       | ✅          |
| Errors handled (401/403/400/404/409/500) · no stack traces leaked            | ✅          |
| Loading / empty / error states across async screens                          | ✅          |
| Responsive UI · accessibility basics                                         | ✅          |
| Important business logic tested                                              | ✅ 92 tests |
| Audit logs (create/update/delete/restore/import/role)                        | ✅          |
| Health endpoint + DB probe · request correlation ids                         | ✅          |
| README professional · architecture docs                                      | ✅          |
| Demo data (42 employees, 10 departments, 8 teams)                            | ✅          |
| Deployment readiness (env contract, CORS allowlist, trust proxy, migrations) | ✅          |

---

## 4. Hiring-manager review

### What looks impressive

1. **The CSV import pipeline.** Row-level error reports, within-file _and_
   database duplicate detection, transactional inserts, and a history feed —
   this is genuinely product-grade, not an assessment throwaway.
2. **RBAC done properly.** Roles are enforced in the service layer, managers
   are resource-scoped (department-level), and the backend never trusts the
   frontend. The audit log makes every state change traceable.
3. **The session architecture.** Cookie-based validation against Neon's
   `get-session`, marker cookie for UX guards only, and a clear auth-vs-authz
   split — this is how a real team would integrate a managed IdP.
4. **The landing page + dashboard polish.** KPI hierarchy, slice filters that
   update everything at once, empty/error/loading states, and a coherent
   visual system read like a funded product.
5. **Engineering hygiene.** 92 tests, strict TypeScript, enforced DTO
   contracts, Swagger, CI, commit-lint, and documentation that describes the
   actual implementation.

### What still looks like an assessment project

1. **Demo accounts.** Reviewers must sign in with their own Google/GitHub and
   be promoted — a friction point the assessment would prefer to remove
   (documented demo accounts are a deliberate trade-off against shipping fake
   credentials in the app).
2. **Analytics breadth.** The dashboard is strong but deliberately narrow —
   no attrition/retention/cost analytics. The PRD mentions workforce
   intelligence; the dataset limits what can honestly be shown.
3. **No production test coverage of the frontend at scale** — the Vitest
   suite is meaningful but small (22 tests).

### What could cause a reviewer to reject it

1. **Auth setup friction** — Neon Auth requires a Neon project, `ADMIN_EMAILS`
   configuration, and toggling email-verification for instant sign-in. If the
   setup docs aren't followed, the reviewer can't even log in.
2. **Any regression of the two critical bugs** (session validation, DTO
   metadata) — now guarded by tests, but worth re-verifying on a fresh clone.
3. **Slow first-load if the API is down** — error states exist, but a dead API
   makes the whole demo look broken rather than degraded.

### Top 5 improvements with the highest recruiter impact

1. **Documented demo accounts** (admin/manager/viewer) so a reviewer is inside
   the product in under a minute — removes the #1 friction point.
2. **A Loom-style walkthrough** in the README (the assessment explicitly asks
   for one) walking through login → dashboard → import → RBAC.
3. **Show the analytics depth the dataset allows** (tenure bands, department
   averages, gender composition per department) without inventing metrics.
4. **A polished "getting started" in-product onboarding** for the first admin
   (import CSV → create departments → invite users).
5. **Recorded demo data migration** so a fresh clone has identical analytics —
   reproducible numbers make the walkthrough scriptable.

---

_Prepared at the end of Phase 3. Phase 4 (AI assistant, predictive analytics,
workforce insights) is intentionally out of scope for this review._
