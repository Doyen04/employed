import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Zap } from 'lucide-react'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="marketing-footer">
      <div className="page-wrap footer-grid">
        <div className="footer-brand-column">
          <Link to="/" className="marketing-brand" aria-label="Employed home">
            <span className="brand-mark"><Zap aria-hidden="true" /></span>
            <span>Employed</span>
          </Link>
          <p>AI-powered Telegram intelligence for people who would rather act than scroll.</p>
        </div>
        <div className="footer-links">
          <div><b>Product</b><a href="#product">Features</a><a href="#how-it-works">How it works</a><a href="#security">Security</a></div>
          <div><b>Access</b><Link to="/login">Sign in</Link><Link to="/dashboard">Dashboard <ArrowUpRight /></Link></div>
        </div>
      </div>
      <div className="page-wrap footer-bottom">
        <span>© {year} Employed. Built for better attention.</span>
        <span>Private by design · Always on</span>
      </div>
    </footer>
  )
}
