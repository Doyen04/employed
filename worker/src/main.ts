import './config'
import { prisma } from './prisma'
import { startServer } from './server'
import { startTelegramListener } from './telegram/listener'
import { reportDiagnostic } from './diagnostics'
import { getErrorMessage } from './utils/errors'

async function main() {
    try {
        await prisma.$connect()
    } catch (error) {
        console.error('[main] database connection failed:', error)
        await reportDiagnostic(
            'db.connection',
            'error',
            `Database connection failed: ${getErrorMessage(error)}`,
        )
        throw error
    }

    const httpServer = startServer()

    let telegramStarted = false
    try {
        telegramStarted = await startTelegramListener()
    } catch (error) {
        console.error('[main] failed to start telegram listener:', error)
        await reportDiagnostic(
            'system.startup',
            'error',
            `Telegram listener failed to start: ${getErrorMessage(error)}`,
        )
    }

    if (!telegramStarted) {
        console.log('[main] no telegram session found — run `npm run login` to authenticate')
        await reportDiagnostic(
            'telegram.session',
            'warning',
            'No Telegram session — sign in via the Telegram settings page or `npm run login`.',
        )
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