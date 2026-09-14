import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Inbox, Mail, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'

import { listMailJobs, sendManualMail } from '../../server/mail'
import { PageSkeleton } from '../../components/dashboard/PageSkeleton'
import { LogTable } from '../../components/dashboard/LogTable'
import type { LogTableColumn } from '../../components/dashboard/LogTable'
import { DetailsDrawer, DrawerSection } from '../../components/dashboard/DetailsDrawer'
import type { WorkerMailJob } from '../../lib/types'
import { errorText } from '../../lib/utils'
import { formatDateTime, formatTime, verdictSummary } from '../../lib/helpers'

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

    function openComposer(job: WorkerMailJob) {
        setSelected(job)
        setSubject(`[${job.analysisConfigName}] Analysed message — ${job.chat.title}`)
        setBody(job.body)
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
            toast.error('Enter at least one recipient email address.')
            return
        }
        const invalid = recipientList.find((address) => !address.includes('@'))
        if (invalid) {
            toast.error(`"${invalid}" does not look like an email address.`)
            return
        }
        setSending(true)
        try {
            const result = await sendManualMail({
                data: {
                    analysisId: selected.analysisId,
                    recipients: recipientList,
                    subject: subject.trim(),
                    body,
                },
            })
            toast.success(
                `Sent to ${result.to.length} recipient${result.to.length === 1 ? '' : 's'} via ${result.host}.`,
            )
        } catch (err) {
            toast.error(errorText(err))
        } finally {
            setSending(false)
        }
    }

    if (loading) return <PageSkeleton label="Loading analysed messages" />

    const columns: LogTableColumn<WorkerMailJob>[] = [
        {
            header: 'Chat',
            cell: (job) => (
                <span className="whitespace-nowrap font-semibold text-(--sea-ink)">{job.chat.title}</span>
            ),
        },
        {
            header: 'Config',
            hiddenOnMobile: true,
            cell: (job) => (
                <span className="whitespace-nowrap text-xs font-semibold text-(--lagoon-deep) dark:text-(--lagoon)">
                    {job.analysisConfigName}
                </span>
            ),
        },
        {
            header: 'Message',
            cell: (job) => (
                <span className="block max-w-72 truncate text-xs text-(--sea-ink-soft)" title={job.text}>
                    {job.text}
                </span>
            ),
        },
        {
            header: 'Sender',
            hiddenOnMobile: true,
            cell: (job) => (
                <span className="whitespace-nowrap text-xs text-(--sea-ink-soft)">
                    {job.senderName ?? '—'}
                </span>
            ),
        },
        {
            header: 'Analysed',
            align: 'right',
            cell: (job) => (
                <span
                    className="whitespace-nowrap text-xs text-(--sea-ink-soft)"
                    title={formatDateTime(job.analyzedAt)}
                >
                    {formatTime(job.analyzedAt)}
                </span>
            ),
        },
    ]

    return (
        <>
            <section className="island-shell overflow-hidden rounded-2xl p-0">
                <div className="flex flex-col gap-1.5 border-b border-(--line) px-4 py-3.5 sm:px-5 sm:py-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="m-0 text-base font-semibold text-(--sea-ink) dark:text-zinc-100">Mail</h2>
                        <button
                            type="button"
                            onClick={() => void load(true, true)}
                            disabled={refreshing}
                            className="app-primary-button !min-h-8 !py-1 !px-3 text-xs shrink-0"
                            aria-label="Refresh mail jobs"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                            Refresh
                        </button>
                    </div>
                    <p className="m-0 text-sm text-(--sea-ink-soft) dark:text-zinc-400">
                        Send an email about a message the LLM has already analysed — click a row to open the composer.
                    </p>
                </div>

                {error ? <p className="border-b border-(--line) px-5 py-2 text-sm text-red-500">{error}</p> : null}

                <div className="px-4 pb-5 sm:px-5">
                    {jobs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-10 text-center">
                            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-(--lagoon)/15 text-(--sea-ink) dark:text-(--lagoon)">
                                <Inbox className="h-6 w-6" />
                            </div>
                            <h3 className="font-semibold text-sm text-(--sea-ink) dark:text-zinc-100">
                                No analysed messages
                            </h3>
                            <p className="mt-1 max-w-sm text-xs text-(--sea-ink-soft) dark:text-zinc-400">
                                Once the LLM has analysed a message you can compose and send an email about it from here.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="mt-3">
                                <LogTable<WorkerMailJob>
                                    rows={jobs}
                                    rowKey={(job) => job.messageId}
                                    onRowClick={openComposer}
                                    rowAriaLabel={() => 'Open mail composer'}
                                    columns={columns}
                                />
                            </div>
                            {hasMore ? (
                                <div className="mt-4 flex justify-center">
                                    <button
                                        onClick={() => void load(false)}
                                        className="rounded-full border border-(--line) bg-(--surface-strong) px-5 py-2 text-xs font-semibold text-(--sea-ink) transition hover:border-(--lagoon) dark:text-zinc-200"
                                    >
                                        Load older
                                    </button>
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            </section>

            {selected ? (
                <DetailsDrawer
                    ariaLabel={`Send email about message from ${selected.chat.title}`}
                    icon={<Mail className="h-4 w-4 text-(--lagoon-deep)" aria-hidden="true" />}
                    title={selected.chat.title}
                    subtitle={
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                            From {selected.senderName ?? 'Unknown'} · analysed {formatDateTime(selected.analyzedAt)}
                        </span>
                    }
                    onClose={() => setSelected(null)}
                >
                    <DrawerSection title="Message">
                        <div className="rounded-xl border border-(--line) bg-(--surface) px-3.5 py-2.5">
                            <p className="m-0 line-clamp-3 text-xs leading-relaxed text-(--sea-ink-soft)">
                                “{selected.text}”
                            </p>
                            <p className="m-0 mt-1.5 truncate font-mono text-[11px] text-(--lagoon-deep) dark:text-(--lagoon)">
                                {verdictSummary(selected.analysis)}
                            </p>
                        </div>
                    </DrawerSection>

                    <DrawerSection title="Compose email">
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

                        <label className="mt-4 block">
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

                        <label className="mt-4 block">
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

                        <div className="mt-4 flex flex-wrap items-center gap-2">
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
                    </DrawerSection>
                </DetailsDrawer>
            ) : null}
        </>
    )
}