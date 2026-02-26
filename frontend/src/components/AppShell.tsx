import { useState, useEffect } from 'react'
import { Outlet, Link } from 'react-router-dom'
import NavPanel from './NavPanel'
import TelemetryPanel from './TelemetryPanel'
import CmdKPalette from './CmdKPalette'
import ThemeToggle from './ThemeToggle'
import RecentlyDeletedPanel from './RecentlyDeletedPanel'

interface Props {
  provider: string
  model: string
  onModelChange: (provider: string, model: string) => void
}

export default function AppShell({ provider, model, onModelChange }: Props) {
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [deletedPanelOpen, setDeletedPanelOpen] = useState(false)
  const [navKey, setNavKey] = useState(0)
  const [selectedProject, setSelectedProject] = useState<string | null>(() => {
    try { return localStorage.getItem('aicp:last-project') } catch { return null }
  })

  // Persist project selection
  useEffect(() => {
    try {
      if (selectedProject) localStorage.setItem('aicp:last-project', selectedProject)
      else localStorage.removeItem('aicp:last-project')
    } catch {}
  }, [selectedProject])

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
          className="flex items-center gap-1.5 text-accent tracking-widest select-none"
          style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 800, letterSpacing: '0.15em' }}
        >
          <img src="/aicp-icon.svg" alt="" width="22" height="22" />
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

        {/* Settings gear — opens Recently Deleted */}
        <button
          onClick={() => setDeletedPanelOpen(true)}
          className="flex items-center px-1 py-0.5 rounded hover:bg-surface-2 transition-colors"
          title="Recently Deleted"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        <ThemeToggle />
      </header>

      {/* ── Three-panel body ─────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — Navigation */}
        <div className="shrink-0 border-r border-border overflow-hidden" style={{ width: '240px' }}>
          <NavPanel key={navKey} onProjectSelect={setSelectedProject} />
        </div>

        {/* Center — Chat / command interface */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Outlet context={{ selectedProject, setSelectedProject }} />
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

      {/* Recently Deleted panel */}
      {deletedPanelOpen && (
        <RecentlyDeletedPanel
          onClose={() => setDeletedPanelOpen(false)}
          onRestore={() => setNavKey(k => k + 1)}
        />
      )}
    </div>
  )
}
