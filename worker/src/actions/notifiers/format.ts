import type { NotificationPayload } from '../types'
import { truncate } from '../../utils/truncate'

export function buildNotificationText(payload: NotificationPayload): string {
  const fields = Object.entries(payload.analysis)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n')

  return [
    `[${payload.analysisConfigName}]`,
    `Chat: ${payload.chatTitle}`,
    `Sender: ${payload.senderName ?? 'unknown'}`,
    `Message: ${truncate(payload.text, 500)}`,
    fields ? `\n${fields}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}