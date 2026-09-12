import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { RefreshCw, Send } from 'lucide-react'

import { listMailJobs, sendManualMail } from '../../server/mail'
import { Panel } from '../../components/dashboard/Panel'
import { PageSkeleton } from '../../components/dashboard/PageSkeleton'
import type { WorkerMailJob } from '../../lib/types'
import { errorText } from '../../lib/utils'
import { formatDateTime, relativeTime, verdictSummary } from '../../lib/helpers'

export const Route = createFileRoute('/_protected/mail')({ component: MailPage })

const PAGE_SIZE = 50

function MailPage() {
    const [jobs, setJobs] = useState<WorkerMailJob[]>([])
    const [cursor, setCursor] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState(false)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selected, setSelected] = useState<WorkerMailJob | null>(null)
    const [recipients, setRecipients] = useState('')
    const [subject, setSubject] = useState('')
    const [body, setBody] = useState('')
    const [sending, setSending] = useState(false)
    const [sendStatus, setSendStatus] = useState<{ ok: boolean; message: string } | null>(null)

    async function load(reset: boolean, silent = false) {
        if (reset && !silent) setLoading(true)
        if (silent) setRefreshing(true)
        setError(null)
        try {
            const result = await listMailJobs({
                data: { limit: PAGE_SIZE, cursor: reset ? undefined : (cursor ?? undefined) },
            })
            setJobs((previous) => (reset ? result.items : [...previous, ...result.items]))
            setCursor(result.nextCursor)
            setHasMore(result.hasMore)
        } catch (err) {
            setError(errorText(err))
        } finally {
            if (reset && !silent) setLoading(false)
            if (silent) setRefreshing(false)
        }
    }

    useEffect(() => {
        void load(true)
    }, [])

    function selectJob(job: WorkerMailJob) {
        setSelected(job)
        setSubject(`[${job.analysisConfigName}] Analysed message — ${job.chat.title}`)
        setBody(job.body)
        setSendStatus(null)
    }

    const recipientList = useMemo(
        () =>
            recipients
                .split(/[,;\s]+/)
                .map((address) => address.trim())
                .filter(Boolean),
        [recipients],
    )

    async function send() {
        if (!selected) return
        if (recipientList.length === 0) {
            setSendStatus({ ok: false, message: 'Enter at least one recipient email address.' })
            return
        }
        const invalid = recipientList.find((address) => !address.includes('@'))
        if (invalid) {
            setSendStatus({ ok: false, message: `"${invalid}" does not look like an email address.` })
            return
        }
        setSending(true)
        setSendStatus(null)
        try {
            const result = await sendManualMail({
                data: {
                    analysisId: selected.analysisId,
                    recipients: recipientList,
                    subject: subject.trim(),
                    body,
                },
            })
            setSendStatus({
                ok: true,
                message: `Sent to ${result.to.length} recipient${result.to.length === 1 ? '' : 's'} via ${result.host}.`,
            })
        } catch (err) {
            setSendStatus({ ok: false, message: errorText(err) })
        } finally {
            setSending(false)
        }
    }

    if (loading) return <PageSkeleton label="Loading analysed messages" />

    return (
        <Panel
            title="Mail"
            description="Send an email about a message the LLM has already analysed — recipients, subject and body are written by you."
            action={
                <button
                    type="button"
                    onClick={() => void load(true, true)}
                    disabled={refreshing}
                    aria-label="Refresh mail jobs"
                    title="Refresh mail jobs"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-(--line) text-(--sea-ink-soft) transition hover:border-(--lagoon) hover:text-(--sea-ink) disabled:opacity-50 md:h-8 md:w-8"
                >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                </button>
            }
        >
            {error ? <p className="mb-3 text-sm text-red-500">{error}</p> : null}

            {jobs.length === 0 ? (
                <p className="text-sm text-(--sea-ink-soft)">
                    No analysed messages yet — once the LLM has analysed a message you can mail it from here.
                </p>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    <div className="flex min-w-0 flex-col gap-2">
                        {jobs.map((job) => (
                            <button
                                key={job.messageId}
                                type="button"
                                onClick={() => selectJob(job)}
                                aria-current={selected?.messageId === job.messageId ? 'true' : undefined}
                                className={`rounded-xl border px-4 py-3 text-left transition ${
                                    selected?.messageId === job.messageId
                                        ? 'border-(--lagoon) bg-(--lagoon)/10'
                                        : 'border-(--line) bg-(--header-bg) hover:border-(--lagoon)'
                                }`}
                            >
                                <p className="m-0 flex items-baseline justify-between gap-2 text-sm font-semibold text-(--sea-ink)">
                                    <span className="truncate">{job.chat.title}</span>
                                    <span className="shrink-0 text-xs font-medium text-(--sea-ink-soft)">
                                        {relativeTime(job.analyzedAt)}
                                    </span>
                                </p>
                                <p className="m-0 mt-0.5 text-[11px] font-semibold text-(--lagoon-deep)">
                                    {job.senderName ? `${job.senderName} · ` : ''}
                                    {job.analysisConfigName}
                                </p>
                                <p className="m-0 mt-1 line-clamp-2 text-xs leading-relaxed text-(--sea-ink-soft)">
                                    “{job.text}”
                                </p>
                                <p className="m-0 mt-1.5 truncate font-mono text-[11px] text-(--sea-ink-soft)">
                                    {verdictSummary(job.analysis)}
                                </p>
                            </button>
                        ))}
                        {hasMore ? (
                            <button
                                onClick={() => void load(false)}
                                className="self-center rounded-full border border-(--line) bg-(--header-bg) px-5 py-2 text-sm font-semibold text-(--sea-ink) transition hover:border-(--lagoon)"
                            >
                                Load more
                            </button>
                        ) : null}
                    </div>

                    <div className="flex flex-col gap-3 rounded-xl border border-(--line) bg-(--header-bg) p-4">
                        {!selected ? (
                            <p className="m-0 rounded-xl border border-dashed border-(--line) px-4 py-8 text-center text-sm text-(--sea-ink-soft)">
                                Choose an analysed message on the left to compose its email.
                            </p>
                        ) : (
                            <>
                                <div className="rounded-xl border border-(--line) bg-(--surface) px-3.5 py-2.5">
                                    <p className="m-0 text-[11px] font-semibold text-(--lagoon-deep)">
                                        {selected.chat.title}
                                        {selected.senderName ? ` · ${selected.senderName}` : ''} · analyzed{' '}
                                        {formatDateTime(selected.analyzedAt)}
                                    </p>
                                    <p className="m-0 mt-1 line-clamp-2 text-xs leading-relaxed text-(--sea-ink-soft)">
                                        “{selected.text}”
                                    </p>
                                </div>

                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                                        Recipients {recipientList.length > 0 ? `(${recipientList.length})` : ''}
                                    </span>
                                    <input
                                        type="text"
                                        value={recipients}
                                        onChange={(event) => setRecipients(event.target.value)}
                                        placeholder="ops@example.com, lead@client.com"
                                        className="w-full rounded-xl border border-(--line) bg-(--surface) px-3.5 py-2.5 text-sm text-(--sea-ink) outline-none transition focus:border-(--lagoon) focus:ring-2 focus:ring-(--lagoon)/20 dark:text-zinc-100"
                                    />
                                    <span className="mt-1 block text-xs text-(--sea-ink-soft)">
                                        Comma, space or newline separated email addresses.
                                    </span>
                                </label>

                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                                        Subject
                                    </span>
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={(event) => setSubject(event.target.value)}
                                        placeholder="Analysed message"
                                        className="w-full rounded-xl border border-(--line) bg-(--surface) px-3.5 py-2.5 text-sm text-(--sea-ink) outline-none transition focus:border-(--lagoon) focus:ring-2 focus:ring-(--lagoon)/20 dark:text-zinc-100"
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                                        Body
                                    </span>
                                    <textarea
                                        value={body}
                                        onChange={(event) => setBody(event.target.value)}
                                        rows={10}
                                        placeholder="The LLM analysis for this message…"
                                        className="w-full resize-y rounded-xl border border-(--line) bg-(--surface) px-3.5 py-2.5 font-mono text-xs leading-relaxed text-(--sea-ink) outline-none transition focus:border-(--lagoon) focus:ring-2 focus:ring-(--lagoon)/20 dark:text-zinc-100"
                                    />
                                    <span className="mt-1 block text-xs text-(--sea-ink-soft)">
                                        Pre-filled with the LLM analysis. Edit freely.
                                    </span>
                                </label>

                                {sendStatus ? (
                                    <p
                                        role="status"
                                        className={`m-0 text-xs font-medium ${sendStatus.ok ? 'text-(--lagoon-deep)' : 'text-red-500'}`}
                                    >
                                        {sendStatus.message}
                                    </p>
                                ) : null}

                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void send()}
                                        disabled={sending || recipientList.length === 0}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-(--lagoon-deep) px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 dark:bg-(--lagoon) dark:text-[#4F3D35]"
                                    >
                                        {sending ? (
                                            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                                        ) : (
                                            <Send className="h-4 w-4" aria-hidden="true" />
                                        )}
                                        Send email
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setBody(selected.body)
                                            setSubject(`[${selected.analysisConfigName}] Analysed message — ${selected.chat.title}`)
                                        }}
                                        disabled={sending}
                                        className="rounded-lg border border-(--line) px-3.5 py-2.5 text-sm font-semibold text-(--sea-ink-soft) transition hover:bg-white/50 dark:hover:bg-zinc-800 disabled:opacity-50"
                                    >
                                        Reset to analysis
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </Panel>
    )
}