# Employed Worker

Long-running Node process owning the Telegram listener (via **teleproto**, not GramJS), the
LLM analysis pipeline, the action dispatch layer, the HTTP API, the Socket.io realtime push,
and the **Prisma schema/database** exclusively.

This is the second half of the two-codebase split. The dashboard (`../dashboard`, TanStack
Start on Vercel) never touches the database — it only calls this worker's HTTP API.

## Stack

| Concern | Library |
|---|---|
| MTProto client | [`teleproto`](https://docs.teleproto.dev) |
| HTTP API | Express 5 |
| Realtime push | Socket.io |
| ORM / schema owner | Prisma 7 + `@prisma/adapter-pg` |
| LLM analysis | `groq-sdk` (JSON-mode completions) |
| Retries | `p-retry` |
| Request/env validation | `zod` |
| At-rest encryption | Node `crypto` AES-256-GCM |

## Setup

```bash
cp .env.example .env      # then fill in real values
npm install
npm run db:generate       # generates src/generated/prisma
npm run db:migrate        # create/apply dev migrations
npm run db:seed           # optional demo config/notifier/rule
npm run login             # phone + OTP; session stored encrypted in Postgres
npm run dev               # tsx watch src/main.ts
```

On deploy run `npm run db:deploy` (i.e. `prisma migrate deploy`) as part of the release step.

## Environment

See `.env.example`. Every var is read through `src/config.ts` (validated with `zod`).

## Sending Telegram messages to yourself

A chat `/refresh` call scans your joined chats into the `Chat` table. The `telegram` notifier
posts to a chat you choose by setting `config.targetChatId` on the notifier — typically your
Saved Messages (`me`) or a private chat with yourself.

## Prisma ownership

- `schema.prisma`, `prisma.config.ts`, `seed.ts` and running `prisma migrate` live **only here**.
- The dashboard has no Prisma dependency and no database connection string.