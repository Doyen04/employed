# Worker HTTP API — Contract

Private internal API. The dashboard's server functions are the only consumer.

## Auth

Every endpoint except `GET /health` requires:

```
Authorization: Bearer <WORKER_API_KEY>
```

Requests without the header, or with a wrong token, get `401 { "error": "unauthorized" }`.
The dashboard passes the token from its `WORKER_API_KEY` env var. All `BigInt` fields
(`telegramChatId`, message ids) are serialised as strings to stay JSON-safe.

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

| Method | Path | Response |
|---|---|---|
| GET | `/telegram/status` | `200 { loggedIn: boolean }` |

Login itself happens out-of-band with `npm run login` in the worker repo (phone + OTP → session
encrypted into Postgres).