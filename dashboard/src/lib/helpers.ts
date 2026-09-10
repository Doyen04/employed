/**
 * Shared UI helper functions used across multiple route files.
 *
 * Kept here to avoid copy-pasting identical utilities into every page.
 */
import type { Json } from './types'

export function initials(value: string): string {
    return value.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'TG'
}

export function formatDateTime(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleString()
}

export function formatTime(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
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

export function dayKeyOf(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return 'unknown'
    return date.toDateString()
}

export function dayLabel(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return 'Unknown date'
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const diffDays = Math.round((startOfDay.getTime() - startOfTarget.getTime()) / 86_400_000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    return date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
    })
}

export function formatNumber(value: number): string {
    return new Intl.NumberFormat().format(value)
}

export function formatPercent(value: number): string {
    return `${Math.round(value)}%`
}

export function timeLabel(value: string | null, fallback = '—'): string {
    if (!value) return fallback
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return fallback
    const seconds = Math.round((date.getTime() - Date.now()) / 1000)
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
    if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second')
    const minutes = Math.round(seconds / 60)
    if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute')
    const hours = Math.round(minutes / 60)
    if (Math.abs(hours) < 24) return formatter.format(hours, 'hour')
    return formatter.format(Math.round(hours / 24), 'day')
}

export function verdictEntries(json: Json): [string, string][] {
    if (json === null || Array.isArray(json) || typeof json !== 'object') return []
    return Object.entries(json as Record<string, unknown>).map(([key, val]) => [
        key,
        typeof val === 'object' ? JSON.stringify(val) : String(val),
    ])
}

export function verdictSummary(json: Json): string {
    const entries = verdictEntries(json)
    if (entries.length === 0) {
        return typeof json === 'string' ? truncate(json, 40) : '—'
    }
    return entries
        .slice(0, 2)
        .map(([key, value]) => `${key}: ${truncate(value, 24)}`)
        .join(' · ')
}
