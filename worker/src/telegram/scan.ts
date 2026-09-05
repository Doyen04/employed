import { prisma } from '../prisma'
import { requireTelegramClient } from './client'

export async function refreshChats(): Promise<number> {
  const client = await requireTelegramClient()
  const dialogs = await client.getDialogs({})

  let count = 0
  for (const dialog of dialogs) {
    if (dialog.id === undefined || dialog.id === null) continue
    const telegramChatId = BigInt(dialog.id.toString())
    const title = typeof dialog.title === 'string' ? dialog.title : String(telegramChatId)

    await prisma.chat.upsert({
      where: { telegramChatId },
      update: { title },
      create: {
        telegramChatId,
        title,
        isMonitored: false,
      },
    })
    count += 1
  }

  return count
}