import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Inbox, Mail, Paperclip, RefreshCw, Send, Sparkles, X } from 'lucide-react'
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

interface MailAttachment {
    filename: string
    content: string
    contentType: string
    size: number
}

function extractEmails(job: WorkerMailJob): string[] {
    const found = new Set<string>()
    if (job.analysis && typeof job.analysis === 'object') {
        const str = JSON.stringify(job.analysis)
        const matches = str.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
        if (matches) {
            for (const email of matches) {
                found.add(email.toLowerCase())
            }
        }
    }
    if (job.text) {
        const matches = job.text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
        if (matches) {
            for (const email of matches) {
                found.add(email.toLowerCase())
            }
        }
    }
    return Array.from(found)
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function MailPage() {
    const [jobs, setJobs] = useState<WorkerMailJob[]>([])
    const [cursor, setCursor] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState(false)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selected, setSelected] = useState<WorkerMailJob | null>(null)
    const [recipients, setRecipients] = useState('')
    const [autoExtracted, setAutoExtracted] = useState<string[]>([])
    const [subject, setSubject] = useState('')
    const [body, setBody] = useState('')
    const [attachments, setAttachments] = useState<MailAttachment[]>([])
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
        setAttachments([])
        const found = extractEmails(job)
        setAutoExtracted(found)
        if (found.length > 0) {
            setRecipients(found.join(', '))
        } else {
            setRecipients('')
        }

        const raw = job.analysis as Record<string, unknown> | null
        const jobTitle = typeof raw?.job_title === 'string' ? raw.job_title : typeof raw?.title === 'string' ? raw.title : ''
        const company = typeof raw?.company === 'string' ? raw.company : typeof raw?.organization === 'string' ? raw.organization : ''

        if (jobTitle) {
            setSubject(`Application: ${jobTitle}${company ? ` at ${company}` : ''}`)
        } else {
            setSubject(`[${job.analysisConfigName}] Analysed message — ${job.chat.title}`)
        }

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

    async function handleFileAdd(event: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files ?? [])
        if (files.length === 0) return

        const newAttachments: MailAttachment[] = []
        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`"${file.name}" exceeds maximum 10MB attachment size.`)
                continue
            }
            try {
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onload = () => {
                        const res = reader.result as string
                        const base64Content = res.includes(',') ? res.split(',')[1] : res
                        resolve(base64Content)
                    }
                    reader.onerror = reject
                    reader.readAsDataURL(file)
                })
                newAttachments.push({
                    filename: file.name,
                    content: base64,
                    contentType: file.type || 'application/octet-stream',
                    size: file.size,
                })
            } catch {
                toast.error(`Failed to read file "${file.name}".`)
            }
        }
        setAttachments((prev) => [...prev, ...newAttachments])
        event.target.value = ''
    }

    function removeAttachment(index: number) {
        setAttachments((prev) => prev.filter((_, i) => i !== index))
    }

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
                    attachments: attachments.map(({ filename, content, contentType }) => ({
                        filename,
                        content,
                        contentType,
                    })),
                },
            })
            toast.success(
                `Sent to ${result.to.length} recipient${result.to.length === 1 ? '' : 's'} via ${result.host}${attachments.length > 0 ? ` (${attachments.length} attachment${attachments.length === 1 ? '' : 's'})` : ''}.`,
            )
            setSelected(null)
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
                            <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                                    Recipients {recipientList.length > 0 ? `(${recipientList.length})` : ''}
                                </span>
                                {autoExtracted.length > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                        <Sparkles className="h-3 w-3" /> Auto-detected from message
                                    </span>
                                ) : null}
                            </div>
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
                                rows={8}
                                placeholder="The LLM analysis for this message…"
                                className="w-full resize-y rounded-xl border border-(--line) bg-(--surface) px-3.5 py-2.5 font-mono text-xs leading-relaxed text-(--sea-ink) outline-none transition focus:border-(--lagoon) focus:ring-2 focus:ring-(--lagoon)/20 dark:text-zinc-100"
                            />
                            <span className="mt-1 block text-xs text-(--sea-ink-soft)">
                                Pre-filled with the LLM analysis. Edit freely.
                            </span>
                        </label>

                        <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                                    Attachments {attachments.length > 0 ? `(${attachments.length})` : ''}
                                </span>
                                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-(--line) bg-(--surface) px-2.5 py-1 text-xs font-semibold text-(--sea-ink) transition hover:border-(--lagoon) dark:text-zinc-200">
                                    <Paperclip className="h-3.5 w-3.5 text-(--lagoon-deep)" />
                                    Attach files
                                    <input
                                        type="file"
                                        multiple
                                        onChange={(event) => void handleFileAdd(event)}
                                        className="hidden"
                                    />
                                </label>
                            </div>

                            {attachments.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {attachments.map((att, idx) => (
                                        <div
                                            key={`${att.filename}-${idx}`}
                                            className="inline-flex items-center gap-2 rounded-lg border border-(--line) bg-(--surface) px-2.5 py-1.5 text-xs text-(--sea-ink) dark:text-zinc-200"
                                        >
                                            <Paperclip className="h-3 w-3 shrink-0 text-(--sea-ink-soft)" />
                                            <span className="max-w-40 truncate font-medium" title={att.filename}>
                                                {att.filename}
                                            </span>
                                            <span className="text-[10px] text-(--sea-ink-soft)">
                                                ({formatFileSize(att.size)})
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeAttachment(idx)}
                                                className="ml-1 rounded p-0.5 text-(--sea-ink-soft) hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                                aria-label={`Remove ${att.filename}`}
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="m-0 text-xs text-(--sea-ink-soft)">
                                    No files attached yet. (PDFs, resumes, documents up to 10MB).
                                </p>
                            )}
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-2">
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
                                Send email {attachments.length > 0 ? `with ${attachments.length} attachment${attachments.length === 1 ? '' : 's'}` : ''}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setBody(selected.body)
                                    setAttachments([])
                                    const found = extractEmails(selected)
                                    setAutoExtracted(found)
                                    setRecipients(found.join(', '))
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