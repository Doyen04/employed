import { Link } from '@tanstack/react-router'
import { ArrowLeft, Compass, Home } from 'lucide-react'

export function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md mx-auto space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--lagoon)]/15 text-[var(--sea-ink)] dark:text-(--lagoon) border border-(--lagoon)/30">
          <Compass className="w-8 h-8 animate-pulse text-[var(--sea-ink)] dark:text-[var(--lagoon)]" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
            404 Error
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--sea-ink)] dark:text-zinc-100">
            Page Not Found
          </h1>
          <p className="text-sm text-[var(--sea-ink-soft)] dark:text-zinc-400 leading-relaxed">
            The page or resource you are looking for doesn't exist, has been moved, or is temporarily unavailable.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--lagoon-deep)] text-white dark:bg-(--lagoon) dark:text-[#4F3D35] font-medium text-sm transition-all hover:opacity-90"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--surface-strong)] border border-[var(--line)] text-(--sea-ink) dark:text-zinc-200 font-medium text-sm hover:bg-white/60 dark:hover:bg-zinc-800/60 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Landing Page
          </Link>
        </div>
      </div>
    </div>
  )
}
