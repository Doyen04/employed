export function parseLimit(query: unknown, defaultValue = 50, max = 200): number {
    return Math.min(Math.max(Number(query ?? defaultValue), 1), max)
}

export function parseCursor(query: unknown): string | undefined {
    return typeof query === 'string' ? query : undefined
}

export interface PageResult<T> {
    items: T[]
    nextCursor: string | null
    hasMore: boolean
}

export function buildPage<T extends { id: string }>(rows: T[], limit: number): PageResult<T> {
    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null
    return { items, nextCursor, hasMore }
}
