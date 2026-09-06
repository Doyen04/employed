# Worker HTTP API — Contract

Private internal API. The dashboard's server functions are the only consumer.

## Auth

Every endpoint except `GET /health` requires:

```
Authorization: Bearer <WORKER_API_KEY>
```

Requests without the header, or with a wrong token, get `401 { "error": "unauthorized" }`.
The dashboard passes the token from its `WORKER_API_KEY` env var. All `BigInt` fields
(currently `telegramChatId`) are serialised as strings to stay JSON-safe; Telegram message IDs
are stored as integers and returned as numbers.

## Socket.io (realtime)

Browser → worker, bypassing the dashboard server. Connect with
`io('wss://worker-host', { auth: { token: <SOCKET_TOKEN> } })`, where `SOCKET_TOKEN`
defaults to `WORKER_API_KEY`. Events:

| Event | Payload |
|---|---|
| `message:new` | `{ message, chat, analysis, analysisConfigName }` after a monitored message is analysed |
| `chat:update` | `{ id, telegramChatId, title, isMonitored, addedAt }` |

## Endpoints

### Health

| Method | Path | Body/Query | Response |
|---|---|---|---|
| GET | `/health` | — | `200 { "ok": true }` (no auth) |

### Overview

| Method | Path | Body/Query | Response |
|---|---|---|---|
| GET | `/overview` | — | `200 Overview` |

`Overview` shape:

```text
{
  counts: {
    chats: { total: number, monitored: number },
    messages: { total: number },
    analysisConfigs: { total: number, active: number },
    rules: { total: number, active: number },
    notifiers: { total: number, active: number },
    actions: {
      sent: number,
      failed: number,
      pending: number,
      successRate: number
    }
  },
  timestamps: {
    latestMessageAt: ISO|null,
    latestAnalysisAt: ISO|null,
    latestActionAt: ISO|null
  },
  recentMessages: Message[],
  recentActions: OverviewAction[]
}
```

`successRate` is a percentage calculated as `sent / (sent + failed) * 100`, or `0`
when there are no completed actions. `latestActionAt` is the newest action's analysis
timestamp because `ActionLog` has no creation timestamp. `recentMessages` contains at
most five records and uses the same `Message` shape documented below.

`OverviewAction` shape:
`{ id, status: 'pending'|'sent'|'failed', retryCount, sentAt: ISO|null,
   errorDetail: string|null, notifier: { name, type },
   analysis: { analysisConfigName, analyzedAt: ISO },
   message: { text, senderName: string|null, receivedAt: ISO, chatTitle } }`

`recentActions` contains at most five records, ordered newest first by
`analysis.analyzedAt`, then by `id` descending. All dates are ISO strings and all
`BigInt` identifiers are strings.

### Chats

| Method | Path | Body/Query | Response |
|---|---|---|---|
| GET | `/chats` | — | `200 { items: Chat[] }` |
| PATCH | `/chats/:id` | `{ title?: string, isMonitored?: boolean }` (at least one) | `200 Chat` |
| POST | `/chats/refresh` | — | `200 { ok: true, chats: number }` or `400 { error }` |

`Chat` shape: `{ id, telegramChatId: string, title, isMonitored: boolean, addedAt: ISO }`

### Messages

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/messages` | `chatId?`, `limit?` (1–200, default 50), `cursor?` | `200 { items: Message[], nextCursor: string\|null, hasMore: boolean }` |

`Message` shape:
`{ id, chatId, telegramMessageId, senderName: string\|null, text, receivedAt: ISO,
   chat: { id, title, telegramChatId } }`

Order: newest first. `cursor` is a `Message.id`; pass `nextCursor` for the next page.

### Settings

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/settings` | — | `200 { analysisConfigs[], actionRules[], notifiers[] }` |
| POST | `/settings/analysis-configs` | `{ name, promptTemplate, outputSchema, isActive }` | `201 AnalysisConfig` |
| PATCH | `/settings/analysis-configs/:id` | partial `AnalysisConfig` | `200 AnalysisConfig` |
| DELETE | `/settings/analysis-configs/:id` | — | `204` |
| POST | `/settings/notifiers` | `{ type, name, config, isActive }` | `201 Notifier` |
| PATCH | `/settings/notifiers/:id` | partial `Notifier` (`config` re-encrypted when present) | `200 Notifier` |
| DELETE | `/settings/notifiers/:id` | — | `204` |
| POST | `/settings/action-rules` | `{ analysisConfigId, condition, notifierId, isActive }` | `201 ActionRule` |
| PATCH | `/settings/action-rules/:id` | partial `ActionRule` | `200 ActionRule` |
| DELETE | `/settings/action-rules/:id` | — | `204` |

Shapes:

- `AnalysisConfig`: `{ id, name, promptTemplate, outputSchema, isActive, createdAt }`
- `Notifier` (secrets never read back): `{ id, type, name, isActive, configConfigured: true }`
- `ActionRule`: `{ id, analysisConfigId, condition, notifierId, notifierName, notifierType, isActive }`

`notifier.type` ∈ `telegram | email | webhook | push | slack`. Secrets are encrypted at rest
(AES-256-GCM); a `config` value sent on create/update is encrypted, and existing secrets are
preserved when `config` is omitted on PATCH. The dashboard re-asks for secrets when editing.

### Action logs

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/action-logs` | `limit?`, `cursor?` | `200 { items: ActionLog[], nextCursor, hasMore }` |

`ActionLog` item shape:
`{ id, status: 'pending'\|'sent'\|'failed', retryCount, sentAt: ISO\|null, errorDetail: string\|null,
   notifier: { id, name, type },
   analysis: { id, analyzedAt, rawResponse, analysisConfigName,
     message: { id, text, senderName, receivedAt, chat: { id, title, telegramChatId } } } }`

### Telegram session

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/telegram/status` | — | `200 { loggedIn: boolean, login: LoginStatus }` |
| GET | `/telegram/login` | — | `200 { login: LoginStatus }` |
| POST | `/telegram/login/start` | `{ phoneNumber }` | `202 { login: LoginStatus }` or `409 { error }` when a flow is already running |
| POST | `/telegram/login/code` | `{ code }` | `200 { login: LoginStatus }` or `409` when no code prompt is pending |
| POST | `/telegram/login/password` | `{ password }` | `200 { login: LoginStatus }` or `409` when no password prompt is pending |
| POST | `/telegram/login/abort` | — | `200 { login: LoginStatus }` |

The login flow is a single active login per worker:

1. `POST /telegram/login/start` with a phone number kicks off the flow and returns
   `LoginStatus<started>` (`202`).
2. Poll `GET /telegram/status` (or `/telegram/login`): when Telegram asks for the
   SMS/OTP code the status becomes `awaitingCode`; if the account has 2FA it then
   becomes `awaitingPassword` (with the optional `hint`).
3. Submit the code / 2FA password. After the final step the status flips to `done`
   and the session is stored encrypted; the worker hot-starts the realtime listener.
4. Any error (wrong code, timeout, cancellation, Telegram-side failure) leaves the
   status as `error` with a message. `POST /login/abort` cancels a running flow.

`LoginStatus` is one of:
`{ state: 'idle' } | { state: 'started' } | { state: 'awaitingCode' } |
{ state: 'awaitingPassword'; hint?: string } | { state: 'done' } |
{ state: 'error'; error: string }`

Login itself can still be run out-of-band with `npm run login` in the worker repo.