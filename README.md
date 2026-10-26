# orgwise

**Enterprise Workforce Intelligence Platform**

orgwise turns workforce data into strategic intelligence. HR leaders, managers, and executives use it to understand headcount, attrition, engagement, and organizational structure — with role-based access and a natural-language Copilot grounded in real data.

## Features

- **Workforce Analytics** — headcount, attrition, tenure, engagement, talent/hiring, and composition, all computed server-side
- **Workforce Insights** — deterministic, data-grounded pattern cards (correlation, never prediction)
- **Department Comparison** — head-to-head metrics with company averages
- **Global Filters** — one filter state across the dashboard, preserved in the URL for shareable views
- **Employee Explorer** — search, filter, sort, paginate, and detail views with role-gated fields
- **Organization Chart** — expandable hierarchy from manager/team relationships
- **Executive Summary** — board-ready narrative with print/PDF export
- **Data Quality & Import History** — per-row CSV validation, health score, and full import history
- **AI Workforce Copilot** — natural-language questions over your data via a controlled tool layer; the LLM never touches the database directly. Multi-provider failover (Groq / OpenRouter free models), RBAC-aware, with deep links back into the app
- **Talent / Hiring** — real time-to-hire, cost-per-hire, and offer-acceptance metrics from the hiring pipeline
- **Operations** — departments, teams, users & roles, and an audit log for every mutation
- **RBAC** — Admin / Manager / Viewer roles enforced server-side; managers are scoped to their departments

## Tech Stack

| Layer    | Technology                                                 |
| -------- | ---------------------------------------------------------- |
| Frontend | Next.js 15 · React 19 · TypeScript · Tailwind 4 · Recharts |
| Backend  | NestJS 11 · TypeScript (strict) · Prisma                   |
| Database | PostgreSQL (Neon)                                          |
| Auth     | Neon Auth (email/password + Google/GitHub)                 |
| AI       | Groq · OpenRouter                                          |
| Monorepo | pnpm workspaces · Turborepo                                |

## Getting Started

**Prerequisites:** Node.js ≥ 20.19 · pnpm ≥ 10 · a Neon project (or Docker for local Postgres)

```bash
git clone <repository-url> orgwise
cd orgwise
pnpm install
pnpm bootstrap          # copies .env.example → .env / .env.local for each app
```

Fill in `apps/api/.env` and `apps/web/.env.local`:

- `DATABASE_URL` — your Postgres connection string
- `NEON_AUTH_BASE_URL` / `NEON_AUTH_COOKIE_SECRET` — from Neon Console → Branch → Auth
- `NEXT_PUBLIC_API_URL` — default `http://localhost:3001/api/v1`
- `ADMIN_EMAILS` (optional) — emails always provisioned as Admin
- `GROQ_API_KEY` / `OPENROUTER_API_KEY` (optional) — enables the Copilot

```bash
pnpm --filter @orgwise/api prisma:migrate dev
pnpm --filter @orgwise/api prisma:seed
pnpm dev
```

| Service | URL                               |
| ------- | --------------------------------- |
| Web     | http://localhost:3000             |
| API     | http://localhost:3001/api/v1      |
| Swagger | http://localhost:3001/api/v1/docs |

## Scripts

| Command                                                     | Description                                    |
| ----------------------------------------------------------- | ---------------------------------------------- |
| `pnpm dev`                                                  | Run web + API in watch mode                    |
| `pnpm build` / `pnpm typecheck` / `pnpm lint` / `pnpm test` | Build / typecheck / lint / test all workspaces |
| `pnpm --filter @orgwise/api eval:ai`                     | Run the Copilot evaluation suite               |
| `pnpm --filter @orgwise/api deploy`                      | Package + deploy the API to AWS Lambda         |

## Project Structure

```
apps/
  web/      Next.js 15 application (landing, auth, workspace)
  api/      NestJS 11 application (analytics, imports, copilot, RBAC)
packages/   ui · types · config · eslint-config
docs/       architecture.md — architecture & decision rationale
samples/    demo CSV datasets + generator
```

## Deployment

- **Web** → Vercel. Set `NEXT_PUBLIC_API_URL` to the deployed API origin **including `/api/v1`**.
- **API** → AWS Lambda via `pnpm --filter @orgwise/api deploy` (Serverless Framework + esbuild bundle), or any Node 20 host with `node dist/index`.
- **Database** → Neon (managed Postgres).

Set `CORS_ORIGINS` on the API to the exact frontend origin, `TRUST_PROXY=true` in production, and keep Copilot keys only in the API environment.

## License

Proprietary — all rights reserved.
