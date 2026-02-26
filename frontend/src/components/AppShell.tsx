import { useState, useEffect } from 'react'
import { Outlet, Link } from 'react-router-dom'
import PlanTree from './PlanTree'
import TelemetryPanel from './TelemetryPanel'
import CmdKPalette from './CmdKPalette'
import ThemeToggle from './ThemeToggle'

interface Props {
  provider: string
  model: string
  onModelChange: (provider: string, model: string) => void
}

export default function AppShell({ provider, model, onModelChange }: Props) {
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [planningMode, setPlanningMode] = useState(false)

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdkOpen(v => !v)
      }
      if (e.key === 'Escape') setCmdkOpen(false)
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface-0">

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header
        className="flex items-center gap-3 px-3 shrink-0 border-b border-border bg-surface-1"
        style={{ height: '36px' }}
      >
        <span
          className="text-accent tracking-widest select-none"
          style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 800, letterSpacing: '0.15em' }}
        >
          AICP
        </span>

        <div className="w-px h-3 bg-border" />

        <Link
          to="/projects"
          className="text-text-muted hover:text-text-secondary transition-colors"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', textDecoration: 'none' }}
        >
          Projects
        </Link>

        <div className="flex-1" />

        {/* Planning Assist toggle */}
        <button
          onClick={() => setPlanningMode(v => !v)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded transition-all"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            border: planningMode
              ? '1px solid rgba(110, 231, 183, 0.5)'
              : '1px solid var(--color-border)',
            background: planningMode
              ? 'rgba(110, 231, 183, 0.12)'
              : 'var(--color-surface-2)',
            color: planningMode
              ? 'var(--color-accent)'
              : 'var(--color-text-muted)',
          }}
          title={planningMode ? 'Planning Assist: ON — actions require confirmation' : 'Planning Assist: OFF'}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: planningMode ? 'var(--color-accent)' : 'var(--color-border)',
              transition: 'background 0.15s',
              flexShrink: 0,
            }}
          />
          Plan
        </button>

        {/* Cmd+K trigger */}
        <button
          onClick={() => setCmdkOpen(true)}
          className="flex items-center px-1.5 py-0.5 rounded border border-border bg-surface-2 hover:border-border-bright transition-colors"
          title={navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        <ThemeToggle />
      </header>

      {/* ── Three-panel body ─────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — Plan tree */}
        <div className="shrink-0 border-r border-border overflow-hidden" style={{ width: '240px' }}>
          <PlanTree onProjectSelect={setSelectedProject} />
        </div>

        {/* Center — Chat / command interface */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Outlet context={{ hideSidebar: true, planningMode }} />
        </div>

        {/* Right — Telemetry + context bar */}
        <div className="shrink-0 border-l border-border overflow-hidden" style={{ width: '272px' }}>
          <TelemetryPanel
            provider={provider}
            model={model}
            onModelChange={onModelChange}
            selectedProject={selectedProject}
          />
        </div>
      </div>

      {/* Cmd+K palette overlay */}
      {cmdkOpen && <CmdKPalette onClose={() => setCmdkOpen(false)} />}
    </div>
  )
}
