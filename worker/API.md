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
`io('wss://worker-host', { auth: { token: <WORKER_API_KEY> } })` — the socket handshake
and the HTTP API share the same `WORKER_API_KEY` token. Events:

| Event | Payload |
| --- | --- |
| `message:stored` | `{ message, chat }` after any monitored message is persisted (live or backfill) |
| `message:new` | `{ message, chat, analysis, analysisConfigName }` after a monitored message is analysed |
| `chat:update` | `{ id, telegramChatId, title, isMonitored, addedAt }` |
| `diagnostics:update` | full `DiagnosticsState` (`{ status, issues[], message, updatedAt, context }`) whenever subsystem diagnostics change; also emitted to each client on connect |

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
  diagnostics: {
    status: 'ok'|'warning'|'error' (worst issue severity),
    issues: [{ key, severity: 'warning'|'error', message, updatedAt: ISO, context|null }],
    message: string|null (worst issue's message),
    updatedAt: ISO|null,
    context: { chatTitle, messageText }|null
  },
  recentMessages: Message[],
  recentActions: OverviewAction[]
}
```

`successRate` is a percentage calculated as `sent / (sent + failed) * 100`, or `0`
when there are no completed actions. `latestActionAt` is the newest action's analysis
timestamp because `ActionLog` has no creation timestamp. `recentMessages` contains at
most five records and uses the same `Message` shape documented below.

`diagnostics` in the overview is the same payload as `GET /diagnostics` — see the
[Diagnostics](#diagnostics) section for the full shape and issue keys.

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
| --- | --- | --- | --- |
| GET | `/chats` | — | `200 { items: Chat[] }` |
| PATCH | `/chats/:id` | `{ title?: string, isMonitored?: boolean }` (at least one) | `200 Chat` |
| POST | `/chats/refresh` | — | `200 { ok: true, chats: number }` or `400 { error }` |

`Chat` shape: `{ id, telegramChatId: string, title, isMonitored: boolean, addedAt: ISO }`

### Messages

| Method | Path | Query | Response |
| --- | --- | ---: | --- |
| GET | `/messages` | `chatId?`, `limit?` (1–200, default 50), `cursor?` | `200 { items: Message[], nextCursor: string\|null, hasMore: boolean }` |
| GET | `/messages/summary` | — | `200 { items: MessageSummary[] }` |
| DELETE | `/messages/:id` | — | `204` or `404 { error }` |

`Message` shape:
`{ id, chatId, telegramMessageId, senderName: string\|null, text, receivedAt: ISO,
   chat: { id, title, telegramChatId } }`

`MessageSummary` shape (monitored chats only, newest message first by `lastReceivedAt`):
`{ chatId, title, telegramChatId: string, messageCount: number,
   lastText: string|null, lastReceivedAt: ISO|null }`

Order: newest first. `cursor` is a `Message.id`; pass `nextCursor` for the next page.

Deleting a message cascades: its analyses are removed and, in turn, the action logs of
those analyses.

### Diagnostics

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/diagnostics` | — | `200 Diagnostics` |
| DELETE | `/diagnostics/:key` | — | `204` (also emitted via `diagnostics:update`) |

`Diagnostics` shape:

```text
{
  status: 'ok'|'warning'|'error' (worst issue severity),
  issues: [{ key, severity: 'warning'|'error', message, updatedAt: ISO, context|null }],
  message: string|null (worst issue's message),
  updatedAt: ISO|null,
  context: { chatTitle, messageText }|null
}
```

This is the app-wide health surface. It aggregates **all** failure modes the worker can
hit, each as an entry in `issues` keyed by source:

- `system.startup` — telegram listener failed to boot
- `db.connection` — database unreachable
- `telegram.session` — no session, rejected, revoked/expired auth key, or re-login required
- `telegram.listener` — connection lost mid-run, connect failures, backfill gaps
- `telegram.scan` — chat refresh (`POST /chats/refresh`) failed or timed out
- `login.flow` — Telegram sign-in errors in the web login flow
- `llm.analyze` — LLM call failed or returned non-JSON
- `llm.failover` — a request was served by the backup provider because the primary (Groq) errored or hit a rate limit; cleared when the primary succeeds again
- `analysis.config` — no active configs, or a message arrived in a chat the active configs don't cover
- `notifier.dispatch` — a notifier send failed (or unknown notifier type)

`status`/`message`/`updatedAt`/`context` mirror the **worst** current issue (errors beat
warnings, then newest). Issues are self-clearing: the reporter for each source resolves
its own key on success (e.g. a successful dispatch removes `notifier.dispatch`), so the
dashboard banner shows every live problem at once instead of just the last one.

