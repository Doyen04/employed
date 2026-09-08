import { useState } from 'react'
import type { ReactNode } from 'react'
import { Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'

import { Panel } from '../Panel'
import {
    createActionRule,
    createAnalysisConfig,
    createNotifier,
    deleteActionRule,
    deleteAnalysisConfig,
    deleteNotifier,
    updateActionRule,
    updateAnalysisConfig,
    updateNotifier,
} from '../../../server/settings'
import type {
    Json,
    NotifierType,
    WorkerActionRule,
    WorkerAnalysisConfig,
    WorkerNotifier,
    WorkerSettings,
} from '../../../lib/types'
import { errorText } from '../../../lib/utils'

const NOTIFIER_TYPES: NotifierType[] = ['telegram', 'email', 'webhook', 'push', 'slack']

interface KVRow {
    key: string
    value: string
}

function parseValue(raw: string): Json {
    const trimmed = raw.trim()
    if (trimmed === '') return ''
    try {
        return JSON.parse(trimmed) as Json
    } catch {
        return trimmed
    }
}

function rowsFromObject(value: Json): KVRow[] {
    if (value === null || Array.isArray(value) || typeof value !== 'object') return []
    return Object.entries(value).map(([key, val]) => ({
        key,
        value: typeof val === 'string' ? val : JSON.stringify(val),
    }))
}

function objectFromRows(rows: KVRow[]): Json {
    const out: Record<string, Json> = {}
    for (const row of rows) {
        const key = row.key.trim()
        if (!key) continue
        out[key] = parseValue(row.value)
    }
    return out
}

// ---------- form primitives ----------

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
    return (
        <div className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                {label}
            </span>
            {children}
            {hint ? <span className="mt-1 block text-xs text-(--sea-ink-soft)">{hint}</span> : null}
        </div>
    )
}

const inputClass =
    'w-full rounded-xl border border-(--line) bg-(--surface) px-3.5 py-2.5 text-sm text-(--sea-ink) outline-none transition focus:border-(--lagoon) focus:ring-2 focus:ring-(--lagoon)/20 dark:text-zinc-100'

function TextInput({
    value,
    onChange,
    placeholder,
    required,
}: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    required?: boolean
}) {
    return (
        <input
            type="text"
            className={inputClass}
            value={value}
            placeholder={placeholder}
            required={required}
            onChange={(e) => onChange(e.target.value)}
        />
    )
}

function TextArea({
    value,
    onChange,
    rows,
    placeholder,
    required,
}: {
    value: string
    onChange: (value: string) => void
    rows?: number
    placeholder?: string
    required?: boolean
}) {
    return (
        <textarea
            className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
            value={value}
            rows={rows ?? 4}
            placeholder={placeholder}
            required={required}
            onChange={(e) => onChange(e.target.value)}
        />
    )
}

function Select({
    value,
    onChange,
    children,
}: {
    value: string
    onChange: (value: string) => void
    children: ReactNode
}) {
    return (
        <select className={`${inputClass} cursor-pointer`} value={value} onChange={(e) => onChange(e.target.value)}>
            {children}
        </select>
    )
}

function Checkbox({
    checked,
    onChange,
    label,
}: {
    checked: boolean
    onChange: (checked: boolean) => void
    label: string
}) {
    return (
        <label className="flex cursor-pointer items-center gap-2">
            <input
                type="checkbox"
                className="h-4 w-4 accent-[#9D8108]"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span className="text-xs font-semibold text-(--sea-ink)">{label}</span>
        </label>
    )
}

