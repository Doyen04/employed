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