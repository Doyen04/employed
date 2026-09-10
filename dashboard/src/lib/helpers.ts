/**
 * Shared UI helper functions used across multiple route files.
 *
 * Kept here to avoid copy-pasting identical utilities into every page.
 */

export function initials(value: string): string {
    return value.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'TG'
}

export function formatDateTime(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleString()
}

export function relativeTime(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    const seconds = Math.round((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

export function truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max)}…` : value
}
