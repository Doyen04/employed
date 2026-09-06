import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie } from '@tanstack/react-start/server'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const SESSION_COOKIE = 'employed_auth'
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

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function sign(value: string): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET is not set — add it to dashboard/.env.local')
  }
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function createSessionToken(): string {
  const raw = randomBytes(32).toString('base64url')
  return `${raw}.${sign(raw)}`
}

function isSessionValid(value: string | undefined): boolean {
  if (!value) return false
  const dot = value.lastIndexOf('.')
  if (dot === -1) return false
  return safeEqual(sign(value.slice(0, dot)), value.slice(dot + 1))
}

function authError(message: string): Error & { status: number } {
  const error = new Error(message) as Error & { status: number }
  error.status = 401
  return error
}

/** Throw (401) when the request cookie is not a valid admin session. */
export const requireAuthed = createServerFn({
  method: 'GET',
}).handler(async () => {
  if (!isSessionValid(getCookie(SESSION_COOKIE))) {
    throw authError('unauthorized')
  }
})

export const getSession = createServerFn().handler(async () => ({
  authenticated: isSessionValid(getCookie(SESSION_COOKIE)),
}))

export const login = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (typeof input !== 'string' || input.length === 0) {
      throw new Error('password is required')
    }
    return input
  })
  .handler(async ({ data: password }) => {
    const expected = process.env.DASHBOARD_ADMIN_PASSWORD ?? ''
    if (expected.length === 0 || !safeEqual(password, expected)) {
      throw authError('invalid password')
    }
    setCookie(SESSION_COOKIE, createSessionToken(), cookieOptions())
    return { ok: true }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  setCookie(SESSION_COOKIE, '', cookieOptions(0))
  return { ok: true }
})