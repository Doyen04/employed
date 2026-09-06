import { Router } from 'express'

import { prisma } from '../../prisma'

export const overviewRouter = Router()

overviewRouter.get('/', async (_req, res) => {
  const [
    totalChats,
    monitoredChats,
    totalMessages,
    totalAnalysisConfigs,
    activeAnalysisConfigs,
    totalRules,
    activeRules,
    totalNotifiers,
    activeNotifiers,
    latestAnalysis,
    recentMessages,
    sentActions,
    failedActions,
    pendingActions,
    recentActions,
  ] = await prisma.$transaction([
    prisma.chat.count(),
    prisma.chat.count({ where: { isMonitored: true } }),
    prisma.message.count(),
    prisma.analysisConfig.count(),
    prisma.analysisConfig.count({ where: { isActive: true } }),
    prisma.actionRule.count(),
    prisma.actionRule.count({ where: { isActive: true } }),
    prisma.notifier.count(),
    prisma.notifier.count({ where: { isActive: true } }),
    prisma.analysis.findFirst({
      orderBy: [{ analyzedAt: 'desc' }, { id: 'desc' }],
      select: { analyzedAt: true },
    }),
    prisma.message.findMany({
      take: 5,
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      include: { chat: true },
    }),
    prisma.actionLog.count({ where: { status: 'sent' } }),
    prisma.actionLog.count({ where: { status: 'failed' } }),
    prisma.actionLog.count({ where: { status: 'pending' } }),
    prisma.actionLog.findMany({
      take: 5,
      orderBy: [{ analysis: { analyzedAt: 'desc' } }, { id: 'desc' }],
      select: {
        id: true,
        status: true,
        retryCount: true,
        sentAt: true,
        errorDetail: true,
        notifier: { select: { name: true, type: true } },
        analysis: {
          select: {
            analyzedAt: true,
            analysisConfig: { select: { name: true } },
            message: {
              select: {
                text: true,
                senderName: true,
                receivedAt: true,
                chat: { select: { title: true } },
              },
            },
          },
        },
      },
    }),
  ])

  const completedActions = sentActions + failedActions

  res.json({
    counts: {
      chats: { total: totalChats, monitored: monitoredChats },
      messages: { total: totalMessages },
      analysisConfigs: { total: totalAnalysisConfigs, active: activeAnalysisConfigs },
      rules: { total: totalRules, active: activeRules },
      notifiers: { total: totalNotifiers, active: activeNotifiers },
      actions: {
        sent: sentActions,
        failed: failedActions,
        pending: pendingActions,
        successRate: completedActions === 0 ? 0 : (sentActions / completedActions) * 100,
      },
    },
    timestamps: {
      latestMessageAt: recentMessages[0]?.receivedAt.toISOString() ?? null,
      latestAnalysisAt: latestAnalysis?.analyzedAt.toISOString() ?? null,
      latestActionAt: recentActions[0]?.analysis.analyzedAt.toISOString() ?? null,
    },
    recentMessages: recentMessages.map((message) => ({
      id: message.id,
      chatId: message.chatId,
      telegramMessageId: message.telegramMessageId,
      senderName: message.senderName,
      text: message.text,
      receivedAt: message.receivedAt.toISOString(),
      chat: {
        id: message.chat.id,
        title: message.chat.title,
        telegramChatId: message.chat.telegramChatId.toString(),
      },
    })),
    recentActions: recentActions.map((action) => ({
      id: action.id,
      status: action.status,
      retryCount: action.retryCount,
      sentAt: action.sentAt?.toISOString() ?? null,
      errorDetail: action.errorDetail,
      notifier: action.notifier,
      analysis: {
        analysisConfigName: action.analysis.analysisConfig.name,
        analyzedAt: action.analysis.analyzedAt.toISOString(),
      },
      message: {
        text: action.analysis.message.text,
        senderName: action.analysis.message.senderName,
        receivedAt: action.analysis.message.receivedAt.toISOString(),
        chatTitle: action.analysis.message.chat.title,
      },
    })),
  })
})
