-- CreateEnum
CREATE TYPE "NotifierType" AS ENUM ('telegram', 'email', 'webhook', 'push', 'slack');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "isMonitored" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramMessageId" INTEGER NOT NULL,
    "senderName" TEXT,
    "text" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "outputSchema" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "analysisConfigId" TEXT NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionRule" (
    "id" TEXT NOT NULL,
    "analysisConfigId" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "notifierId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ActionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notifier" (
    "id" TEXT NOT NULL,
    "type" "NotifierType" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Notifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionLog" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "notifierId" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "errorDetail" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chat_telegramChatId_key" ON "Chat"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_chatId_telegramMessageId_key" ON "Message"("chatId", "telegramMessageId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_analysisConfigId_fkey" FOREIGN KEY ("analysisConfigId") REFERENCES "AnalysisConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRule" ADD CONSTRAINT "ActionRule_analysisConfigId_fkey" FOREIGN KEY ("analysisConfigId") REFERENCES "AnalysisConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRule" ADD CONSTRAINT "ActionRule_notifierId_fkey" FOREIGN KEY ("notifierId") REFERENCES "Notifier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_notifierId_fkey" FOREIGN KEY ("notifierId") REFERENCES "Notifier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
