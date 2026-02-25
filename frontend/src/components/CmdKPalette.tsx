import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { projects as projectsApi, conversations as convsApi } from '../api'
import type { Project, Conversation } from '../api'

interface Props {
  onClose: () => void
}

interface ResultItem {
  id: string
  label: string
  description?: string
  group: 'command' | 'project' | 'conversation'
  action: () => void
}

const STATIC_COMMANDS: Omit<ResultItem, 'action'>[] = [
  { id: 'cmd-new-chat',      label: 'New conversation',   description: 'Start a fresh chat',        group: 'command' },
  { id: 'cmd-projects',      label: 'View projects',      description: 'Open project list',          group: 'command' },
  { id: 'cmd-new-project',   label: 'New project',        description: 'Create a project',           group: 'command' },
]

const GROUP_LABEL: Record<ResultItem['group'], string> = {
  command:      'Commands',
  project:      'Projects',
  conversation: 'Conversations',
}

export default function CmdKPalette({ onClose }: Props) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [convs, setConvs] = useState<Conversation[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)

  // Focus input on mount, load data
  useEffect(() => {
    inputRef.current?.focus()
    projectsApi.list().then(setProjects).catch(() => {})
    convsApi.list().then(setConvs).catch(() => {})
  }, [])

  const buildResults = useCallback((): ResultItem[] => {
    const q = query.toLowerCase().trim()

    const commands: ResultItem[] = STATIC_COMMANDS
      .filter(c => !q || c.label.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q))
      .map(c => ({
        ...c,
        action: () => {
          if (c.id === 'cmd-new-chat') navigate('/')
          else if (c.id === 'cmd-projects') navigate('/projects')
          else if (c.id === 'cmd-new-project') navigate('/projects')
          onClose()
        },
      }))

    const projectItems: ResultItem[] = projects
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      .slice(0, 5)
      .map(p => ({
        id: `project-${p.id}`,
        label: p.name,
        description: p.description,
        group: 'project' as const,
        action: () => { navigate(`/projects/${p.id}/prompts`); onClose() },
      }))

    const convItems: ResultItem[] = convs
      .filter(c => !q || c.title.toLowerCase().includes(q) || c.provider.toLowerCase().includes(q))
      .slice(0, 5)
      .map(c => ({
        id: `conv-${c.id}`,
        label: c.title,
        description: `${c.provider} · ${c.model.split('/').pop()}`,
        group: 'conversation' as const,
        action: () => { navigate(`/c/${c.id}`); onClose() },
      }))

    return [...commands, ...projectItems, ...convItems]
  }, [query, projects, convs, navigate, onClose])

  const results = buildResults()

  // Reset selection when results change
  useEffect(() => { setSelectedIdx(0) }, [query])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      results[selectedIdx].action()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  // Group results for rendering
  const groupedOrder: ResultItem['group'][] = ['command', 'project', 'conversation']
  const grouped = groupedOrder
    .map(g => ({ group: g, items: results.filter(r => r.group === g) }))
    .filter(g => g.items.length > 0)

  // Flat index for keyboard nav (same order as grouped rendering)
  const flatItems = grouped.flatMap(g => g.items)

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ paddingTop: '15vh', background: 'rgba(4, 5, 8, 0.85)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Palette card */}
      <div
        className="cmdk-animate w-full overflow-hidden flex flex-col"
        style={{
          maxWidth: '580px',
          maxHeight: '480px',
          background: 'var(--color-surface-1)',
          border: '1px solid rgba(110, 231, 183, 0.25)',
          borderRadius: '10px',
          boxShadow: '0 0 0 1px rgba(110, 231, 183, 0.08), 0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4"
          style={{ borderBottom: '1px solid var(--color-border)', height: '48px', flexShrink: 0 }}
        >
          <span style={{ fontSize: navigator.platform.includes('Mac') ? '14px' : '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', flexShrink: 0 }}>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, projects, conversations…"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-primary)',
              caretColor: 'var(--color-accent)',
            }}
          />
          <kbd
            onClick={onClose}
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-muted)',
              padding: '2px 5px',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              cursor: 'pointer',
              background: 'var(--color-surface-2)',
              flexShrink: 0,
            }}
          >
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto flex-1 py-1">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center" style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              No results for "{query}"
            </div>
          ) : (
            grouped.map(({ group, items }) => {
              return (
                <div key={group}>
                  {/* Group header */}
                  <div
                    className="px-4 py-1"
                    style={{
                      fontSize: '9px',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-muted)',
                      marginTop: '4px',
                    }}
                  >
                    {GROUP_LABEL[group]}
                  </div>

                  {items.map(item => {
                    const flatIdx = flatItems.indexOf(item)
                    const isSelected = flatIdx === selectedIdx

                    return (
                      <div
                        key={item.id}
                        data-idx={flatIdx}
                        onClick={item.action}
                        onMouseEnter={() => setSelectedIdx(flatIdx)}
                        className="flex items-center gap-3 px-4 cursor-pointer transition-colors"
                        style={{
                          height: '36px',
                          background: isSelected ? 'rgba(110, 231, 183, 0.08)' : 'transparent',
                          borderLeft: isSelected ? '2px solid var(--color-accent)' : '2px solid transparent',
                        }}
                      >
                        {/* Group icon */}
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', flexShrink: 0, width: '16px', textAlign: 'center' }}>
                          {group === 'command' ? '›' : group === 'project' ? '◫' : '◎'}
                        </span>

                        <span
                          className="flex-1 truncate"
                          style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: isSelected ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
                        >
                          {item.label}
                        </span>

                        {item.description && (
                          <span
                            className="truncate"
                            style={{ fontSize: '10px', color: 'var(--color-text-muted)', maxWidth: '160px', flexShrink: 0 }}
                          >
                            {item.description}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-4 px-4 border-t border-border"
          style={{ height: '32px', flexShrink: 0 }}
        >
          {[['↑↓', 'navigate'], ['↵', 'open'], ['esc', 'close']].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
              <kbd style={{ fontFamily: 'var(--font-mono)', padding: '1px 4px', border: '1px solid var(--color-border)', borderRadius: '3px', background: 'var(--color-surface-2)' }}>
                {key}
              </kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
