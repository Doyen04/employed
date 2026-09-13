import { prisma } from './prisma'
import { emitDiagnosticsUpdate } from './socket/server'
import { safeJsonParse } from './utils/json'
import { Prisma, type Diagnostic } from './generated/prisma/client'

export type DiagnosticSeverity = 'warning' | 'error'
export type DiagnosticsStatus = 'ok' | 'warning' | 'error'

export const DIAGNOSTIC_RECENT_WINDOW_MS = 15 * 60 * 1000

export interface DiagnosticContext {
    chatTitle: string
    messageText: string
}

export interface DiagnosticLogEntry {
    id: string
    key: string
    severity: DiagnosticSeverity
    message: string
    createdAt: string
    context: DiagnosticContext | null
}

export interface DiagnosticStatusSummary {
    status: DiagnosticsStatus
    message: string | null
    updatedAt: string | null
    context: DiagnosticContext | null
}

export interface DiagnosticPage {
    items: DiagnosticLogEntry[]
    nextCursor: string | null
    hasMore: boolean
}

function toEntry(row: Diagnostic): DiagnosticLogEntry {
    return {
        id: row.id,
        key: row.key,
        severity: row.severity === 'error' ? 'error' : 'warning',
        message: row.message,
        createdAt: row.createdAt.toISOString(),
        context: row.context
            ? safeJsonParse<DiagnosticContext>(JSON.stringify(row.context), { chatTitle: '', messageText: '' })
            : null,
    }
}

export async function reportDiagnostic(
    key: string,
    severity: DiagnosticSeverity,
    message: string,
    context?: DiagnosticContext | null,
): Promise<void> {
    const contextValue: Prisma.InputJsonValue | typeof Prisma.JsonNull = context
        ? (context as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull
    await prisma.diagnostic.create({
        data: { key, severity, message, context: contextValue },
    })
    await emitDiagnosticsUpdate(await getDiagnosticsStatus())
}

export async function listDiagnostics(options: {
    cursor?: string
    limit?: number
    severity?: DiagnosticSeverity
    query?: string
}): Promise<DiagnosticPage> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)
    const { cursor, severity, query } = options

    const where: Prisma.DiagnosticWhereInput = {}
    if (severity) where.severity = severity
    if (query && query.trim()) {
        where.OR = [
            { key: { contains: query.trim(), mode: 'insensitive' } },
            { message: { contains: query.trim(), mode: 'insensitive' } },
        ]
    }

    const rows = await prisma.diagnostic.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })

    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null

    return { items: items.map(toEntry), nextCursor, hasMore }
}

export async function getDiagnosticsStatus(): Promise<DiagnosticStatusSummary> {
    const since = new Date(Date.now() - DIAGNOSTIC_RECENT_WINDOW_MS)
    const recent = await prisma.diagnostic.findMany({
        where: { createdAt: { gte: since } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })

    if (recent.length === 0) {
        return { status: 'ok', message: null, updatedAt: null, context: null }
    }

    const worst =
        recent.find((row) => row.severity === 'error') ??
        recent.find((row) => row.severity === 'warning') ??
        recent[0]

    return {
        status: worst.severity === 'error' ? 'error' : 'warning',
        message: worst.message,
        updatedAt: worst.createdAt.toISOString(),
        context: worst.context
            ? safeJsonParse<DiagnosticContext>(JSON.stringify(worst.context), { chatTitle: '', messageText: '' })
            : null,
    }
}

export async function deleteDiagnostic(id: string): Promise<boolean> {
    const existing = await prisma.diagnostic.findUnique({ where: { id } })
    if (!existing) return false
    await prisma.diagnostic.delete({ where: { id } })
    await emitDiagnosticsUpdate(await getDiagnosticsStatus())
    return true
}

export async function clearAllDiagnostics(): Promise<void> {
    const { count } = await prisma.diagnostic.deleteMany()
    if (count > 0) {
        await emitDiagnosticsUpdate(await getDiagnosticsStatus())
    }
}