import './config'
import { prisma } from './prisma'
import { startServer } from './server'
import { startTelegramListener } from './telegram/listener'
import { clearDiagnostic, getDiagnosticsState, reportDiagnostic } from './diagnostics'

async function main() {
  try {
    await prisma.$connect()
  } catch (error) {
    console.error('[main] database connection failed:', error)
    await reportDiagnostic(
      'db.connection',
      'error',
      `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    throw error
  }
  await clearDiagnostic('db.connection')

  const httpServer = startServer()

  let telegramStarted = false
  try {
    telegramStarted = await startTelegramListener()
  } catch (error) {
    console.error('[main] failed to start telegram listener:', error)
    await reportDiagnostic(
      'system.startup',
      'error',
      `Telegram listener failed to start: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (!telegramStarted) {
    console.log('[main] no telegram session found — run `npm run login` to authenticate')
    const state = await getDiagnosticsState()
    const hasSessionIssue = state.issues.some((issue) => issue.key === 'telegram.session')
    if (!hasSessionIssue) {
      await reportDiagnostic(
        'telegram.session',
        'warning',
        'No Telegram session — sign in via the Telegram settings page or `npm run login`.',
      )
    }
  } else {
    await clearDiagnostic('telegram.session')
    await clearDiagnostic('system.startup')
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