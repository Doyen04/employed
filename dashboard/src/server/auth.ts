import { createServerFn } from '@tanstack/react-start'

/** RPC guard — throws 401 when the request has no valid admin session. */
export const requireAuthed = createServerFn().handler(async () => {
    const auth = await import('./auth.server')
    await auth.requireAuthed()
})

export const getSession = createServerFn().handler(async () => {
    const auth = await import('./auth.server')
    return { authenticated: await auth.isSessionAuthed() }
})

export const login = createServerFn({ method: 'POST' })
    .validator((input: unknown) => {
        if (typeof input !== 'string' || input.length === 0) {
            throw new Error('password is required')
        }
        return input
    })
    .handler(async ({ data: password }) => {
        const auth = await import('./auth.server')
        const secret = process.env.AUTH_SECRET
        const hash = process.env.DASHBOARD_ADMIN_PASSWORD_HASH
        if (!secret || !hash) {
            throw auth.authError('admin auth is not configured')
        }
        const { compare } = await import('bcryptjs')
        const valid = await compare(password, hash)
        if (!valid) {
            throw auth.authError('invalid password')
        }
        const jwt = (await import('jsonwebtoken')).default
        const token = jwt.sign({ sub: 'admin' }, secret, {
            expiresIn: auth.MAX_AGE_SECONDS,
            issuer: auth.JWT_ISSUER,
            audience: auth.JWT_ISSUER,
        })
        auth.setCookie(auth.SESSION_COOKIE, token, auth.cookieOptions())
        return { ok: true }
    })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
    const auth = await import('./auth.server')
    auth.setCookie(auth.SESSION_COOKIE, '', auth.cookieOptions(0))
    return { ok: true }
})