import type { NotificationPayload } from '../types'

export function buildNotificationText(payload: NotificationPayload): string {
  const fields = Object.entries(payload.analysis)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n')

  const json = JSON.stringify(payload.analysis, null, 2)

  return [
    `[${payload.analysisConfigName}] · Sender: ${payload.senderName ?? 'unknown'}`,
    fields ? `\n${fields}` : '',
    json ? `\n\`\`\`json\n${json}\n\`\`\`` : '',
  ]
    .filter(Boolean)
    .join('\n')
}