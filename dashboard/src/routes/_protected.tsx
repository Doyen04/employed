import { createFileRoute, Link, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import {
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquare,
  Radar,
  Settings,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { getSession, logout } from '../server/auth'
import { WorkerStatusPill } from '../components/dashboard/WorkerStatusPill'
import ThemeToggle from '../components/ThemeToggle'

type AppPath = '/dashboard' | '/chats' | '/messages' | '/telegram' | '/action-logs' | '/settings'

const NAV: { to: AppPath; label: string; icon: LucideIcon }[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/chats', label: 'Chats', icon: Radar },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/telegram', label: 'Telegram', icon: Zap },
  { to: '/action-logs', label: 'Action Logs', icon: ListChecks },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export const Route = createFileRoute('/_protected')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session.authenticated) {
      throw redirect({ to: '/login' })
    }
  },
  component: AppShell,
})

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const title = NAV.find((item) => item.to === pathname)?.label ?? 'Dashboard'

  async function handleSignOut() {
    try {
      await logout()
    } finally {
      window.location.assign('/login')
    }
  }

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-(--line) bg-[var(--header-bg)] md:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Link to="/" className="inline-flex items-center gap-2 rounded-full font-semibold no-underline">
            <span className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]" />
            <span className="text-sm text-[var(--sea-ink)]">Employed</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              wide
            />
          ))}
        </nav>
        <div className="shrink-0 border-t border-(--line) p-3">
          <button
            onClick={() => void handleSignOut()}
            className="dashboard-nav w-full text-left"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="md:pl-60">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-(--line) bg-[var(--header-bg)] px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex items-center gap-2 md:hidden">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]" />
              <span className="text-sm font-semibold text-[var(--sea-ink)]">Employed</span>
            </div>
            <h1 className="m-0 truncate text-base font-semibold tracking-tight text-[var(--sea-ink)]">
              {title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <WorkerStatusPill />
            <ThemeToggle />
            <button
              onClick={() => void handleSignOut()}
              className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(190,120,60,0.4)] bg-[rgba(190,120,60,0.1)] px-3.5 py-1.5 text-xs font-semibold text-[var(--sea-ink)] md:hidden"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto border-b border-(--line) px-3 py-2 md:hidden">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} label={item.label} icon={item.icon} />
          ))}
        </nav>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function NavLink({
  to,
  label,
  icon: Icon,
  wide,
}: {
  to: AppPath
  label: string
  icon: LucideIcon
  wide?: boolean
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: true }}
      activeProps={{ className: wide ? 'dashboard-nav is-active w-full' : 'dashboard-nav is-active' }}
      className={wide ? 'dashboard-nav w-full' : 'dashboard-nav'}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  )
}