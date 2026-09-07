import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'

import { getSession, login } from '../server/auth'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const session = await getSession()
    if (session.authenticated) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login({ data: password })
      await navigate({ to: '/dashboard' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'login failed')
      setBusy(false)
    }
  }

  return (
    <main className="page-wrap flex justify-center px-4 pb-16 pt-20">
      <section className="island-shell rise-in w-full max-w-md rounded-[2rem] px-6 py-8 sm:px-10">
        <p className="island-kicker mb-2">Employed</p>
        <h1 className="display-title mb-1 text-3xl font-bold tracking-tight text-[var(--sea-ink)]">
          Sign in
        </h1>
        <p className="mb-6 text-sm text-[var(--sea-ink-soft)]">
          Enter the admin password to open the dashboard.
        </p>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--sea-ink)]">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoFocus
              placeholder="••••••••"
              className="rounded-xl border border-[var(--line)] bg-[var(--header-bg)] px-4 py-2.5 font-normal text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon)] focus:ring-2 focus:ring-[var(--lagoon)]/20"
            />
          </label>

          {error && (
            <p role="alert" className="m-0 text-sm text-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !password}
            className="rounded-full bg-[linear-gradient(135deg,#ECB914,#F6D579)] px-5 py-2.5 text-sm font-semibold text-[#4F3D35] transition hover:-translate-y-0.5 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}