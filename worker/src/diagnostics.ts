import { prisma } from './prisma'

const KEY = 'system.diagnostics'

export type DiagnosticSeverity = 'warning' | 'error'
export type DiagnosticsStatus = 'ok' | 'warning' | 'error'

export interface DiagnosticContext {
    chatTitle: string
    messageText: string
}

export interface DiagnosticIssue {
    key: string
    severity: DiagnosticSeverity
    message: string
    updatedAt: string
    context: DiagnosticContext | null
}

export interface DiagnosticsState {
    status: DiagnosticsStatus
    issues: DiagnosticIssue[]
    message: string | null
    updatedAt: string | null
    context: DiagnosticContext | null
}

export async function getDiagnosticsState(): Promise<DiagnosticsState> {
    const row = await prisma.setting.findUnique({ where: { key: KEY } })
    if (!row) return normalize([])
    try {
        const parsed = JSON.parse(row.value) as { issues?: DiagnosticIssue[] }
        return normalize(parsed.issues ?? [])
    } catch {
        return normalize([])
    }
}

export async function reportDiagnostic(
    key: string,
    severity: DiagnosticSeverity,
    message: string,
    context?: DiagnosticContext | null,
): Promise<void> {
    const current = await getDiagnosticsState()
    const existing = current.issues.find((issue) => issue.key === key)
    const nextContext = context ?? null
    if (
        existing &&
        existing.severity === severity &&
        existing.message === message &&
        JSON.stringify(existing.context) === JSON.stringify(nextContext)
    ) {
        return
    }

    const issue: DiagnosticIssue = {
        key,
        severity,
        message,
        updatedAt: new Date().toISOString(),
        context: nextContext,
    }
    const issues = [...current.issues.filter((entry) => entry.key !== key), issue]
    await persist(normalize(issues))
}

export async function clearDiagnostic(key: string): Promise<void> {
    const current = await getDiagnosticsState()
    if (!current.issues.some((issue) => issue.key === key)) return
    await persist(normalize(current.issues.filter((issue) => issue.key !== key)))
}

export async function clearAllDiagnostics(): Promise<void> {
    await persist(normalize([]))
}

function normalize(issues: DiagnosticIssue[]): DiagnosticsState {
    const worst: DiagnosticIssue | undefined = issues.reduce<DiagnosticIssue | undefined>(
        (best, issue) => {
            if (!best) return issue
            const bestRank = best.severity === 'error' ? 1 : 0
            const issueRank = issue.severity === 'error' ? 1 : 0
            if (issueRank !== bestRank) return issueRank > bestRank ? issue : best
            return issue.updatedAt > best.updatedAt ? issue : best
        },
        undefined,
    )

    return {
        status: worst?.severity ?? 'ok',
        issues,
        message: worst?.message ?? null,
        updatedAt: worst?.updatedAt ?? null,
        context: worst?.context ?? null,
    }
}

async function persist(state: DiagnosticsState): Promise<void> {
    await prisma.setting.upsert({
        where: { key: KEY },
        update: { value: JSON.stringify(state), updatedAt: new Date() },
        create: { key: KEY, value: JSON.stringify(state) },
    })
}