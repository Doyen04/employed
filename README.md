# Employed

Telegram message monitoring with AI analysis and automated actions.

Two independent codebases live in this repository, joined by one git history at the root:

| Directory | Role | Deploy / runtime |
|-----------|------|------------------|
| `dashboard/` | TanStack Start admin UI | Vercel (static + server functions) |
| `worker/` | Persistent Node process | Long-lived host (no cold starts) |

## Architecture

- The **worker** is the only process that touches Telegram (via **teleproto**), calls the
  LLM (Groq by default), stores data in Postgres (Prisma 7), and exposes an HTTP + Socket.io
  API documented in [`worker/API.md`](worker/API.md).
- The **dashboard** never imports Prisma and never holds a `DATABASE_URL`. It talks to the
  worker only over HTTP + Socket.io using the `WORKER_URL` / `WORKER_API_KEY` env vars.

Flow: Telegram message → worker ingests/viewmonitors chat → LLM analysis → matching
ActionRule → notifier dispatch → `ActionLog` trace. SIM dashboard sees the same data over
the worker's API and receives live `message:new` / `chat:update` events over Socket.io.

## Getting started

See `worker/README.md` and `dashboard/README.md` for per-codebase setup.

## Development

```powershell
# worker (needs local Popencode -s ses_f8c56e784ffecBESykilpfJi7Dostgres)
cd worker
npm install
npm run db:generate
npm run db:migrate
npm run dev            # http://localhost:8000
npm run login          # authenticate the Telegram session once

# dashboard
cd dashboard
npm install
npm run dev
```

## Contract

`worker/API.md` is the canonical API contract. Dashboard server functions must be written
against it — never against Prisma or the worker's internals.
