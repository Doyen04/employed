import pRetry from 'p-retry'

import { prisma } from '../prisma'
import { notifierRegistry } from './registry'
import { decryptNotifierConfig } from './notifiers/telegram'
import { buildNotificationText } from './notifiers/format'
import { clearDiagnostic, reportDiagnostic } from '../diagnostics'
import { getErrorMessage } from '../utils/errors'
import { truncate } from '../utils/truncate'
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

    const config = decryptNotifierConfig(rule.notifier.config)
    const recipient = await resolveRecipient(rule.notifier.type, config)

    const log = await prisma.actionLog.create({
        data: {
            analysisId: analysis.id,
            notifierId: rule.notifierId,
            status: 'pending',
            retryCount: 0,
            body: buildNotificationText(payload),
            recipient,
        },
    })

    if (!notifier) {
        await failLog(log, `unknown notifier type "${rule.notifier.type}"`)
        await reportDiagnostic(
            'notifier.dispatch',
            'error',
            `Notifier "${rule.notifier.name}" uses unknown type "${rule.notifier.type}".`,
            { chatTitle: context.chat.title, messageText: truncate(context.message.text, 200) },
        )
        return
    }

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
        await clearDiagnostic('notifier.dispatch')
    } catch (error) {
        await failLog(log, getErrorMessage(error), attempts - 1)
        await reportDiagnostic(
            'notifier.dispatch',
            'error',
            `Notifier "${rule.notifier.name}" failed: ${getErrorMessage(error)}`,
            { chatTitle: context.chat.title, messageText: truncate(context.message.text, 200) },
        )
    }
}

async function failLog(log: ActionLog, error: string, retryCount = 0): Promise<void> {
    console.error('[dispatch] action failed:', error)
    await prisma.actionLog.update({
        where: { id: log.id },
        data: { status: 'failed', errorDetail: error, retryCount },
    })
}

async function resolveRecipient(
    type: string,
    config: Record<string, unknown>,
): Promise<string | null> {
    switch (type) {
        case 'telegram': {
            const target = String(config.targetChatId ?? '').trim()
            if (!target) return null
            try {
                const chat = await prisma.chat.findFirst({
                    where: { telegramChatId: BigInt(target) },
                    select: { title: true },
                })
                return chat?.title ?? target
            } catch {
                return target
            }
        }
        case 'email': {
            const to = String(config.to ?? '').trim()
            return to || null
        }
        case 'webhook': {
            const url = String(config.url ?? '').trim()
            return url || null
        }
        default: {
            const value = config.recipient
            return typeof value === 'string' && value.trim() ? value.trim() : null
        }
    }
}