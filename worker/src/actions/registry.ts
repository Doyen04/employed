import { emailNotifier } from './notifiers/email'
import { telegramNotifier } from './notifiers/telegram'
import { webhookNotifier } from './notifiers/webhook'
import type { Notifier } from './types'

export const notifierRegistry: Record<string, Notifier> = {
  telegram: telegramNotifier,
  email: emailNotifier,
  webhook: webhookNotifier,
}