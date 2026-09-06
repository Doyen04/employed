import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Activity,
  ArrowRight,
  BellRing,
  BrainCircuit,
  Check,
  ChevronRight,
  Clock3,
  EyeOff,
  LockKeyhole,
  MessageCircle,
  Radio,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Webhook,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const Route = createFileRoute('/')({ component: LandingPage })

function LandingPage() {
  return (
    <main className="landing-page">
      <section className="hero-section page-wrap" aria-labelledby="hero-heading">
        <div className="hero-copy landing-reveal">
          <a className="eyebrow-pill" href="#how-it-works">
            <span className="live-dot" />
            Your always-on Telegram signal layer
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <h1 id="hero-heading" className="hero-title">
            Stop reading everything.
            <span> See what matters.</span>
          </h1>
          <p className="hero-subtitle">
            Employed watches the Telegram conversations you choose, uses AI to understand every
            message, and triggers the right action the moment something important appears.
          </p>
          <div className="hero-actions">
            <Link to="/dashboard" className="primary-cta">
              Open your command center
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a href="#product" className="secondary-cta">
              See how it works
            </a>
          </div>
          <div className="hero-proof" aria-label="Product benefits">
            <span><Check /> Personal Telegram connection</span>
            <span><Check /> No noisy inbox</span>
            <span><Check /> Encrypted secrets</span>
          </div>
        </div>

        <ProductPreview />
      </section>

      <section className="signal-strip" aria-label="The Employed workflow">
        <div className="page-wrap signal-strip-inner">
          <span>Telegram</span>
          <ArrowRight aria-hidden="true" />
          <span>AI analysis</span>
          <ArrowRight aria-hidden="true" />
          <span>Your rules</span>
          <ArrowRight aria-hidden="true" />
          <span className="signal-strip-result">Action, instantly</span>
        </div>
      </section>

      <section id="product" className="landing-section page-wrap">
        <SectionIntro
          kicker="Built for signal, not scroll"
          title="Your conversations become an intelligent workflow"
          description="Employed turns high-volume Telegram activity into a calm, structured feed of the moments that deserve your attention."
        />

        <div className="bento-grid">
          <FeatureCard
            className="bento-wide"
            icon={Radio}
            eyebrow="Listen"
            title="Monitor only the conversations that matter"
            description="Connect your personal Telegram account, pull in your chats, and switch monitoring on or off with one click."
          >
            <div className="channel-list" aria-hidden="true">
              {[
                ['Product Signals', '12 new', true],
                ['Founder Network', '8 new', true],
                ['General Chat', '43 new', false],
              ].map(([name, count, enabled]) => (
                <div className="channel-row" key={String(name)}>
                  <span className="channel-avatar">{String(name).charAt(0)}</span>
                  <span className="channel-name">{name}</span>
                  <span className="channel-count">{count}</span>
                  <span className={`mini-toggle ${enabled ? 'is-on' : ''}`} />
                </div>
              ))}
            </div>
          </FeatureCard>

          <FeatureCard
            icon={BrainCircuit}
            eyebrow="Understand"
            title="Teach AI what important means to you"
            description="Use your own prompt and output schema to classify urgency, intent, sentiment, opportunity—or anything else."
          >
            <div className="analysis-chip-row" aria-hidden="true">
              <span>urgency <b>high</b></span>
              <span>intent <b>buying</b></span>
            </div>
          </FeatureCard>

          <FeatureCard
            icon={BellRing}
            eyebrow="Act"
            title="Route the signal, automatically"
            description="Match simple conditions against the AI output, then send the result to Telegram or your webhook."
          >
            <div className="route-visual" aria-hidden="true">
              <span><SlidersHorizontal /> urgency = high</span>
              <ArrowRight />
              <span><Webhook /> webhook</span>
            </div>
          </FeatureCard>

          <FeatureCard
            className="bento-wide bento-dark"
            icon={Activity}
            eyebrow="Know"
            title="A live view of what your system sees"
            description="Watch analyzed messages arrive in real time, inspect the structured output, and review every dispatched action."
          >
            <div className="activity-wave" aria-hidden="true">
              {[35, 58, 42, 76, 50, 88, 60, 96, 72, 46, 80, 55].map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
          </FeatureCard>
        </div>
      </section>

      <section id="how-it-works" className="landing-section workflow-section">
        <div className="page-wrap">
          <SectionIntro
            kicker="One calm workflow"
            title="From message overload to decisive action"
            description="Set it up once. Employed stays connected and keeps your intelligence pipeline moving in the background."
          />
          <div className="workflow-grid">
            {STEPS.map((step, index) => (
              <article className="workflow-card" key={step.title}>
                <div className="workflow-number">0{index + 1}</div>
                <step.icon aria-hidden="true" />
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="use-cases" className="landing-section page-wrap use-cases-section">
        <div>
          <p className="section-kicker">Made for high-signal work</p>
          <h2 className="section-title">The right message should never depend on perfect timing.</h2>
          <p className="section-description">
            Whether you track opportunities, customers, communities, or operations, Employed gives
            every important message a reliable path to action.
          </p>
          <Link to="/dashboard" className="text-cta">
            Build your signal layer <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <div className="use-case-list">
          {USE_CASES.map((item) => (
            <article className="use-case-row" key={item.title}>
              <div className="use-case-icon"><item.icon aria-hidden="true" /></div>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <ChevronRight aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <section id="security" className="landing-section page-wrap">
        <div className="security-panel">
          <div className="security-orbit" aria-hidden="true">
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
            <div className="security-lock"><LockKeyhole /></div>
          </div>
          <div className="security-copy">
            <p className="section-kicker">Private by design</p>
            <h2 className="section-title">Your signal stays yours.</h2>
            <p className="section-description">
              Employed runs through a private worker and dashboard. Telegram sessions and notifier
              credentials are encrypted at rest with AES-256-GCM, and the worker API is protected
              by bearer-token authentication.
            </p>
            <div className="security-points">
              <span><ShieldCheck /> Encrypted sessions and secrets</span>
              <span><EyeOff /> Private, authenticated dashboard</span>
              <span><LockKeyhole /> No credentials exposed to the browser</span>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="landing-section page-wrap faq-section">
        <SectionIntro
          kicker="Straight answers"
          title="Before you leave the noise behind"
          description="Everything you need to know about how the product works."
        />
        <div className="faq-list">
          {FAQS.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}<span>+</span></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="final-cta page-wrap">
        <div className="final-cta-glow" aria-hidden="true" />
        <Sparkles className="final-cta-icon" aria-hidden="true" />
        <p className="section-kicker">Your attention is valuable</p>
        <h2>Let the noise scroll by.<br />You’ll get the signal.</h2>
        <p>Connect Telegram, define what matters, and let Employed take it from there.</p>
        <Link to="/dashboard" className="primary-cta primary-cta-light">
          Start with Employed <ArrowRight aria-hidden="true" />
        </Link>
      </section>
    </main>
  )
}

function ProductPreview() {
  return (
    <div className="product-preview landing-reveal landing-reveal-delay" aria-label="Employed live analysis preview">
      <div className="preview-topbar">
        <div className="preview-brand"><span className="brand-mark"><Zap /></span> Employed</div>
        <div className="preview-status"><span /> Worker online</div>
      </div>
      <div className="preview-body">
        <div className="preview-sidebar" aria-hidden="true">
          <span className="is-active"><Activity /></span>
          <span><MessageCircle /></span>
          <span><SlidersHorizontal /></span>
        </div>
        <div className="preview-content">
          <div className="preview-heading">
            <div><small>Live intelligence</small><strong>Signal feed</strong></div>
            <span><Radio /> Listening</span>
          </div>
          <article className="message-card message-card-main">
            <div className="message-meta"><span className="message-avatar">PS</span><span><b>Product Signals</b><small>Alex · just now</small></span><span className="priority-badge">High signal</span></div>
            <p>Looking for a workflow tool that can route urgent community requests into our ops stack.</p>
            <div className="message-analysis">
              <div><BrainCircuit /><span>AI analysis complete</span></div>
              <span className="analysis-value">intent: buying</span>
              <span className="analysis-value">urgency: high</span>
            </div>
          </article>
          <article className="message-card message-card-muted" aria-hidden="true">
            <div className="message-meta"><span className="message-avatar alt">FN</span><span><b>Founder Network</b><small>Maya · 2m ago</small></span></div>
            <p>Does anyone have recommendations for a launch analytics setup?</p>
          </article>
          <div className="action-toast">
            <span className="action-toast-icon"><Send /></span>
            <span><b>Webhook dispatched</b><small>Rule “High-intent lead” matched</small></span>
            <Check />
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionIntro({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return (
    <div className="section-intro">
      <p className="section-kicker">{kicker}</p>
      <h2 className="section-title">{title}</h2>
      <p className="section-description">{description}</p>
    </div>
  )
}

function FeatureCard({ icon: Icon, eyebrow, title, description, className = '', children }: {
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <article className={`bento-card ${className}`}>
      <div className="feature-icon"><Icon aria-hidden="true" /></div>
      <p className="feature-eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </article>
  )
}

const STEPS: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: MessageCircle, title: 'Connect Telegram', description: 'Authenticate your personal account securely with phone, OTP, and optional 2FA.' },
  { icon: Radio, title: 'Choose your signal', description: 'Pull in your chats and select exactly which conversations the worker should monitor.' },
  { icon: BrainCircuit, title: 'Define what matters', description: 'Shape the AI analysis with your prompt, structured output, and simple matching rules.' },
  { icon: Zap, title: 'Let actions flow', description: 'Send matched signals to Telegram or webhooks and review every result in the action log.' },
]

const USE_CASES: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: Sparkles, title: 'Opportunity detection', description: 'Surface buying intent, partnership requests, and valuable introductions.' },
  { icon: Clock3, title: 'Urgent operations', description: 'Escalate time-sensitive issues before they disappear in a busy group.' },
  { icon: MessageCircle, title: 'Community intelligence', description: 'Track themes, sentiment, and meaningful feedback across your communities.' },
]

const FAQS = [
  { question: 'Does Employed use a bot account?', answer: 'No. It connects to a personal Telegram account through an authenticated MTProto session, then listens only to the chats you choose to monitor.' },
  { question: 'Can I decide how messages are analyzed?', answer: 'Yes. Analysis configurations contain your own prompt template and structured output schema, so you define exactly what the AI should extract.' },
  { question: 'What can happen when a rule matches?', answer: 'The current worker can dispatch a Telegram notification or call a webhook. Every attempt is recorded with its status and error details.' },
  { question: 'What happens if the worker briefly goes offline?', answer: 'When the persistent listener reconnects, it can backfill recent messages from monitored chats using its last-seen position.' },
]
