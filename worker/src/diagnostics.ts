import { prisma } from './prisma'

const KEY = 'system.diagnostics'

export interface DiagnosticsContext {
  chatTitle: string
  messageText: string
}

export interface DiagnosticsState {
  status: 'ok' | 'warning' | 'error'
  message: string | null
  updatedAt: string | null
  context: DiagnosticsContext | null
}

const IDLE: DiagnosticsState = { status: 'ok', message: null, updatedAt: null, context: null }

export async function getDiagnosticsState(): Promise<DiagnosticsState> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } })
  if (!row) return { ...IDLE }
  try {
    return { ...IDLE, ...(JSON.parse(row.value) as Partial<DiagnosticsState>) }
  } catch {
    return { ...IDLE }
  }
}

export async function updateDiagnosticsState(next: DiagnosticsState): Promise<void> {
  const current = await getDiagnosticsState()
  if (JSON.stringify(current) === JSON.stringify(next)) return

  await prisma.setting.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(next), updatedAt: new Date() },
    create: { key: KEY, value: JSON.stringify(next) },
  })
}