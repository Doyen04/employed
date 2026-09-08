import type { NotificationPayload } from '../types'

export function buildNotificationText(payload: NotificationPayload): string {
  const fields = Object.entries(payload.analysis)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n')

  const text = payload.text.length > 500 ? `${payload.text.slice(0, 500)}…` : payload.text

  return [
    `[${payload.analysisConfigName}]`,
    `Chat: ${payload.chatTitle}`,
    `Sender: ${payload.senderName ?? 'unknown'}`,
    `Message: ${text}`,
    fields ? `\n${fields}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}