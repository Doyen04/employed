import { prisma } from '../prisma'
import { decryptSecret, encryptSecret } from '../crypto'

const SESSION_KEY = 'telegram.session'

export async function getSessionString(): Promise<string | null> {
    const row = await prisma.setting.findUnique({ where: { key: SESSION_KEY } })
    if (!row) return null
    try {
        return decryptSecret(row.value)
    } catch (error) {
        console.error('[sessionStore] failed to decrypt session:', error)
        return null
    }
}

export async function setSessionString(session: string): Promise<void> {
    const encrypted = encryptSecret(session)
    await prisma.setting.upsert({
        where: { key: SESSION_KEY },
        update: { value: encrypted },
        create: { key: SESSION_KEY, value: encrypted },
    })
}

export async function hasSession(): Promise<boolean> {
    return (await getSessionString()) !== null
}

export async function clearSession(): Promise<void> {
    await prisma.actionLog.deleteMany()
    await prisma.actionRule.deleteMany()
    await prisma.analysis.deleteMany()
    await prisma.message.deleteMany()
    await prisma.chat.deleteMany()
    await prisma.analysisConfig.deleteMany()
    await prisma.notifier.deleteMany()
    await prisma.setting.deleteMany()
    await prisma.user.deleteMany()
}