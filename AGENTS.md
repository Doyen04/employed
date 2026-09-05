# AGENTS.md

Two independent codebases live in this repo, one git history at the `employed/` root:

```
employed/
├── dashboard/   TanStack Start UI (Vercel deploy)
└── worker/      Persistent Node process (Telegram, LLM, actions, API, Postgres)
```

## Hard rules

- The dashboard NEVER imports or references Prisma. It has no `DATABASE_URL`, no `prisma/`
  folder, no Prisma schema. The dashboard talks to the worker only over HTTP + Socket.io
  using `WORKER_URL` and `WORKER_API_KEY` (`dashboard/.env.local`).
- The worker is the sole owner of `prisma/schema.prisma`, the generated client, migrations,
  and the `DATABASE_URL`. Do not duplicate the schema in the dashboard.
- The repo has exactly one `.git` at the root. Do not `git init` inside `dashboard/` or
  `worker/`.
- Telegram access uses **teleproto** (`worker/package.json`), never GramJS/`@telegraf` etc.
- Keep Prisma pinned to stable (7.10.x). Do not bump to the `8.0.0-rc.*` line.

## Commands

### worker/ (`C:\Users\HP\Documents\5WEB_PROJECT\employed\worker`)
```
npm run typecheck    # tsc --noEmit          — run after every change
npm run db:generate  # prisma generate
npm run db:push      # sync schema to dev DB
npm run db:migrate   # prisma migrate dev
npm run db:deploy    # prisma migrate deploy (production)
npm run db:seed      # node prisma/seed.ts
npm run dev          # tsx watch src/main.ts   → http://localhost:8000
npm run start        # tsx src/main.ts
npm run login        # interactive Telegram session (npm run start first)
```

### dashboard/ (`C:\Users\HP\Documents\5WEB_PROJECT\employed\dashboard`)
```
npm run lint
npm run build        # also regenerates routeTree.gen.ts via postinstall
npm run dev
```

## Environment
- Windows PowerShell 5.1. Never chain with `&&`; use `; if ($?) { ... }`.
- `npm-install` blocks scripts: `worker/package.json` `allowScripts` lists approved
  packages (prisma, @prisma/engines, esbuild, unrs-resolver). Add new native deps there.
- Local Postgres must be reachable for worker boot. The DB error
  `P1000 Authentication failed` usually means a stale `DATABASE_URL` in `worker/.env`.

## Contract
- `worker/API.md` is the canonical owner of the HTTP + Socket.io contract. Dashboard server
  functions must be written against it.
- Notifier/LLM configs stored by the worker are encrypted (AES-256-GCM) via `worker/ENCRYPTION_KEY`.