### Settings

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/settings` | — | `200 { analysisConfigs[], actionRules[], notifiers[] }` |
| POST | `/settings/analysis-configs` | `{ name, promptTemplate, outputSchema, isActive, allowedChatIds? }` | `201 AnalysisConfig` |
| PATCH | `/settings/analysis-configs/:id` | partial `AnalysisConfig` | `200 AnalysisConfig` |
| DELETE | `/settings/analysis-configs/:id` | — | `204` |
| POST | `/settings/notifiers` | `{ type, name, config, isActive }` | `201 Notifier` |
| PATCH | `/settings/notifiers/:id` | partial `Notifier` (`config` re-encrypted when present) | `200 Notifier` |
| DELETE | `/settings/notifiers/:id` | — | `204` |
| POST | `/settings/notifiers/:id/test` | `{ to? }` | `200 { ok: true }` or `400 { ok: false, error }` |
| POST | `/settings/action-rules` | `{ analysisConfigId, condition, notifierId, isActive }` | `201 ActionRule` |
| PATCH | `/settings/action-rules/:id` | partial `ActionRule` | `200 ActionRule` |
| DELETE | `/settings/action-rules/:id` | — | `204` |

Shapes:

- `AnalysisConfig`: `{ id, name, promptTemplate, outputSchema, isActive, createdAt, allowedChatIds: string[] }`
- `Notifier` (secrets never read back): `{ id, type, name, isActive, configConfigured: true, telegramTargetChatId, configEmailTo }` — the only fields echoed back are the non-secret Telegram destination chat id (for the selector UI) and the email recipient `to` (for the edit form); all other config stays write-only.
- `ActionRule`: `{ id, analysisConfigId, condition, notifierId, notifierName, notifierType, isActive }`

`allowedChatIds` is a **chat allowlist**: an empty array (the default) means the config applies
to every monitored chat; a non-empty array restricts it to exactly those chats (by `Chat.id`).
When a monitored message arrives in a chat the config isn't scoped to, the config is skipped.

`notifier.type` ∈ `telegram | email | webhook | push | slack`. Secrets are encrypted at rest
(AES-256-GCM); a `config` value sent on create/update is encrypted, and existing secrets are
preserved when `config` is omitted on PATCH. The dashboard re-asks for secrets when editing.

**Loop guard (telegram notifiers):** a telegram notifier whose `config.targetChatId` refers to a
chat currently marked `isMonitored` is rejected with `400 { ok: false, error }` on create/update,
and at dispatch time the notifier refuses to send into any chat that became monitored since it was
saved (recorded as a failed `ActionLog`). Notifications must land in a non-monitored channel,
otherwise the sent message would be ingested, analyzed, and re-notified forever.

### Action logs

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/action-logs` | `limit?`, `cursor?` | `200 { items: ActionLog[], nextCursor, hasMore }` |
| DELETE | `/action-logs/:id` | — | `204` or `404 { error }` |

`ActionLog` item shape:
`{ id, status: 'pending'\|'sent'\|'failed', retryCount, sentAt: ISO\|null, errorDetail: string\|null,
   body: string\|null, recipient: string\|null,
   notifier: { id, name, type },
   analysis: { id, analyzedAt, rawResponse, analysisConfigName,
     message: { id, text, senderName, receivedAt, chat: { id, title, telegramChatId } } } }`

`body` is the exact notification text the notifier delivered (empty before dispatch completes for
old rows); `recipient` is the resolved destination at dispatch time — the chat title for telegram
(falling back to the peer id), the `to` address for email, or the webhook `url`.

### Analyses

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/analyses` | `limit?`, `cursor?` | `200 { items: Analysis[], nextCursor, hasMore }` |
| DELETE | `/analyses/:id` | — | `204` or `404 { error }` |

`Analysis` item shape:
`{ id, analyzedAt: ISO, rawResponse, analysisConfigName: string, fired: boolean,
   message: { id, text, senderName: string\|null, receivedAt: ISO,
     chat: { id, title, telegramChatId } },
   actions: { id, status: 'pending'\|'sent'\|'failed', retryCount, sentAt: ISO\|null,
     errorDetail: string\|null, notifier: { id, name, type } }[] }`

Every stored analysis (matched or not) is listed, newest first. `fired` is true when at least
one action rule matched and `actions` reflects the dispatch attempts on matching rules; it is
empty for analyses whose verdict matched no rule. Deleting an analysis also removes its
action logs.

### Mail

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/mail` | `limit?`, `cursor?` | `200 { items: MailJob[], nextCursor: string\|null, hasMore: boolean }` |
| POST | `/mail/send` | `{ analysisId, recipients: string[], subject?, body?, notifierId? }` | `200 MailSendResult` or `400 { error }` |

`MailJob` item shape:
`{ messageId, senderName: string\|null, text, receivedAt: ISO,
   chat: { id, title, telegramChatId },
   analysisId, analyzedAt: ISO, provider: string\|null, model: string\|null,
   analysisConfigName: string, analysis: rawResponseJson, body: string }`

Each item is the **latest** analysis of one message. `body` is the pre-built default email text
(LLM analysis only, same format as notifiers). Cursor is the item's own `analysisId`; pass
`nextCursor` for the next page.

`MailSendResult` shape:
`{ ok: true, host: string, from: string, to: string[], subject: string, sentAt: ISO }`

SMTP resolution order: the `notifierId`'s email config, or the first active email notifier's
config, falling back to the `SMTP_*` environment variables. An explicit `body` replaces the
default analysis text; `subject` is required or an analysis-style subject is used automatically.
Manual sends are **not** written to `ActionLog`.

### Telegram session

| Method | Path | Body | Response |
| --- | --- | --- | --- |
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
