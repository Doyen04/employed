export type NotifierType = 'telegram' | 'email' | 'webhook' | 'push' | 'slack'

/** JSON-compatible value — required for fields that cross the server-fn RPC boundary. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

export interface WorkerChat {
  id: string
  telegramChatId: string
  title: string
  isMonitored: boolean
  addedAt: string
}

export interface ChatRef {
  id: string
  title: string
  telegramChatId: string
}

export interface WorkerMessage {
  id: string
  chatId: string
  telegramMessageId: number
  senderName: string | null
  text: string
  receivedAt: string
  chat: ChatRef
}

export interface WorkerAnalysisConfig {
  id: string
  name: string
  promptTemplate: string
  outputSchema: Json
  isActive: boolean
  createdAt: string
}

export interface WorkerNotifier {
  id: string
  type: NotifierType
  name: string
  isActive: boolean
  configConfigured: boolean
}

export interface WorkerActionRule {
  id: string
  analysisConfigId: string
  condition: Json
  notifierId: string
  notifierName: string
  notifierType: NotifierType
  isActive: boolean
}

export interface WorkerSettings {
  analysisConfigs: WorkerAnalysisConfig[]
  actionRules: WorkerActionRule[]
  notifiers: WorkerNotifier[]
}

export type ActionLogStatus = 'pending' | 'sent' | 'failed'

export interface WorkerActionLog {
  id: string
  status: ActionLogStatus
  retryCount: number
  sentAt: string | null
  errorDetail: string | null
  notifier: { id: string; name: string; type: NotifierType }
  analysis: {
    id: string
    analyzedAt: string
    rawResponse: Json
    analysisConfigName: string
    message: {
      id: string
      text: string
      senderName: string | null
      receivedAt: string
      chat: ChatRef
    }
  }
}

export interface Paged<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

export type TelegramLoginState =
  | { state: 'idle' }
  | { state: 'started' }
  | { state: 'awaitingCode' }
  | { state: 'awaitingPassword'; hint?: string }
  | { state: 'done' }
  | { state: 'error'; error: string }

export interface WorkerTelegramStatus {
  loggedIn: boolean
  login: TelegramLoginState
}

export interface RealtimeMessageNew {
  message: WorkerMessage
  chat: ChatRef
  analysis: unknown
  analysisConfigName: string
}

export interface RealtimeChatUpdate {
  id: string
  telegramChatId: string
  title: string
  isMonitored: boolean
  addedAt: string
}