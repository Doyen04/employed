import { prisma } from '../prisma'
import { requireTelegramClient } from './client'

export async function refreshChats(): Promise<number> {
  const client = await requireTelegramClient()
  const dialogs = await client.getDialogs({})

  let count = 0
  for (const dialog of dialogs) {
    const telegramChatId = BigInt(dialog.id.toString())

    await prisma.chat.upsert({
      where: { telegramChatId },
      update: { title: dialog.title },
      create: {
        telegramChatId,
        title: dialog.title,
        isMonitored: false,
      },
    })
    count += 1
  }

  return count
}