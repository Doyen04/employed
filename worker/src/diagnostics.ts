import { prisma } from './prisma'
import { emitDiagnosticsUpdate } from './socket/server'
import { safeJsonParse } from './utils/json'
import { Prisma, type Diagnostic } from './generated/prisma/client'

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

function toIssue(row: Diagnostic): DiagnosticIssue {
    return {
        key: row.key,
        severity: row.severity === 'error' ? 'error' : 'warning',
        message: row.message,
        updatedAt: row.lastReported.toISOString(),
        context: row.context
            ? safeJsonParse<DiagnosticContext>(JSON.stringify(row.context), { chatTitle: '', messageText: '' })
            : null,
    }
}

export async function getDiagnosticsState(): Promise<DiagnosticsState> {
    const rows = await prisma.diagnostic.findMany()
    return normalize(rows.map(toIssue))
}

export async function reportDiagnostic(
    key: string,
    severity: DiagnosticSeverity,
    message: string,
    context?: DiagnosticContext | null,
): Promise<void> {
    const nextContext = context ?? null
    const existing = await prisma.diagnostic.findUnique({ where: { key } })
    if (
        existing &&
        existing.severity === severity &&
        existing.message === message &&
        JSON.stringify(existing.context) === JSON.stringify(nextContext)
    ) {
        return
    }

    const contextValue: Prisma.InputJsonValue | typeof Prisma.JsonNull = nextContext
        ? (nextContext as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull
    await prisma.diagnostic.upsert({
        where: { key },
        update: {
            severity,
            message,
            context: contextValue,
            lastReported: new Date(),
        },
        create: {
            key,
            severity,
            message,
            context: contextValue,
        },
    })
    await emitDiagnosticsUpdate(await getDiagnosticsState())
}

export async function clearDiagnostic(key: string): Promise<void> {
    const existing = await prisma.diagnostic.findUnique({ where: { key } })
    if (!existing) return
    await prisma.diagnostic.delete({ where: { key } })
    await emitDiagnosticsUpdate(await getDiagnosticsState())
}

export async function clearAllDiagnostics(): Promise<void> {
    await prisma.diagnostic.deleteMany()
    await emitDiagnosticsUpdate(await getDiagnosticsState())
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