import type { TelegramClient } from 'teleproto'
import type { StringSession } from 'teleproto/sessions'
import { NewMessage, Raw } from 'teleproto/events'
import type { NewMessageEvent } from 'teleproto/events'
import { UnauthorizedError } from 'teleproto/errors'
import { UpdateConnectionState } from 'teleproto/network'
import bigInt from 'big-integer'

import { Prisma } from '../generated/prisma/client'
import { prisma } from '../prisma'
import { createClient, resetTelegramClient } from './client'
import { clearSession, getSessionString } from './sessionStore'
import { runAnalysis } from '../llm/analyze'
import { matchesCondition } from '../actions/resolver'
import { dispatchAction } from '../actions/dispatch'
import { reportDiagnostic, clearDiagnostic } from '../diagnostics'
import { toJsonValue } from '../types/json'
import { emitMessageNew, emitMessageStored } from '../socket/server'
import { getSetting, setSetting } from '../prisma/settings'
import { chatRef } from '../api/serializers'
import { getErrorMessage } from '../utils/errors'
import { truncate } from '../utils/truncate'

const LAST_SEEN_PREFIX = 'tg.lastMsg:'
const HEALTH_CHECK_INTERVAL_MS = 60_000

async function purgeRevokedSession(reason: string): Promise<void> {
    console.warn(`[listener] ${reason} — purging chat data`)
    try {
        await clearSession()
    } catch (purgeError) {
        console.error('[listener] failed to purge chat data:', getErrorMessage(purgeError))
    }
}

function lastSeenKey(telegramChatId: bigint): string {
    return `${LAST_SEEN_PREFIX}${telegramChatId.toString()}`
}

async function getLastSeen(telegramChatId: bigint): Promise<number | null> {
    const raw = await getSetting(lastSeenKey(telegramChatId))
    return raw ? Number(raw) : null
}

async function setLastSeen(telegramChatId: bigint, messageId: number): Promise<void> {
    await setSetting(lastSeenKey(telegramChatId), String(messageId))
}

async function resolveChatTitle(
    client: TelegramClient,
    event: NewMessageEvent,
): Promise<string> {
    if (event.chatId === undefined) return 'unknown'
    const direct = (event as { chat?: { title?: unknown } }).chat?.title
    if (typeof direct === 'string' && direct.length > 0) return direct

    try {
        const entity = await client.getEntity(event.chatId)
        const title = (entity as { title?: unknown }).title
        if (typeof title === 'string' && title.length > 0) return title
    } catch {
        // fall through to the id-based title below
    }

    return String(event.chatId)
}

function senderNameOf(message: unknown): string | null {
    const { sender, senderId } = message as {
        sender?: { firstName?: string; lastName?: string; title?: string }
        senderId?: { toString(): string }
    }
    if (sender?.firstName) {
        return sender.lastName ? `${sender.firstName} ${sender.lastName}` : sender.firstName
    }
    return sender?.title ?? senderId?.toString() ?? null
}

function isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

async function ingestMessage(
    client: TelegramClient,
    event: NewMessageEvent,
    receivedAt: Date,
): Promise<void> {
    const text = (event.message.message ?? '').trim()
    if (!text) return

    if (event.chatId === undefined) return
    const telegramChatId = BigInt(event.chatId.toString())
    const telegramMessageId = event.message.id

    let chat = await prisma.chat.findUnique({ where: { telegramChatId } })
    if (!chat) {
        chat = await prisma.chat.create({
            data: {
                telegramChatId,
                title: await resolveChatTitle(client, event),
                isMonitored: false,
            },
        })
    }

    if (!chat.isMonitored) return

    let message: MessageRow | undefined
    try {
        message = await prisma.message.create({
            data: {
                chatId: chat.id,
                telegramMessageId,
                senderName: senderNameOf(event.message),
                text,
                receivedAt,
            },
        })
    } catch (error) {
        if (!isUniqueConstraintError(error)) throw error
    }

    await setLastSeen(telegramChatId, telegramMessageId)
    if (message) {
        emitMessageStored(serializeStored(chat, message))
        await processMessage(message, chat)
    }
}

interface MessageRow {
    id: string
    chatId: string
    telegramMessageId: number
    senderName: string | null
    text: string
    receivedAt: Date
}

function serializeStored(
    chat: { id: string; title: string; telegramChatId: bigint },
    message: MessageRow,
) {
    const ref = chatRef(chat)
    return {
        message: {
            id: message.id,
            chatId: message.chatId,
            telegramMessageId: message.telegramMessageId,
            senderName: message.senderName,
            text: message.text,
            receivedAt: message.receivedAt.toISOString(),
            chat: ref,
        },
        chat: ref,
    }
}

