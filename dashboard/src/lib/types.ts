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

export interface WorkerMessageSummary {
  chatId: string
  title: string
  telegramChatId: string
  messageCount: number
  lastText: string | null
  lastReceivedAt: string | null
}

export interface WorkerAnalysisConfig {
  id: string
  name: string
  promptTemplate: string
  outputSchema: Json
  isActive: boolean
  createdAt: string
  allowedChatIds: string[]
}

export interface WorkerNotifier {
  id: string
  type: NotifierType
  name: string
  isActive: boolean
  configConfigured: boolean
  telegramTargetChatId?: string | null
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
  body: string | null
  recipient: string | null
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

export interface WorkerAnalysis {
  id: string
  analyzedAt: string
  rawResponse: Json
  analysisConfigName: string
  fired: boolean
  message: {
    id: string
    text: string
    senderName: string | null
    receivedAt: string
    chat: ChatRef
  }
  actions: {
    id: string
    status: ActionLogStatus
    retryCount: number
    sentAt: string | null
    errorDetail: string | null
    notifier: { id: string; name: string; type: NotifierType }
  }[]
}

export interface Paged<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

export interface WorkerOverviewAction {
  id: string
  status: ActionLogStatus
  retryCount: number
  sentAt: string | null
  errorDetail: string | null
  notifier: { name: string; type: NotifierType }
  analysis: {
    analysisConfigName: string
    analyzedAt: string
  }
  message: {
    text: string
    senderName: string | null
    receivedAt: string
    chatTitle: string
  }
}

export type DiagnosticsStatus = 'ok' | 'warning' | 'error'

export interface WorkerDiagnostics {
  status: DiagnosticsStatus
  message: string | null
  updatedAt: string | null
  context: { chatTitle: string; messageText: string } | null
}

export interface WorkerOverview {
  counts: {
    chats: { total: number; monitored: number }
    messages: { total: number }
    analysisConfigs: { total: number; active: number }
    rules: { total: number; active: number }
    notifiers: { total: number; active: number }
    actions: {
      sent: number
      failed: number
      pending: number
      successRate: number
    }
  }
  timestamps: {
    latestMessageAt: string | null
    latestAnalysisAt: string | null
    latestActionAt: string | null
  }
  diagnostics: WorkerDiagnostics
  recentMessages: WorkerMessage[]
  recentActions: WorkerOverviewAction[]
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

export interface RealtimeMessageStored {
  message: WorkerMessage
  chat: ChatRef
}

export interface RealtimeChatUpdate {
  id: string
  telegramChatId: string
  title: string
  isMonitored: boolean
  addedAt: string
}