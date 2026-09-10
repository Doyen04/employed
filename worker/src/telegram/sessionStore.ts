import { prisma } from '../prisma'
import { decryptSecret, encryptSecret } from '../crypto'
import { getSetting, setSetting } from '../prisma/settings'

const SESSION_KEY = 'telegram.session'

export async function getSessionString(): Promise<string | null> {
    const raw = await getSetting(SESSION_KEY)
    if (!raw) return null
    try {
        return decryptSecret(raw)
    } catch (error) {
        console.error('[sessionStore] failed to decrypt session:', error)
        return null
    }
}

export async function setSessionString(session: string): Promise<void> {
    await setSetting(SESSION_KEY, encryptSecret(session))
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