async function processMessage(
    message: MessageRow,
    chat: { id: string; title: string; telegramChatId: bigint },
): Promise<void> {
    const configs = await prisma.analysisConfig.findMany({
        where: { isActive: true },
        include: {
            allowedChats: { select: { id: true } },
            actionRules: {
                where: { isActive: true },
                include: { notifier: true },
            },
        },
    })

    if (configs.length === 0) {
        await reportDiagnostic(
            'analysis.config',
            'warning',
            'No active analysis configs — messages are not being analyzed.',
            { chatTitle: chat.title, messageText: truncate(message.text, 200) },
        )
        return
    }

    const scoped = configs.filter(
        (cfg) => cfg.allowedChats.length === 0 || cfg.allowedChats.some((allowed) => allowed.id === chat.id),
    )

    if (scoped.length === 0) {
        await reportDiagnostic(
            'analysis.config',
            'warning',
            'No active analysis config covers this chat — message was not analyzed.',
            { chatTitle: chat.title, messageText: truncate(message.text, 200) },
        )
        return
    }

    let allOk = true

    for (const cfg of scoped) {
        let output: Record<string, unknown>
        let analyzedBy: { provider: string | null; model: string | null } = { provider: null, model: null }
        try {
            const result = await runAnalysis(cfg, message.text)
            output = result.output
            analyzedBy = { provider: result.provider, model: result.model }
        } catch (error) {
            const errorMessage = getErrorMessage(error)
            allOk = false
            console.error('[listener] analysis failed:', errorMessage)
            await reportDiagnostic('llm.analyze', 'error', errorMessage, {
                chatTitle: chat.title,
                messageText: truncate(message.text, 200),
            })
            continue
        }
        const analysis = await prisma.analysis.create({
            data: {
                messageId: message.id,
                analysisConfigId: cfg.id,
                rawResponse: toJsonValue(output),
                provider: analyzedBy.provider,
                model: analyzedBy.model,
            },
        })

        for (const rule of cfg.actionRules) {
            if (!matchesCondition(rule.condition, output)) continue
            await dispatchAction(rule, analysis, {
                message,
                chat,
                analysisConfigName: cfg.name,
            })
        }

        const chatPayload = chatRef(chat)
        emitMessageNew({
            message: {
                id: message.id,
                chatId: message.chatId,
                telegramMessageId: message.telegramMessageId,
                senderName: message.senderName,
                text: message.text,
                receivedAt: message.receivedAt.toISOString(),
                chat: chatPayload,
            },
            chat: chatPayload,
            analysis: toJsonValue(output),
            analysisConfigName: cfg.name,
        })
    }

    if (allOk) {
        await clearDiagnostic('llm.analyze')
        await clearDiagnostic('analysis.config')
    }
}

function onNewMessage(client: TelegramClient<StringSession>) {
    return (event: NewMessageEvent): void => {
        ingestMessage(client, event, new Date())
            .catch((error) => console.error('[listener] ingest failed:', getErrorMessage(error)))
    }
}

async function backfillMonitoredChats(client: TelegramClient<StringSession>): Promise<void> {
    const chats = await prisma.chat.findMany({ where: { isMonitored: true } })
    for (const chat of chats) {
        const lastSeen = await getLastSeen(chat.telegramChatId)
        if (lastSeen == null) continue

        try {
            const messages = await client.getMessages(bigInt(String(chat.telegramChatId)), {
                offsetId: lastSeen,
                reverse: true,
                limit: 50,
            })

            for (const msg of messages) {
                const text = (msg.message ?? '').trim()
                if (!text) continue

                let created: MessageRow | undefined
                try {
                    created = await prisma.message.create({
                        data: {
                            chatId: chat.id,
                            telegramMessageId: msg.id,
                            senderName: senderNameOf(msg),
                            text,
                            receivedAt: new Date(msg.date * 1000),
                        },
                    })
                } catch (error) {
                    if (!isUniqueConstraintError(error)) throw error
                }

                await setLastSeen(chat.telegramChatId, msg.id)
                if (created) {
                    emitMessageStored(serializeStored(chat, created))
                    await processMessage(created, chat)
                }
            }
        } catch (error) {
            console.error(`[listener] backfill failed for chat ${chat.id}:`, getErrorMessage(error))
            reportDiagnostic(
                'telegram.listener',
                'warning',
                'Backfill of monitored chats failed — some recent messages may be missing.',
            ).catch(() => { })
        }
    }
}

export async function startTelegramListener(): Promise<boolean> {
    const session = await getSessionString()
    if (!session) return false

    const client = createClient(session)

    try {
        await client.connect()
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            await reportDiagnostic(
                'telegram.session',
                'error',
                'Telegram session rejected by Telegram — re-login required.',
            )
            await purgeRevokedSession('telegram session rejected')
            return false
        }
        await reportDiagnostic('telegram.listener', 'error', `telegram connect failed: ${getErrorMessage(error)}`)
        throw error
    }

    try {
        await client.getMe()
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            await reportDiagnostic(
                'telegram.session',
                'error',
                'Telegram auth key is not registered (revoked or expired) — re-login required.',
            )
            await purgeRevokedSession('telegram auth key is not registered (revoked or expired)')
            return false
        }
        throw error
    }

    client.addEventHandler(
        (update: UpdateConnectionState) => {
            if (update.state !== UpdateConnectionState.broken) return
            console.warn('[listener] telegram connection lost — purging chat data')
            reportDiagnostic(
                'telegram.listener',
                'error',
                'Telegram connection lost — new messages are not being processed.',
            ).catch(() => { })
            resetTelegramClient()
            clearSession().catch((purgeError) =>
                console.error('[listener] failed to purge chat data:', getErrorMessage(purgeError)),
            )
        },
        new Raw({ types: [UpdateConnectionState] }),
    )

    await backfillMonitoredChats(client)

    client.addEventHandler(onNewMessage(client), new NewMessage({ incoming: true }))

    console.log('[listener] telegram listener started')

    await clearDiagnostic('telegram.session')
    await clearDiagnostic('telegram.listener')

    const healthCheck = setInterval(async () => {
        try {
            await client.getMe()
        } catch (error) {
            if (!(error instanceof UnauthorizedError)) return
            clearInterval(healthCheck)
            resetTelegramClient()
            client.disconnect().catch(() => { })
            await reportDiagnostic(
                'telegram.session',
                'error',
                'Telegram auth key was revoked while running — re-login required.',
            )
            await purgeRevokedSession('telegram auth key was revoked while running (AuthKeyUnregistered)')
        }
    }, HEALTH_CHECK_INTERVAL_MS)

    return true
}