function KVEditor({
    rows,
    onChange,
    addLabel = 'Add key/value',
}: {
    rows: KVRow[]
    onChange: (rows: KVRow[]) => void
    addLabel?: string
}) {
    function replace(index: number, patch: Partial<KVRow>) {
        onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
    }
    return (
        <div className="flex flex-col gap-1.5">
            {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-1.5">
                    <input
                        type="text"
                        value={row.key}
                        placeholder="key"
                        onChange={(e) => replace(i, { key: e.target.value })}
                        className="w-2/5 rounded-lg border border-(--line) bg-(--surface) px-2.5 py-1.5 text-sm outline-none transition focus:border-(--lagoon) dark:text-zinc-100"
                    />
                    <input
                        type="text"
                        value={row.value}
                        placeholder="value (JSON allowed)"
                        onChange={(e) => replace(i, { value: e.target.value })}
                        className="flex-1 rounded-lg border border-(--line) bg-(--surface) px-2.5 py-1.5 text-sm outline-none transition focus:border-(--lagoon) dark:text-zinc-100"
                    />
                    <button
                        type="button"
                        title="Remove row"
                        onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-(--line) text-(--sea-ink-soft) transition hover:bg-red-500/10 hover:text-red-600"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={() => onChange([...rows, { key: '', value: '' }])}
                className="inline-flex items-center gap-1 self-start rounded-lg border border-dashed border-(--line) px-2.5 py-1.5 text-xs font-semibold text-(--lagoon-deep) transition hover:border-(--lagoon) hover:bg-white/50 dark:hover:bg-zinc-800"
            >
                <Plus className="h-3 w-3" /> {addLabel}
            </button>
        </div>
    )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1.5 rounded-xl border border-(--line) bg-(--surface-strong) px-3 py-2 text-xs font-semibold text-(--sea-ink) transition hover:border-(--lagoon) hover:bg-white/60 dark:hover:bg-zinc-800"
        >
            <Plus className="h-3.5 w-3.5" /> {label}
        </button>
    )
}

