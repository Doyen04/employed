import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie } from '@tanstack/react-start/server'

const SESSION_COOKIE = 'employed_auth'
const JWT_ISSUER = 'employed-dashboard'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function cookieOptions(maxAge?: number) {
    return {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: maxAge ?? MAX_AGE_SECONDS,
    }
}

function authError(message: string): Error & { status: number } {
    const error = new Error(message) as Error & { status: number }
    error.status = 401
    return error
}

/** Rejects a token unless it is a valid JWT signed with AUTH_SECRET for this app. */
async function isSessionValid(token: string | undefined): Promise<boolean> {
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

/** Guard for proxying server functions — throws 401 when the request has no valid session. */
export async function requireAuthed(): Promise<void> {
    if (!(await isSessionValid(getCookie(SESSION_COOKIE)))) {
        throw authError('unauthorized')
    }
}

export const getSession = createServerFn().handler(async () => ({
    authenticated: await isSessionValid(getCookie(SESSION_COOKIE)),
}))

export const login = createServerFn({ method: 'POST' })
    .validator((input: unknown) => {
        if (typeof input !== 'string' || input.length === 0) {
            throw new Error('password is required')
        }
        return input
    })
    .handler(async ({ data: password }) => {
        const secret = process.env.AUTH_SECRET
        const hash = process.env.DASHBOARD_ADMIN_PASSWORD_HASH
        if (!secret || !hash) {
            throw authError('admin auth is not configured')
        }
        const { compare } = await import('bcryptjs')
        const valid = await compare(password, hash)
        if (!valid) {
            throw authError('invalid password')
        }
        const jwt = (await import('jsonwebtoken')).default
        const token = jwt.sign({ sub: 'admin' }, secret, {
            expiresIn: MAX_AGE_SECONDS,
            issuer: JWT_ISSUER,
            audience: JWT_ISSUER,
        })
        setCookie(SESSION_COOKIE, token, cookieOptions())
        return { ok: true }
    })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
    setCookie(SESSION_COOKIE, '', cookieOptions(0))
    return { ok: true }
})