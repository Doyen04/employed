import './config'
import { prisma } from './prisma'
import { startServer } from './server'
import { startTelegramListener } from './telegram/listener'

async function main() {
  await prisma.$connect()

  const httpServer = startServer()

  let telegramStarted = false
  try {
    telegramStarted = await startTelegramListener()
  } catch (error) {
    console.error('[main] failed to start telegram listener:', error)
  }

  if (!telegramStarted) {
    console.log('[main] no telegram session found — run `npm run login` to authenticate')
  }

  const shutdown = async () => {
    console.log('[main] shutting down')
    try {
      await prisma.$disconnect()
    } catch {
      // ignore disconnect errors during shutdown
    }
    httpServer.close()
    setTimeout(() => process.exit(0), 500)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((error) => {
  console.error('[main] fatal:', error)
  process.exit(1)
})