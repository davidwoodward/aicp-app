import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import AvatarDropdown from './AvatarDropdown'

const isDev = import.meta.env.DEV

interface Props {
  onCmdK?: () => void
  onOpenDeleted?: () => void
  onOpenSettings?: () => void
  onPromptsClick?: () => void
  onOpenProfile?: () => void
  onOpenModels?: () => void
  onToggleLeft?: () => void
  onToggleRight?: () => void
}

export default function TopBar({ onCmdK, onOpenDeleted, onOpenSettings, onPromptsClick, onOpenProfile, onOpenModels, onToggleLeft, onToggleRight }: Props) {
  const location = useLocation()
  const isPrompts = location.pathname === '/'
  const isProjects = location.pathname.startsWith('/projects')

  // Swap favicon to red in dev mode
  useEffect(() => {
    if (!isDev) return
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (link) link.href = '/aicp-icon-dev.svg'
  }, [])

  return (
    <header
      className="flex items-center gap-3 px-3 shrink-0 border-b bg-surface-1"
      style={{ height: '36px', borderColor: isDev ? '#dc2626' : undefined, borderBottomWidth: isDev ? '2px' : undefined }}
    >
      {/* Left panel toggle (mobile only) */}
      {onToggleLeft && (
        <button
          onClick={onToggleLeft}
          className="flex items-center px-1 py-0.5 rounded hover:bg-surface-2 transition-colors"
          title="Toggle navigation"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      <span
        className="flex items-center gap-1.5 text-accent tracking-widest select-none"
        style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 800, letterSpacing: '0.15em' }}
      >
        <img src="/aicp-icon.svg" alt="" width="22" height="22" />
        AICP
      </span>

      <div className="w-px h-3 bg-border" />

      <Link
        to="/"
        onClick={onPromptsClick}
        className={`transition-colors ${isPrompts ? 'text-accent' : 'text-text-muted hover:text-text-secondary'}`}
        style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', textDecoration: 'none' }}
      >
        Prompts
      </Link>
      <Link
        to="/projects"
        className={`transition-colors ${isProjects ? 'text-accent' : 'text-text-muted hover:text-text-secondary'}`}
        style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', textDecoration: 'none' }}
      >
        Projects
      </Link>

      <div className="flex-1" />

      {/* Right panel toggle (mobile only) */}
      {onToggleRight && (
        <button
          onClick={onToggleRight}
          className="flex items-center px-1 py-0.5 rounded hover:bg-surface-2 transition-colors"
          title="Toggle context panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>
      )}

      {/* Cmd+K trigger */}
      {onCmdK && (
        <button
          onClick={onCmdK}
          className="flex items-center px-1.5 py-0.5 rounded border border-border bg-surface-2 hover:border-border-bright transition-colors"
          title={navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      )}

      {/* Recently Deleted (trash icon) */}
      {onOpenDeleted && (
        <button
          onClick={onOpenDeleted}
          className="flex items-center px-1 py-0.5 rounded hover:bg-surface-2 transition-colors"
          title="Recently Deleted"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}

      {/* Settings gear */}
      {onOpenSettings && (
        <button
          onClick={onOpenSettings}
          className="flex items-center px-1 py-0.5 rounded hover:bg-surface-2 transition-colors"
          title="Settings"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      )}

      <ThemeToggle />

      {onOpenProfile && onOpenModels && (
        <AvatarDropdown onOpenProfile={onOpenProfile} onOpenModels={onOpenModels} />
      )}
    </header>
  )
}
