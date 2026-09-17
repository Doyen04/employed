import { useState, useEffect } from 'react'
import { createFileRoute, Link, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import {
    Activity,
    Bot,
    ChevronRight,
    HeartPulse,
    HelpCircle,
    LayoutDashboard,
    LogOut,
    Mail,
    MessageSquare,
    PanelLeftClose,
    PanelLeftOpen,
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
import { isTourCompleted, startTour } from '../lib/tour'

type AppPath =
    | '/dashboard'
    | '/messages'
    | '/analyses'
    | '/mail'
    | '/chats'
    | '/diagnostics'
    | '/telegram'
    | '/settings'
    | '/action-logs'

const NAV: { to: AppPath; label: string; description: string; icon: LucideIcon }[] = [
    { to: '/dashboard', label: 'Overview', description: 'System pulse', icon: LayoutDashboard },
    { to: '/messages', label: 'Messages', description: 'Intelligence inbox', icon: MessageSquare },
    { to: '/analyses', label: 'Analyses', description: 'LLM verdicts', icon: ScanSearch },
    { to: '/mail', label: 'Mail', description: 'Send analysed mail', icon: Mail },
    { to: '/chats', label: 'Chats', description: 'Monitored sources', icon: Radio },
    { to: '/diagnostics', label: 'Diagnostics', description: 'System health', icon: HeartPulse },
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

    const [collapsed, setCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('employed_sidebar_collapsed')
            if (saved !== null) return saved === 'true'
            return window.innerWidth <= 1180
        }
        return false
    })

    const toggleCollapse = () => {
        setCollapsed((prev) => {
            const next = !prev
            if (typeof window !== 'undefined') {
                localStorage.setItem('employed_sidebar_collapsed', String(next))
            }
            return next
        })
    }

    useEffect(() => {
        if (!isTourCompleted()) {
            const timer = setTimeout(() => {
                startTour()
            }, 600)
            return () => clearTimeout(timer)
        }
    }, [])

    async function handleSignOut() {
        try {
            await logout()
        } finally {
            window.location.assign('/login')
        }
    }

    return (
        <div className={`dashboard-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
            <aside className="app-sidebar">
                <div className="app-sidebar-brand">
                    <Link to="/" aria-label="Employed home" title={collapsed ? 'Employed' : undefined}>
                        <span className="brand-mark"><Zap aria-hidden="true" /></span>
                        {!collapsed && (
                            <span><b>Employed</b><small>Signal intelligence</small></span>
                        )}
                    </Link>
                </div>

                <nav className="app-sidebar-nav" aria-label="Dashboard navigation">
                    {!collapsed && <p>Monitor</p>}
                    {NAV.slice(0, 6).map((item) => <SidebarLink key={item.to} item={item} collapsed={collapsed} />)}
                    {!collapsed && <p>Configure</p>}
                    {NAV.slice(6).map((item) => <SidebarLink key={item.to} item={item} collapsed={collapsed} />)}
                </nav>

                <div className="sidebar-footer">
                    <button
                        type="button"
                        onClick={toggleCollapse}
                        className="sidebar-toggle-btn"
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
                        {!collapsed && <span>Collapse sidebar</span>}
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSignOut()}
                        className="sidebar-signout"
                        title={collapsed ? 'Sign out' : undefined}
                    >
                        <LogOut aria-hidden="true" />
                        {!collapsed && <span>Sign out</span>}
                    </button>
                </div>
            </aside>

            <div className="app-main-column">
                <header className="app-topbar">
                    <div className="topbar-title">
                        <button
                            type="button"
                            onClick={toggleCollapse}
                            className="topbar-sidebar-toggle"
                            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
                        </button>
                        <Link to="/" className="topbar-settings topbar-home" aria-label="Go to landing page">
                            <span className="mobile-brand-mark"><Zap /></span>
                        </Link>
                        <div><p>{current.description}</p><h1>{current.label}</h1></div>
                    </div>
                    <div className="topbar-actions">
                        <WorkerStatusPill />
                        <button
                            type="button"
                            onClick={() => startTour()}
                            className="topbar-settings"
                            aria-label="Start interactive guided tour"
                            title="Start interactive guided tour"
                        >
                            <HelpCircle aria-hidden="true" />
                        </button>
                        <ThemeToggle />
                        <Link to="/settings" className="topbar-settings" aria-label="Open automation settings"><Settings2 /></Link>
                    </div>
                </header>

                <main className="app-content"><div className="app-content-inner"><Outlet /></div></main>

                <nav className="app-mobile-nav" aria-label="Mobile dashboard navigation">
                    {NAV.map((item) => (
                        <Link key={item.to} to={item.to} activeOptions={{ exact: true }} activeProps={{ className: 'is-active' }}>
                            <item.icon aria-hidden="true" /><span>{item.label}</span>
                        </Link>
                    ))}
                </nav>
            </div>
        </div>
    )
}

function SidebarLink({ item, collapsed }: { item: (typeof NAV)[number]; collapsed?: boolean }) {
    return (
        <Link
            to={item.to}
            activeOptions={{ exact: true }}
            activeProps={{ className: 'sidebar-link is-active' }}
            className="sidebar-link"
            title={collapsed ? `${item.label} — ${item.description}` : undefined}
        >
            <span className="sidebar-link-icon"><item.icon aria-hidden="true" /></span>
            {!collapsed && (
                <span><b>{item.label}</b><small>{item.description}</small></span>
            )}
            {!collapsed && <ChevronRight className="sidebar-chevron" aria-hidden="true" />}
        </Link>
    )
}
