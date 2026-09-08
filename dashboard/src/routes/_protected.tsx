import { createFileRoute, Link, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import {
    Activity,
    Bot,
    ChevronRight,
    LayoutDashboard,
    LogOut,
    MessageSquare,
    Radio,
    ScanSearch,
    Send,
    Settings2,
    Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { getSession, logout } from '../server/auth'
import { WorkerStatusPill } from '../components/dashboard/WorkerStatusPill'
import ThemeToggle from '../components/ThemeToggle'

type AppPath = '/dashboard' | '/messages' | '/analyses' | '/chats' | '/telegram' | '/action-logs' | '/settings'

const NAV: { to: AppPath; label: string; description: string; icon: LucideIcon }[] = [
    { to: '/dashboard', label: 'Overview', description: 'System pulse', icon: LayoutDashboard },
    { to: '/messages', label: 'Messages', description: 'Intelligence inbox', icon: MessageSquare },
    { to: '/analyses', label: 'Analyses', description: 'LLM verdicts', icon: ScanSearch },
    { to: '/chats', label: 'Chats', description: 'Monitored sources', icon: Radio },
    { to: '/telegram', label: 'Telegram', description: 'Account connection', icon: Send },
    { to: '/settings', label: 'Automation', description: 'Analyses & rules', icon: Bot },
    { to: '/action-logs', label: 'Action logs', description: 'Delivery activity', icon: Activity },
]

export const Route = createFileRoute('/_protected')({
    beforeLoad: async () => {
        const session = await getSession()
        if (!session.authenticated) throw redirect({ to: '/login' })
    },
    component: AppShell,
})

function AppShell() {
    const pathname = useRouterState({ select: (state) => state.location.pathname })
    const current = NAV.find((item) => item.to === pathname) ?? NAV[0]

    async function handleSignOut() {
        try {
            await logout()
        } finally {
            window.location.assign('/login')
        }
    }

    return (
        <div className="dashboard-shell">
            <aside className="app-sidebar">
                <div className="app-sidebar-brand">
                    <Link to="/" aria-label="Employed home">
                        <span className="brand-mark"><Zap aria-hidden="true" /></span>
                        <span><b>Employed</b><small>Signal intelligence</small></span>
                    </Link>
                </div>

                <div className="sidebar-workspace">
                    <span className="sidebar-workspace-avatar">E</span>
                    <span><b>My workspace</b><small>Private automation</small></span>
                    <ChevronRight aria-hidden="true" />
                </div>

                <nav className="app-sidebar-nav" aria-label="Dashboard navigation">
                    <p>Monitor</p>
                    {NAV.slice(0, 4).map((item) => <SidebarLink key={item.to} item={item} />)}
                    <p>Configure</p>
                    {NAV.slice(4).map((item) => <SidebarLink key={item.to} item={item} />)}
                </nav>

                <div className="sidebar-footer">
                    <button type="button" onClick={() => void handleSignOut()} className="sidebar-signout">
                        <LogOut aria-hidden="true" /><span>Sign out</span>
                    </button>
                </div>
            </aside>

            <div className="app-main-column">
                <header className="app-topbar">
                    <div className="topbar-title">
                        <span className="mobile-brand-mark"><Zap /></span>
                        <div><p>{current.description}</p><h1>{current.label}</h1></div>
                    </div>
                    <div className="topbar-actions">
                        <WorkerStatusPill />
                        <ThemeToggle />
                        <Link to="/settings" className="topbar-settings" aria-label="Open automation settings"><Settings2 /></Link>
                    </div>
                </header>

                <nav className="app-mobile-nav" aria-label="Mobile dashboard navigation">
                    {NAV.map((item) => (
                        <Link key={item.to} to={item.to} activeOptions={{ exact: true }} activeProps={{ className: 'is-active' }}>
                            <item.icon aria-hidden="true" /><span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <main className="app-content"><div className="app-content-inner"><Outlet /></div></main>
            </div>
        </div>
    )
}

function SidebarLink({ item }: { item: (typeof NAV)[number] }) {
    return (
        <Link
            to={item.to}
            activeOptions={{ exact: true }}
            activeProps={{ className: 'sidebar-link is-active' }}
            className="sidebar-link"
        >
            <span className="sidebar-link-icon"><item.icon aria-hidden="true" /></span>
            <span><b>{item.label}</b><small>{item.description}</small></span>
            <ChevronRight className="sidebar-chevron" aria-hidden="true" />
        </Link>
    )
}
