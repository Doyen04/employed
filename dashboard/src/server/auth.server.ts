import { getCookie, setCookie } from '@tanstack/react-start/server'

export { getCookie, setCookie }

export const SESSION_COOKIE = 'employed_auth'
export const JWT_ISSUER = 'employed-dashboard'
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export function cookieOptions(maxAge?: number) {
    return {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: maxAge ?? MAX_AGE_SECONDS,
    }
}

export function authError(message: string): Error & { status: number } {
    const error = new Error(message) as Error & { status: number }
    error.status = 401
    return error
}

/** Rejects a token unless it is a valid JWT signed with AUTH_SECRET for this app. */
export async function isSessionValid(token: string | undefined): Promise<boolean> {
    if (!token) return false
    const secret = process.env.AUTH_SECRET
    if (!secret) return false
    try {
        const jwt = (await import('jsonwebtoken')).default
        jwt.verify(token, secret, { issuer: JWT_ISSUER })
        return true
    } catch {
        return false
    }
}

export async function isSessionAuthed(): Promise<boolean> {
    return isSessionValid(getCookie(SESSION_COOKIE))
}

/** Throws a 401 when the current request has no valid admin session. */
export async function requireAuthed(): Promise<void> {
    if (!(await isSessionAuthed())) throw authError('unauthorized')
}