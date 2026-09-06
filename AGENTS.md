# AGENTS.md

Two independent codebases live in this repo, one git history at the `employed/` root:

```
employed/
├── dashboard/   TanStack Start UI (Vercel deploy)
└── worker/      Persistent Node process (Telegram, LLM, actions, API, Postgres)
```

This is deliberately **NOT a monorepo**: no workspace tooling, no shared `packages/` folder,
no shared `package.json`. The two projects only talk over HTTP + Socket.io.

## Hard rules

- The dashboard NEVER imports or references Prisma. It has no `DATABASE_URL`, no `prisma/`
  folder, no Prisma schema. The dashboard talks to the worker only over HTTP + Socket.io
  using `WORKER_URL` and `WORKER_API_KEY` (`dashboard/.env.local`).
- The worker is the sole owner of `prisma/schema.prisma`, the generated client, migrations,
  and the `DATABASE_URL`. Do not duplicate the schema in the dashboard.
- The repo has exactly one `.git` at the root. Do not `git init` inside `dashboard/` or
  `worker/`.
- Telegram access uses **teleproto** (`worker/package.json`), never GramJS/`@telegraf` etc.
  (The original design doc §4 names GramJS; this repo overrides that — teleproto is the only
  approved MTProto client.) Telegram auth = personal account via phone + OTP (+2FA), session
  persisted in `Setting`, encrypted AES-256-GCM via `worker/ENCRYPTION_KEY`.
- Keep Prisma pinned to stable (7.10.x). Do not bump to the `8.0.0-rc.*` line.
- The worker API is the single channel for dashboard data. Every endpoint requires
  `Authorization: Bearer <token>` compared against the worker's env (a shared-secret check).
  `worker/API.md` is the canonical contract.

## Solved problems: do not reinvent (from the design doc §0, §11, §12)

Only write custom code for the app's unique logic (message routing, rule matching, UI).
Use established libraries for everything else — hand-rolling these is forbidden:

- Auth/sessions: dashboard uses **jsonwebtoken** + **bcryptjs** (`DASHBOARD_ADMIN_PASSWORD_HASH`
  env is the bcrypt hash; session is a JWT in an httpOnly cookie). No custom crypto/cookies.
  Worker API auth is a bearer-token compare against an env var (shared secret, per the spec).
- Encryption at rest: **Node `crypto` AES-256-GCM** (built-in, standard) — already used.
- Realtime: **Socket.io** on the worker; the dashboard browser connects directly (VITE_* envs).
- ORM/DB: **Prisma** (worker only). Email/webhook/etc. notifiers use existing SDKs/fetch.
- Retries/backoff: use an existing utility (e.g. `p-retry`) if ever needed — no custom loops.
- Notifier extensibility: a typed dispatch map + interface, NOT a plugin system. `ActionRule`
  conditions are flat key/value matches against LLM output (e.g. `{ "urgency": "high" }`), no DSL.

## Routes convention (dashboard)

- `/` — public marketing/landing page (no auth).
- `/dashboard` and the other `/_protected/*` routes — the app, guarded by an auth check in
  the `_protected` layout's `beforeLoad`; unauthenticated users are redirected to `/login`.
- `/login` — public admin sign-in.
- The `_protected` layout renders the app shell: fixed sidebar navigation + top bar (worker
  status pill, theme toggle). Feature pages live under it: overview, chats, messages,
  telegram, action-logs, settings.

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