function FormShell({
    title,
    busy,
    error,
    saveDisabled,
    onSave,
    onCancel,
    children,
}: {
    title: string
    busy: boolean
    error: string | null
    saveDisabled: boolean
    onSave: () => void
    onCancel: () => void
    children: ReactNode
}) {
    return (
        <div className="mb-3 flex flex-col gap-3 rounded-xl border border-(--line) bg-(--surface-strong) p-4">
            <div className="flex items-center justify-between gap-2">
                <p className="m-0 text-sm font-bold text-(--sea-ink)">{title}</p>
                {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-(--sea-ink-soft)" /> : null}
            </div>
            {children}
            {error ? (
                <p role="alert" className="m-0 text-xs font-medium text-red-600">
                    {error}
                </p>
            ) : null}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onSave}
                    disabled={busy || saveDisabled}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-(--lagoon-deep) px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50 dark:bg-(--lagoon) dark:text-[#4F3D35]"
                >
                    Save
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy}
                    className="rounded-lg border border-(--line) px-3.5 py-2 text-xs font-semibold text-(--sea-ink-soft) transition hover:bg-white/50 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}

// ---------- item list ----------

interface Row {
    id: string
    name: string
    meta: string
    status: boolean
}

function ItemList({
    empty,
    rows,
    confirmingId,
    busy,
    onEdit,
    onDelete,
    onDeleteConfirm,
    onCancelDelete,
}: {
    empty: string
    rows: Row[]
    confirmingId: string | null
    busy: boolean
    onEdit: (id: string) => void
    onDelete: (id: string) => void
    onDeleteConfirm: (id: string) => void
    onCancelDelete: () => void
}) {
    if (rows.length === 0) {
        return <p className="m-0 text-sm text-(--sea-ink-soft)">{empty}</p>
    }
    return (
        <ul className="m-0 flex flex-col gap-2">
            {rows.map((row) => (
                <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-(--line) bg-(--header-bg) px-4 py-2.5"
                >
                    <div className="min-w-0">
                        <p className="m-0 flex items-center gap-2 truncate text-sm font-semibold text-(--sea-ink)">
                            {row.name}
                            <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.status
                                        ? 'bg-[rgba(236,185,20,0.18)] text-(--lagoon-deep)'
                                        : 'bg-[rgba(79,61,53,0.08)] text-(--sea-ink-soft)'
                                    }`}
                            >
                                {row.status ? 'ACTIVE' : 'PAUSED'}
                            </span>
                        </p>
                        <p className="m-0 truncate text-xs text-(--sea-ink-soft)">{row.meta}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {confirmingId === row.id ? (
                            <>
                                <span className="text-[10px] font-bold uppercase tracking-wide text-red-600">Delete?</span>
                                <button
                                    type="button"
                                    onClick={() => onDeleteConfirm(row.id)}
                                    disabled={busy}
                                    className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                                >
                                    Yes
                                </button>
                                <button
                                    type="button"
                                    onClick={onCancelDelete}
                                    disabled={busy}
                                    className="rounded-lg border border-(--line) px-2.5 py-1.5 text-[11px] font-semibold text-(--sea-ink-soft) transition hover:bg-white/50 dark:hover:bg-zinc-800 disabled:opacity-50"
                                >
                                    No
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    title="Edit"
                                    onClick={() => onEdit(row.id)}
                                    disabled={busy}
                                    className="grid h-7 w-7 place-items-center rounded-lg border border-(--line) text-(--sea-ink-soft) transition hover:bg-white/50 hover:text-(--sea-ink) dark:hover:bg-zinc-800 disabled:opacity-50"
                                >
                                    <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                    type="button"
                                    title="Delete"
                                    onClick={() => onDelete(row.id)}
                                    disabled={busy}
                                    className="grid h-7 w-7 place-items-center rounded-lg border border-(--line) text-(--sea-ink-soft) transition hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    )
}

// ---------- sections ----------

function AnalysisConfigsSection({
    configs,
    onChanged,
}: {
    configs: WorkerAnalysisConfig[]
    onChanged: () => Promise<void>
}) {
    const [editing, setEditing] = useState<
        { mode: 'create' } | { mode: 'edit'; item: WorkerAnalysisConfig } | null
    >(null)
    const [name, setName] = useState('')
    const [promptTemplate, setPromptTemplate] = useState('')
    const [schema, setSchema] = useState<KVRow[]>([])
    const [isActive, setIsActive] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [confirmingId, setConfirmingId] = useState<string | null>(null)

    function openCreate() {
        setName('')
        setPromptTemplate('')
        setSchema([])
        setIsActive(true)
        setError(null)
        setEditing({ mode: 'create' })
    }

    function openEdit(item: WorkerAnalysisConfig) {
        setName(item.name)
        setPromptTemplate(item.promptTemplate)
        setSchema(rowsFromObject(item.outputSchema))
        setIsActive(item.isActive)
        setError(null)
        setEditing({ mode: 'edit', item })
    }

    async function save() {
        setBusy(true)
        setError(null)
        try {
            const payload = {
                name: name.trim(),
                promptTemplate: promptTemplate.trim(),
                outputSchema: objectFromRows(schema),
                isActive,
            }
            if (editing?.mode === 'create') {
                await createAnalysisConfig({ data: payload })
            } else if (editing?.mode === 'edit') {
                await updateAnalysisConfig({ data: { id: editing.item.id, ...payload } })
            }
            await onChanged()
            setEditing(null)
        } catch (err) {
            setError(errorText(err))
        } finally {
            setBusy(false)
        }
    }

    async function confirmDelete(id: string) {
        setBusy(true)
        setError(null)
        try {
            await deleteAnalysisConfig({ data: { id } })
            await onChanged()
            setConfirmingId(null)
        } catch (err) {
            setError(errorText(err))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Panel
            title="Analysis prompts"
            description="Each active config runs against every incoming monitored message."
            action={<AddButton label="Add config" onClick={openCreate} />}
        >
            {editing ? (
                <FormShell
                    title={editing.mode === 'create' ? 'New analysis config' : `Edit ${editing.item.name}`}
                    busy={busy}
                    error={error}
                    saveDisabled={!name.trim() || !promptTemplate.trim()}
                    onSave={save}
                    onCancel={() => setEditing(null)}
                >
                    <Field label="Name">
                        <TextInput value={name} onChange={setName} placeholder="e.g. Customer support triage" required />
                    </Field>
                    <Field label="Prompt template">
                        <TextArea
                            value={promptTemplate}
                            onChange={setPromptTemplate}
                            rows={4}
                            placeholder="Analyze the incoming message and reply with a JSON object matching the output schema."
                            required
                        />
                    </Field>
                    <Field
                        label="Output schema"
                        hint="Keys must match the keys the LLM replies with. Values may be JSON (e.g. string, number, boolean)."
                    >
                        <KVEditor rows={schema} onChange={setSchema} />
                    </Field>
                    <Checkbox label="Active" checked={isActive} onChange={setIsActive} />
                </FormShell>
            ) : null}
            <ItemList
                empty="No analysis configs yet."
                rows={configs.map((config) => ({
                    id: config.id,
                    name: config.name,
                    meta: config.promptTemplate,
                    status: config.isActive,
                }))}
                confirmingId={confirmingId}
                busy={busy}
                onEdit={(id) => {
                    const item = configs.find((config) => config.id === id)
                    if (item) openEdit(item)
                }}
                onDelete={setConfirmingId}
                onDeleteConfirm={confirmDelete}
                onCancelDelete={() => setConfirmingId(null)}
            />
        </Panel>
    )
}

function NotifiersSection({
    notifiers,
    onChanged,
}: {
    notifiers: WorkerNotifier[]
    onChanged: () => Promise<void>
}) {
    const [editing, setEditing] = useState<
        { mode: 'create' } | { mode: 'edit'; item: WorkerNotifier } | null
    >(null)
    const [name, setName] = useState('')
    const [type, setType] = useState<NotifierType>('webhook')
    const [config, setConfig] = useState<KVRow[]>([])
    const [configDirty, setConfigDirty] = useState(false)
    const [isActive, setIsActive] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [confirmingId, setConfirmingId] = useState<string | null>(null)

    function openCreate() {
        setName('')
        setType('webhook')
        setConfig([])
        setConfigDirty(false)
        setIsActive(true)
        setError(null)
        setEditing({ mode: 'create' })
    }

    function openEdit(item: WorkerNotifier) {
        setName(item.name)
        setType(item.type)
        setConfig([])
        setConfigDirty(false)
        setIsActive(item.isActive)
        setError(null)
        setEditing({ mode: 'edit', item })
    }

    async function save() {
        setBusy(true)
        setError(null)
        try {
            const base = { name: name.trim(), type, isActive }
            if (editing?.mode === 'create') {
                await createNotifier({ data: { ...base, config: objectFromRows(config) } })
            } else if (editing?.mode === 'edit') {
                const patch: { id: string; name: string; type: NotifierType; isActive: boolean; config?: Json } = {
                    id: editing.item.id,
                    ...base,
                }
                if (configDirty) patch.config = objectFromRows(config)
                await updateNotifier({ data: patch })
            }
            await onChanged()
            setEditing(null)
        } catch (err) {
            setError(errorText(err))
        } finally {
            setBusy(false)
        }
    }

    async function confirmDelete(id: string) {
        setBusy(true)
        setError(null)
        try {
            await deleteNotifier({ data: { id } })
            await onChanged()
            setConfirmingId(null)
        } catch (err) {
            setError(errorText(err))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Panel
            title="Notifiers"
            description="Where resolved actions are dispatched."
            action={<AddButton label="Add notifier" onClick={openCreate} />}
        >
            {editing ? (
                <FormShell
                    title={editing.mode === 'create' ? 'New notifier' : `Edit ${editing.item.name}`}
                    busy={busy}
                    error={error}
                    saveDisabled={!name.trim()}
                    onSave={save}
                    onCancel={() => setEditing(null)}
                >
                    <Field label="Name">
                        <TextInput value={name} onChange={setName} placeholder="e.g. Ops webhook" required />
                    </Field>
                    <Field label="Type">
                        <Select value={type} onChange={(value) => setType(value as NotifierType)}>
                            {NOTIFIER_TYPES.map((option) => (
                                <option key={option} value={option}>
                                    {option.toUpperCase()}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field
                        label="Config"
                        hint={
                            editing.mode === 'create'
                                ? 'Type-specific options as flat key/value pairs. Values may be JSON.'
                                : 'Stored config is encrypted and hidden — leave empty to keep the current value, or add rows to replace it.'
                        }
                    >
                        <KVEditor
                            rows={config}
                            onChange={(rows) => {
                                setConfigDirty(true)
                                setConfig(rows)
                            }}
                        />
                    </Field>
                    <Checkbox label="Active" checked={isActive} onChange={setIsActive} />
                </FormShell>
            ) : null}
            <ItemList
                empty="No notifiers configured."
                rows={notifiers.map((notifier) => ({
                    id: notifier.id,
                    name: notifier.name,
                    meta: `${notifier.type.toUpperCase()}${notifier.configConfigured ? '' : ' · not configured'}`,
                    status: notifier.isActive,
                }))}
                confirmingId={confirmingId}
                busy={busy}
                onEdit={(id) => {
                    const item = notifiers.find((notifier) => notifier.id === id)
                    if (item) openEdit(item)
                }}
                onDelete={setConfirmingId}
                onDeleteConfirm={confirmDelete}
                onCancelDelete={() => setConfirmingId(null)}
            />
        </Panel>
    )
}

function ActionRulesSection({
    rules,
    configs,
    notifiers,
    onChanged,
}: {
    rules: WorkerActionRule[]
    configs: WorkerAnalysisConfig[]
    notifiers: WorkerNotifier[]
    onChanged: () => Promise<void>
}) {
    const [editing, setEditing] = useState<
        { mode: 'create' } | { mode: 'edit'; item: WorkerActionRule } | null
    >(null)
    const [analysisConfigId, setAnalysisConfigId] = useState('')
    const [notifierId, setNotifierId] = useState('')
    const [condition, setCondition] = useState<KVRow[]>([])
    const [isActive, setIsActive] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [confirmingId, setConfirmingId] = useState<string | null>(null)

    function openCreate() {
        setAnalysisConfigId(configs[0]?.id ?? '')
        setNotifierId(notifiers[0]?.id ?? '')
        setCondition([])
        setIsActive(true)
        setError(null)
        setEditing({ mode: 'create' })
    }

    function openEdit(item: WorkerActionRule) {
        setAnalysisConfigId(item.analysisConfigId)
        setNotifierId(item.notifierId)
        setCondition(rowsFromObject(item.condition))
        setIsActive(item.isActive)
        setError(null)
        setEditing({ mode: 'edit', item })
    }

    async function save() {
        setBusy(true)
        setError(null)
        try {
            const payload = {
                analysisConfigId,
                notifierId,
                condition: objectFromRows(condition),
                isActive,
            }
            if (editing?.mode === 'create') {
                await createActionRule({ data: payload })
            } else if (editing?.mode === 'edit') {
                await updateActionRule({ data: { id: editing.item.id, ...payload } })
            }
            await onChanged()
            setEditing(null)
        } catch (err) {
            setError(errorText(err))
        } finally {
            setBusy(false)
        }
    }

    async function confirmDelete(id: string) {
        setBusy(true)
        setError(null)
        try {
            await deleteActionRule({ data: { id } })
            await onChanged()
            setConfirmingId(null)
        } catch (err) {
            setError(errorText(err))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Panel
            title="Action rules"
            description="Flat key/value conditions matched against LLM output."
            action={<AddButton label="Add rule" onClick={openCreate} />}
        >
            {editing ? (
                <FormShell
                    title={editing.mode === 'create' ? 'New action rule' : `Edit rule ${editing.item.id}`}
                    busy={busy}
                    error={error}
                    saveDisabled={!analysisConfigId || !notifierId}
                    onSave={save}
                    onCancel={() => setEditing(null)}
                >
                    <Field label="Analysis config">
                        <Select value={analysisConfigId} onChange={setAnalysisConfigId}>
                            {configs.length === 0 ? (
                                <option value="" disabled>
                                    Create an analysis config first
                                </option>
                            ) : (
                                configs.map((config) => (
                                    <option key={config.id} value={config.id}>
                                        {config.name}
                                    </option>
                                ))
                            )}
                        </Select>
                    </Field>
                    <Field label="Notifier">
                        <Select value={notifierId} onChange={setNotifierId}>
                            {notifiers.length === 0 ? (
                                <option value="" disabled>
                                    Create a notifier first
                                </option>
                            ) : (
                                notifiers.map((notifier) => (
                                    <option key={notifier.id} value={notifier.id}>
                                        {notifier.name} ({notifier.type.toUpperCase()})
                                    </option>
                                ))
                            )}
                        </Select>
                    </Field>
                    <Field
                        label="Condition"
                        hint="Flat key/value pairs the LLM output must match for this rule to fire."
                    >
                        <KVEditor rows={condition} onChange={setCondition} />
                    </Field>
                    <Checkbox label="Active" checked={isActive} onChange={setIsActive} />
                </FormShell>
            ) : null}
            <ItemList
                empty="No action rules yet."
                rows={rules.map((rule) => ({
                    id: rule.id,
                    name: `${rule.notifierName} (${rule.notifierType.toUpperCase()})`,
                    meta: JSON.stringify(rule.condition),
                    status: rule.isActive,
                }))}
                confirmingId={confirmingId}
                busy={busy}
                onEdit={(id) => {
                    const item = rules.find((rule) => rule.id === id)
                    if (item) openEdit(item)
                }}
                onDelete={setConfirmingId}
                onDeleteConfirm={confirmDelete}
                onCancelDelete={() => setConfirmingId(null)}
            />
        </Panel>
    )
}

export function SettingsEditor({
    settings,
    onChanged,
}: {
    settings: WorkerSettings
    onChanged: () => Promise<void>
}) {
    return (
        <div className="flex flex-col gap-4">
            <AnalysisConfigsSection configs={settings.analysisConfigs} onChanged={onChanged} />
            <NotifiersSection notifiers={settings.notifiers} onChanged={onChanged} />
            <ActionRulesSection
                rules={settings.actionRules}
                configs={settings.analysisConfigs}
                notifiers={settings.notifiers}
                onChanged={onChanged}
            />
        </div>
    )
}