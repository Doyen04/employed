<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:

- Run `npx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `npx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

dont run any commandline script or command like npm or any thing unless instructed to do so

# Employed — Dashboard

The dashboard is a **UI only**. All data comes from the Worker's private HTTP API (never the
database, never Prisma). This codebase must never contain: Prisma, `schema.prisma`,
`@prisma/client`, a `DATABASE_URL`, or a Postgres client. If a task looks like it needs to
query the database here, the correct move is to add/extend a Worker API endpoint instead.

## How the dashboard is wired

- **Routes:** `/` is the public landing page. `/login` is the public admin sign-in. Everything
  else lives under the `_protected` layout, which guards with an auth check in `beforeLoad`
  and renders the app shell (sidebar + top bar) with `Outlet`. The main page is `/dashboard`.
- **Server functions** (`src/server/*`) proxy Worker endpoints using `WORKER_URL` +
  `WORKER_API_KEY`, and each one first checks `requireAuthed()` (a server function) so nothing
  leaks without a valid admin session. Browser realtime connects straight to the Worker's
  Socket.io with `VITE_WORKER_SOCKET_*` envs.
- **Auth — use the established libraries, don't reinvent.** The admin session is a JWT
  (`jsonwebtoken`, HS256 signed with `AUTH_SECRET`) stored in an httpOnly cookie named
  `employed_auth`; the password is a bcrypt hash (`bcryptjs`) from the `DASHBOARD_ADMIN_PASSWORD_HASH`
  env var — never a plaintext password env. All auth lives in `src/server/auth.ts`.
- Only write custom code for the dashboard's own logic (UI, the app shell layout, rules
  forms). Never hand-roll auth, encryption, websockets, or an ORM; those are solved problems.

## Environment

- Server-only envs (`WORKER_URL`, `WORKER_API_KEY`, `AUTH_SECRET`, `DASHBOARD_ADMIN_PASSWORD_HASH`)
  are read from `process.env` in server functions (dev: Vite/Nitro, prod: Vercel project settings).
- Browser envs are `VITE_*` (`WORKER_URL`). The socket handshake reuses the worker's
  `WORKER_API_KEY`: the browser fetches it at runtime from the authed `getRealtimeToken` server
  function, so no token is baked into the client bundle. Generate a fresh bcrypt hash with
  `node -e "console.log(require('bcryptjs').hashSync('...', 10))"`.
- See the root `../AGENTS.md` for the full two-codebase ruleset and the worker contract.