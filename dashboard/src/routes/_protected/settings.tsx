import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { getSettings } from '../../server/settings'
import { Panel } from '../../components/dashboard/Panel'
import { SettingsEditor } from '../../components/dashboard/settings/SettingsEditor'
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

    async function reload() {
        const result = await getSettings()
        setSettings(result)
    }

    if (error) {
        return (
            <Panel title="Settings">
                <p role="alert" className="m-0 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                    {error}
                </p>
                <button
                    type="button"
                    onClick={() => {
                        setError(null)
                        void reload().catch((err) => setError(errorText(err)))
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-(--lagoon-deep) px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90 dark:bg-(--lagoon) dark:text-[#4F3D35]"
                >
                    Retry
                </button>
            </Panel>
        )
    }

    if (!settings) {
        return <SettingsSkeleton />
    }

    return <SettingsEditor settings={settings} onChanged={reload} />
}

function SettingsSkeleton() {
    return (
        <div className="flex flex-col gap-4" role="status" aria-label="Loading automation">
            {[0, 1, 2].map((panel) => (
                <div key={panel} className="island-shell rounded-2xl p-6">
                    <div className="mb-4 flex flex-col gap-2">
                        <div
                            className="skeleton-line"
                            style={{ width: panel === 1 ? '6.5rem' : panel === 2 ? '7.5rem' : '8.5rem' }}
                        />
                        <div
                            className="skeleton-line"
                            style={{ width: panel === 1 ? '14rem' : panel === 2 ? '17rem' : '19rem' }}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        {[0, 1].map((row) => (
                            <div key={row} className="h-8 rounded-xl bg-[rgba(236,185,20,0.12)]" />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}