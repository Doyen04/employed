import type { Notifier, NotifierResult, NotificationPayload } from '../types'

export const webhookNotifier: Notifier = {
  async send(payload, config): Promise<NotifierResult> {
    const rawUrl = (config as { url?: unknown }).url
    if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
      return { status: 'failed', error: 'webhook notifier requires config.url' }
    }

    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      return { status: 'failed', error: 'invalid webhook URL' }
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { status: 'failed', error: 'webhook URL must be http(s)' }
    }

    const headers = (config as { headers?: Record<string, string> }).headers ?? {}

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        return { status: 'failed', error: `webhook responded with ${response.status}` }
      }
      return { status: 'sent' }
    } catch (error) {
      return { status: 'failed', error: (error as Error).message }
    }
  },
}