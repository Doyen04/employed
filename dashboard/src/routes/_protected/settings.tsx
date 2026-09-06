import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { getSettings } from '../../server/settings'
import { Panel } from '../../components/dashboard/Panel'
import type { WorkerSettings } from '../../lib/types'
import { errorText } from '../../lib/utils'

export const Route = createFileRoute('/_protected/settings')({ component: SettingsPage })

function SettingsPage() {
  const [settings, setSettings] = useState<WorkerSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const result = await getSettings()
        if (alive) setSettings(result)
      } catch (err) {
        if (alive) setError(errorText(err))
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  if (error) {
    return (
      <Panel title="Settings">
        <p role="alert" className="m-0 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {error}
        </p>
      </Panel>
    )
  }

  if (!settings) {
    return (
      <Panel title="Settings">
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">Loading settings…</p>
      </Panel>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Analysis prompts"
        description="Each active config runs against every incoming monitored message."
      >
        <ConfigList
          empty="No analysis configs yet."
          rows={settings.analysisConfigs.map((config) => ({
            key: config.id,
            name: config.name,
            active: config.isActive,
            meta: config.promptTemplate,
          }))}
        />
      </Panel>

      <Panel title="Notifiers" description="Where resolved actions are dispatched.">
        <ConfigList
          empty="No notifiers configured."
          rows={settings.notifiers.map((notifier) => ({
            key: notifier.id,
            name: notifier.name,
            active: notifier.isActive,
            meta: `${notifier.type.toUpperCase()}${notifier.configConfigured ? '' : ' · not configured'}`,
          }))}
        />
      </Panel>

      <Panel title="Action rules" description="Flat key/value conditions matched against LLM output.">
        <ConfigList
          empty="No action rules yet."
          rows={settings.actionRules.map((rule) => ({
            key: rule.id,
            name: `${rule.notifierName} (${rule.notifierType.toUpperCase()})`,
            active: rule.isActive,
            meta: JSON.stringify(rule.condition),
          }))}
        />
      </Panel>
    </div>
  )
}

function ConfigList({
  empty,
  rows,
}: {
  empty: string
  rows: { key: string; name: string; active: boolean; meta: string }[]
}) {
  if (rows.length === 0) {
    return <p className="m-0 text-sm text-[var(--sea-ink-soft)]">{empty}</p>
  }
  return (
    <ul className="m-0 flex flex-col gap-2">
      {rows.map((row) => (
        <li
          key={row.key}
          className="flex items-center justify-between gap-3 rounded-xl border border-(--line) bg-[var(--header-bg)] px-4 py-2.5"
        >
          <div className="min-w-0">
            <p className="m-0 truncate text-sm font-semibold text-[var(--sea-ink)]">{row.name}</p>
            <p className="m-0 truncate text-xs text-[var(--sea-ink-soft)]">{row.meta}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              row.active
                ? 'bg-[rgba(79,184,178,0.18)] text-[var(--lagoon-deep)]'
                : 'bg-[rgba(23,58,64,0.08)] text-[var(--sea-ink-soft)]'
            }`}
          >
            {row.active ? 'ACTIVE' : 'PAUSED'}
          </span>
        </li>
      ))}
    </ul>
  )
}