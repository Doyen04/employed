import pRetry from 'p-retry'

import { prisma } from '../prisma'
import { notifierRegistry } from './registry'
import { decryptNotifierConfig } from './notifiers/telegram'
import type { NotificationPayload } from './types'
import type { ActionLog, ActionRule, Analysis, Chat, Message, Notifier } from '../generated/prisma/client'

interface DispatchContext {
  message: Pick<Message, 'receivedAt' | 'senderName' | 'text'>
  chat: Pick<Chat, 'title'>
  analysisConfigName: string
}

export async function dispatchAction(
  rule: ActionRule & { notifier: Notifier },
  analysis: Analysis,
  context: DispatchContext,
): Promise<void> {
  if (!rule.notifier.isActive) return

  const notifier = notifierRegistry[rule.notifier.type]
  const payload: NotificationPayload = {
    chatTitle: context.chat.title,
    senderName: context.message.senderName,
    text: context.message.text,
    receivedAt: context.message.receivedAt.toISOString(),
    analysisConfigName: context.analysisConfigName,
    analysis: analysis.rawResponse as unknown as Record<string, unknown>,
  }

  const log = await prisma.actionLog.create({
    data: {
      analysisId: analysis.id,
      notifierId: rule.notifierId,
      status: 'pending',
      retryCount: 0,
    },
  })

  if (!notifier) {
    await failLog(log, `unknown notifier type "${rule.notifier.type}"`)
    return
  }

  const config = decryptNotifierConfig(rule.notifier.config)
  let attempts = 0

  try {
    await pRetry(
      async () => {
        attempts += 1
        const result = await notifier.send(payload, config)
        if (result.status === 'failed') {
          throw new Error(result.error ?? 'dispatch failed')
        }
      },
      { retries: 3, minTimeout: 1000, factor: 2 },
    )

    await prisma.actionLog.update({
      where: { id: log.id },
      data: { status: 'sent', sentAt: new Date(), retryCount: attempts - 1 },
    })
  } catch (error) {
    await failLog(log, (error as Error).message, attempts - 1)
  }
}

async function failLog(log: ActionLog, error: string, retryCount = 0): Promise<void> {
  console.error('[dispatch] action failed:', error)
  await prisma.actionLog.update({
    where: { id: log.id },
    data: { status: 'failed', errorDetail: error, retryCount },
  })
}