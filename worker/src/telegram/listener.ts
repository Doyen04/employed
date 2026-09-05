import type { TelegramClient } from 'teleproto'
import { NewMessage } from 'teleproto/events'
import type { NewMessageEvent } from 'teleproto/events'
import bigInt from 'big-integer'

import { prisma } from '../prisma'
import { buildClient } from './client'
import { getSessionString } from './sessionStore'
import { runAnalysis } from '../llm/analyze'
import { matchesCondition } from '../actions/resolver'
import { dispatchAction } from '../actions/dispatch'
import { toJsonValue } from '../types/json'
import { emitMessageNew } from '../socket/server'

const LAST_SEEN_PREFIX = 'tg.lastMsg:'

function lastSeenKey(telegramChatId: bigint): string {
  return `${LAST_SEEN_PREFIX}${telegramChatId.toString()}`
}

async function getLastSeen(telegramChatId: bigint): Promise<number | null> {
  const row = await prisma.setting.findUnique({ where: { key: lastSeenKey(telegramChatId) } })
  return row ? Number(row.value) : null
}

async function setLastSeen(telegramChatId: bigint, messageId: number): Promise<void> {
  await prisma.setting.upsert({
    where: { key: lastSeenKey(telegramChatId) },
    update: { value: String(messageId) },
    create: { key: lastSeenKey(telegramChatId), value: String(messageId) },
  })
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

function senderNameOf(event: NewMessageEvent): string | null {
  const sender = (event.message as { sender?: { firstName?: string; lastName?: string } }).sender
  if (sender?.firstName) {
    return sender.lastName ? `${sender.firstName} ${sender.lastName}` : sender.firstName
  }
  return event.message.senderId?.toString() ?? null
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

  const message = await prisma.message.upsert({
    where: {
      chatId_telegramMessageId: { chatId: chat.id, telegramMessageId },
    },
    update: {},
    create: {
      chatId: chat.id,
      telegramMessageId,
      senderName: senderNameOf(event),
      text,
      receivedAt,
    },
  })

  await setLastSeen(telegramChatId, telegramMessageId)
  await processMessage(message, chat)
}

interface MessageRow {
  id: string
  chatId: string
  text: string
  receivedAt: Date
}

async function processMessage(
  message: MessageRow,
  chat: { id: string; title: string },
): Promise<void> {
  const configs = await prisma.analysisConfig.findMany({
    where: { isActive: true },
    include: {
      actionRules: {
        where: { isActive: true },
        include: { notifier: true },
      },
    },
  })

  if (configs.length === 0) return

  for (const cfg of configs) {
    try {
      const output = await runAnalysis(cfg, message.text)
      const analysis = await prisma.analysis.create({
        data: {
          messageId: message.id,
          analysisConfigId: cfg.id,
          rawResponse: toJsonValue(output),
        },
      })

      for (const rule of cfg.actionRules) {
        if (!matchesCondition(rule.condition, output)) continue
        await dispatchAction(rule, analysis, { message, chat })
      }

      emitMessageNew({ message, chat, analysis: output, analysisConfigName: cfg.name })
    } catch (error) {
      console.error('[listener] analysis failed:', (error as Error).message)
    }
  }
}

function onNewMessage(client: TelegramClient) {
  return (event: NewMessageEvent): void => {
    ingestMessage(client, event, new Date())
      .catch((error) => console.error('[listener] ingest failed:', (error as Error).message))
  }
}

async function backfillMonitoredChats(client: TelegramClient): Promise<void> {
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

        const upserted = await prisma.message.upsert({
          where: {
            chatId_telegramMessageId: { chatId: chat.id, telegramMessageId: msg.id },
          },
          update: {},
          create: {
            chatId: chat.id,
            telegramMessageId: msg.id,
            senderName: null,
            text,
            receivedAt: new Date(msg.date * 1000),
          },
        })

        await setLastSeen(chat.telegramChatId, msg.id)
        await processMessage(upserted, chat)
      }
    } catch (error) {
      console.error(`[listener] backfill failed for chat ${chat.id}:`, (error as Error).message)
    }
  }
}

export async function startTelegramListener(): Promise<boolean> {
  const session = await getSessionString()
  if (!session) return false

  const client = buildClient(session)
  await client.connect()

  await backfillMonitoredChats(client)

  client.addEventHandler(onNewMessage(client), new NewMessage({ incoming: true }))

  console.log('[listener] telegram listener started')
  return true
}