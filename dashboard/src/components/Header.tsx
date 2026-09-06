import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Zap } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="marketing-header">
      <nav className="page-wrap marketing-nav" aria-label="Main navigation">
        <Link to="/" className="marketing-brand" aria-label="Employed home">
          <span className="brand-mark"><Zap aria-hidden="true" /></span>
          <span>Employed</span>
        </Link>

        <div className="marketing-links">
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#use-cases">Use cases</a>
          <a href="#security">Security</a>
        </div>

        <div className="marketing-actions">
          <ThemeToggle />
          <Link to="/login" className="header-login">Sign in</Link>
          <Link to="/dashboard" className="header-cta">
            Open app <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </nav>
    </header>
  )
}
