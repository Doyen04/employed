import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, BellRing, BrainCircuit, Radio } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const Route = createFileRoute('/')({ component: LandingPage })

function LandingPage() {
  return (
    <main className="page-wrap px-4 pb-16 pt-12">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-14 text-center sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.3),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(94,146,178,0.22),transparent_66%)]" />
        <p className="island-kicker mb-4">Employed</p>
        <h1 className="display-title mx-auto max-w-2xl text-4xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-5xl md:text-6xl">
          Watch Telegram groups. Analyze with AI. Act automatically.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm text-[var(--sea-ink-soft)] sm:text-base">
          A personal Telegram connection listens to the channels you choose, an open-source LLM
          scores every message, and your rules turn those scores into notifications or actions —
          all driven from a private dashboard.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#2f9e92,#56c6be)] px-6 py-3 text-sm font-semibold text-white no-underline transition hover:-translate-y-0.5"
          >
            Open the dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="island-shell feature-card rounded-2xl p-6">
            <feature.icon className="mb-3 h-6 w-6 text-[var(--lagoon-deep)]" aria-hidden="true" />
            <h2 className="m-0 text-base font-semibold text-[var(--sea-ink)]">{feature.title}</h2>
            <p className="m-0 mt-1.5 text-sm text-[var(--sea-ink-soft)]">{feature.description}</p>
          </div>
        ))}
      </div>
    </main>
  )
}

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Radio,
    title: 'Real-time listening',
    description:
      'A persistent process keeps your Telegram session alive and streams messages from the groups you monitor the moment they arrive.',
  },
  {
    icon: BrainCircuit,
    title: 'LLM analysis',
    description:
      'Every message is scored by an open-source LLM against your own prompt and output schema — no rules to hand-craft per channel.',
  },
  {
    icon: BellRing,
    title: 'Rules & actions',
    description:
      'Plug-and-play notifiers (Telegram, webhooks, email…) fire when an analysis matches a rule. Everything is configuration, none of it hardcoded.',
  },
]