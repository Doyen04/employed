import { decryptSecret, encryptSecret } from '../crypto'

export function safeJsonParse<T = unknown>(text: string, fallback: T): T {
    try {
        return JSON.parse(text) as T
    } catch {
        return fallback
    }
}

export function encryptJson(value: unknown): string {
    return encryptSecret(JSON.stringify(value))
}

export function decryptJson<T = unknown>(encrypted: string, fallback: T): T {
    try {
        return JSON.parse(decryptSecret(encrypted)) as T
    } catch {
        return fallback
    }
}
