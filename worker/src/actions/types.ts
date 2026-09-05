export interface NotificationPayload {
  chatTitle: string
  senderName: string | null
  text: string
  receivedAt: string
  analysisConfigName: string
  analysis: Record<string, unknown>
}

export interface NotifierResult {
  status: 'sent' | 'failed'
  error?: string
}

export interface Notifier {
  send(payload: NotificationPayload, config: Record<string, unknown>): Promise<NotifierResult>
}