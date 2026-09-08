import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
    AlertTriangle,
    ArrowRight,
    Bot,
    CheckCircle2,
    Clock3,
    MessageSquare,
    Radio,
    RefreshCw,
    Send,
    Settings2,
    Webhook,
    Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { getOverview } from '../../server/overview'
import { getTelegramStatus } from '../../server/telegram'
import { DiagnosticsBanner } from '../../components/dashboard/DiagnosticsBanner'
import { LiveFeed } from '../../components/dashboard/LiveFeed'
import { PageSkeleton } from '../../components/dashboard/PageSkeleton'
import type { WorkerOverview, WorkerOverviewAction, WorkerTelegramStatus } from '../../lib/types'
import { errorText } from '../../lib/utils'

export const Route = createFileRoute('/_protected/dashboard')({ component: OverviewPage })

function OverviewPage() {
    const [overview, setOverview] = useState<WorkerOverview | null>(null)
    const [telegram, setTelegram] = useState<WorkerTelegramStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async (refresh = false) => {
        if (refresh) setRefreshing(true)
        else setLoading(true)
        setError(null)

        const [overviewResult, telegramResult] = await Promise.allSettled([
            getOverview(),
            getTelegramStatus(),
        ])

        if (overviewResult.status === 'fulfilled') setOverview(overviewResult.value)
        else setError(errorText(overviewResult.reason))

        if (telegramResult.status === 'fulfilled') setTelegram(telegramResult.value)
        else if (overviewResult.status === 'fulfilled') setError(errorText(telegramResult.reason))

        setLoading(false)
        setRefreshing(false)
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    if (loading) return <PageSkeleton label="Loading overview" />

    if (!overview) {
        return (
            <section className="app-empty-state">
                <span className="app-empty-icon is-error"><AlertTriangle aria-hidden="true" /></span>
                <p className="app-eyebrow">Connection error</p>
                <h1>We couldn’t reach your worker.</h1>
                <p>{error ?? 'The worker overview API did not return data.'}</p>
                <button type="button" className="app-primary-button" onClick={() => void load(true)}>
                    <RefreshCw aria-hidden="true" /> Try again
                </button>
            </section>
        )
    }

    const attentionCount = overview.counts.actions.failed + overview.counts.actions.pending
    const isConfigured =
        overview.counts.chats.monitored > 0 &&
        overview.counts.analysisConfigs.active > 0 &&
        overview.counts.rules.active > 0 &&
        overview.counts.notifiers.active > 0

    return (
        <div className="overview-page">
            <section className="overview-heading">
                <div>
                    <p className="app-eyebrow">Command center</p>
                    <h1>Your automation, at a glance.</h1>
                    <p>Monitor the path from Telegram message to AI decision and delivered action.</p>
                </div>
                <div className="overview-heading-actions">
                    <span className={`system-state ${telegram?.loggedIn ? 'is-healthy' : 'is-warning'}`}>
                        <span /> {telegram?.loggedIn ? 'Telegram connected' : 'Telegram needs attention'}
                    </span>
                    <button
                        type="button"
                        className="app-icon-button"
                        onClick={() => void load(true)}
                        disabled={refreshing}
                        aria-label="Refresh overview"
                        title="Refresh overview"
                    >
                        <RefreshCw className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
                    </button>
                </div>
            </section>

            {error && (
                <div className="overview-alert" role="alert">
                    <AlertTriangle aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}

            {!isConfigured && <SetupBanner overview={overview} telegram={telegram} />}

            <DiagnosticsBanner diagnostics={overview.diagnostics} />

            <section className="metric-grid" aria-label="Operational metrics">
                <MetricCard
                    icon={MessageSquare}
                    label="Messages captured"
                    value={formatNumber(overview.counts.messages.total)}
                    detail={timeLabel(overview.timestamps.latestMessageAt, 'No messages yet')}
                    tone="mint"
                />
                <MetricCard
                    icon={Radio}
                    label="Monitored chats"
                    value={`${overview.counts.chats.monitored}/${overview.counts.chats.total}`}
                    detail={overview.counts.chats.monitored > 0 ? 'Listening for new messages' : 'Choose chats to monitor'}
                    tone="blue"
                />
                <MetricCard
                    icon={Send}
                    label="Actions delivered"
                    value={formatNumber(overview.counts.actions.sent)}
                    detail={`${formatPercent(overview.counts.actions.successRate)} success rate`}
                    tone="purple"
                />
                <MetricCard
                    icon={attentionCount > 0 ? AlertTriangle : CheckCircle2}
                    label="Needs attention"
                    value={formatNumber(attentionCount)}
                    detail={attentionCount > 0 ? `${overview.counts.actions.failed} failed · ${overview.counts.actions.pending} pending` : 'No action issues'}
                    tone={attentionCount > 0 ? 'orange' : 'green'}
                />
            </section>

            <section className="pipeline-panel">
                <div className="app-panel-heading">
                    <div>
                        <p className="app-eyebrow">Automation pipeline</p>
                        <h2>Every stage, ready to work.</h2>
                    </div>
                    <span className="last-activity"><Clock3 /> Last analysis {timeLabel(overview.timestamps.latestAnalysisAt, 'not yet run')}</span>
                </div>
                <div className="pipeline-grid">
                    <PipelineStage
                        icon={Radio}
                        label="Source"
                        title="Telegram"
                        value={telegram?.loggedIn ? 'Connected' : 'Not connected'}
                        healthy={Boolean(telegram?.loggedIn)}
                        to="/telegram"
                    />
                    <PipelineStage
                        icon={Bot}
                        label="Intelligence"
                        title="AI analyses"
                        value={`${overview.counts.analysisConfigs.active} active`}
                        healthy={overview.counts.analysisConfigs.active > 0}
                        to="/settings"
                    />
                    <PipelineStage
                        icon={Settings2}
                        label="Decision"
                        title="Action rules"
                        value={`${overview.counts.rules.active} active`}
                        healthy={overview.counts.rules.active > 0}
                        to="/settings"
                    />
                    <PipelineStage
                        icon={Webhook}
                        label="Destination"
                        title="Notifiers"
                        value={`${overview.counts.notifiers.active} active`}
                        healthy={overview.counts.notifiers.active > 0}
                        to="/settings"
                        last
                    />
                </div>
            </section>

            <div className="overview-content-grid">
                <section className="app-data-panel">
                    <div className="app-panel-heading compact">
                        <div><p className="app-eyebrow">Intelligence inbox</p><h2>Recent messages</h2></div>
                        <Link to="/messages" className="app-text-link">View all <ArrowRight /></Link>
                    </div>
                    {overview.recentMessages.length === 0 ? (
                        <CompactEmpty icon={MessageSquare} text="Messages from monitored chats will appear here." />
                    ) : (
                        <div className="recent-list">
                            {overview.recentMessages.map((message) => (
                                <article className="recent-message" key={message.id}>
                                    <span className="source-avatar">{initials(message.chat.title)}</span>
                                    <div className="recent-main">
                                        <div className="recent-meta"><b>{message.chat.title}</b><span>{message.senderName ?? 'Unknown sender'} · {timeLabel(message.receivedAt)}</span></div>
                                        <p>{truncate(message.text, 150)}</p>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section className="app-data-panel">
                    <div className="app-panel-heading compact">
                        <div><p className="app-eyebrow">Delivery activity</p><h2>Recent actions</h2></div>
                        <Link to="/action-logs" className="app-text-link">View logs <ArrowRight /></Link>
                    </div>
                    {overview.recentActions.length === 0 ? (
                        <CompactEmpty icon={Zap} text="Matched rules and dispatched actions will appear here." />
                    ) : (
                        <div className="action-list">
                            {overview.recentActions.map((action) => <ActionRow action={action} key={action.id} />)}
                        </div>
                    )}
                </section>
            </div>

            <section className="app-data-panel live-panel">
                <div className="app-panel-heading compact">
                    <div><p className="app-eyebrow">Realtime</p><h2>Live analysis feed</h2></div>
                    <span className="live-listening"><span /> Listening for analyzed messages</span>
                </div>
                <LiveFeed />
            </section>
        </div>
    )
}

function SetupBanner({ overview, telegram }: { overview: WorkerOverview; telegram: WorkerTelegramStatus | null }) {
    const steps = [
        { done: Boolean(telegram?.loggedIn), label: 'Connect Telegram', to: '/telegram' as const },
        { done: overview.counts.chats.monitored > 0, label: 'Monitor a chat', to: '/chats' as const },
        { done: overview.counts.analysisConfigs.active > 0, label: 'Activate an analysis', to: '/settings' as const },
        { done: overview.counts.rules.active > 0 && overview.counts.notifiers.active > 0, label: 'Route an action', to: '/settings' as const },
    ]
    const completed = steps.filter((step) => step.done).length
    const next = steps.find((step) => !step.done)

    return (
        <section className="setup-banner">
            <div className="setup-progress"><span style={{ width: `${(completed / steps.length) * 100}%` }} /></div>
            <div className="setup-copy">
                <span className="setup-icon"><Zap /></span>
                <div><p className="app-eyebrow">Finish setup · {completed} of {steps.length}</p><h2>{next ? next.label : 'Your pipeline is ready'}</h2></div>
            </div>
            {next && <Link to={next.to} className="app-primary-button">Continue setup <ArrowRight /></Link>}
        </section>
    )
}

function MetricCard({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: string }) {
    return (
        <article className="metric-card">
            <div className={`metric-icon tone-${tone}`}><Icon aria-hidden="true" /></div>
            <p>{label}</p>
            <strong>{value}</strong>
            <span>{detail}</span>
        </article>
    )
}

function PipelineStage({ icon: Icon, label, title, value, healthy, to, last = false }: { icon: LucideIcon; label: string; title: string; value: string; healthy: boolean; to: '/telegram' | '/settings'; last?: boolean }) {
    return (
        <Link to={to} className="pipeline-stage">
            <div className="pipeline-stage-top"><span className="pipeline-icon"><Icon /></span>{!last && <ArrowRight className="pipeline-arrow" />}</div>
            <p>{label}</p>
            <h3>{title}</h3>
            <span className={healthy ? 'stage-state is-ready' : 'stage-state is-missing'}><span /> {value}</span>
        </Link>
    )
}

function ActionRow({ action }: { action: WorkerOverviewAction }) {
    return (
        <article className="action-row">
            <span className={`action-state-icon is-${action.status}`}>
                {action.status === 'sent' ? <CheckCircle2 /> : action.status === 'failed' ? <AlertTriangle /> : <Clock3 />}
            </span>
            <div className="recent-main">
                <div className="recent-meta"><b>{action.notifier.name}</b><span>{action.analysis.analysisConfigName} · {timeLabel(action.analysis.analyzedAt)}</span></div>
                <p>{action.message.chatTitle}: {truncate(action.message.text, 90)}</p>
            </div>
            <span className={`action-status is-${action.status}`}>{action.status}</span>
        </article>
    )
}

function CompactEmpty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
    return <div className="compact-empty"><Icon /><p>{text}</p></div>
}

function formatNumber(value: number): string { return new Intl.NumberFormat().format(value) }
function formatPercent(value: number): string { return `${Math.round(value)}%` }
function truncate(value: string, max: number): string { return value.length > max ? `${value.slice(0, max)}…` : value }
function initials(value: string): string { return value.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'TG' }
function timeLabel(value: string | null, fallback = '—'): string {
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
