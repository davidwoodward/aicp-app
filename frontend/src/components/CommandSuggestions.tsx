import { useState, useEffect, useRef } from 'react'
import type { SuggestionItem, CommandValidation } from '../hooks/useCommandSuggestions'

interface Props {
  suggestions: SuggestionItem[];
  validation: CommandValidation;
  loading: boolean;
  onSelect: (text: string) => void;
  onDismiss: () => void;
}

// ── Category badge colors ───────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  domain: { bg: 'rgba(110, 231, 183, 0.12)', color: 'var(--color-accent)' },
  action: { bg: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa' },
  arg:    { bg: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' },
  flag:   { bg: 'rgba(139, 92, 246, 0.12)', color: '#a78bfa' },
  value:  { bg: 'rgba(110, 231, 183, 0.08)', color: 'var(--color-text-secondary)' },
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  'configured':     { bg: 'rgba(110, 231, 183, 0.12)', color: 'var(--color-accent)', label: 'configured' },
  'not-configured': { bg: 'rgba(107, 114, 128, 0.12)', color: 'var(--color-text-muted)', label: 'not configured' },
  'idle':           { bg: 'rgba(110, 231, 183, 0.12)', color: 'var(--color-status-idle)', label: 'idle' },
  'busy':           { bg: 'rgba(245, 158, 11, 0.12)', color: 'var(--color-status-busy)', label: 'busy' },
  'offline':        { bg: 'rgba(107, 114, 128, 0.12)', color: 'var(--color-status-offline)', label: 'offline' },
}

// ── Sub-components ──────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.value
  return (
    <span
      style={{
        fontSize: '8px',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '1px 5px',
        borderRadius: '3px',
        background: style.bg,
        color: style.color,
        flexShrink: 0,
      }}
    >
      {category}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status]
  if (!style) return null
  return (
    <span
      style={{
        fontSize: '8px',
        fontFamily: 'var(--font-mono)',
        fontWeight: 500,
        padding: '1px 5px',
        borderRadius: '3px',
        background: style.bg,
        color: style.color,
        flexShrink: 0,
      }}
    >
      {style.label}
    </span>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function CommandSuggestions({ suggestions, validation, loading, onSelect, onDismiss }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemsRef = useRef<HTMLDivElement>(null)

  // Reset active index when suggestions change
  useEffect(() => {
    setActiveIdx(0)
  }, [suggestions.length])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onDismiss()
        return
      }

      if (suggestions.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        const item = suggestions[activeIdx]
        if (item) onSelect(item.text)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [suggestions, activeIdx, onSelect, onDismiss])

  // Click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onDismiss()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onDismiss])

  // Scroll active item into view
  useEffect(() => {
    if (!itemsRef.current) return
    const active = itemsRef.current.children[activeIdx] as HTMLElement
    if (active) active.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  if (suggestions.length === 0 && !validation.error && !validation.valid) return null

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 right-0 mb-1 max-w-3xl mx-auto overflow-hidden z-50"
      style={{
        background: 'var(--color-surface-1)',
        border: `1px solid ${validation.valid ? 'rgba(110, 231, 183, 0.3)' : validation.error ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-border)'}`,
        borderRadius: '8px',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Suggestions list */}
      {suggestions.length > 0 && (
        <div ref={itemsRef} style={{ maxHeight: '220px', overflowY: 'auto' }}>
          {loading && (
            <div className="px-3 py-1.5" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
              Loading data...
            </div>
          )}
          {suggestions.map((item, i) => {
            const active = i === activeIdx
            return (
              <button
                key={`${item.category}-${item.label}-${i}`}
                onClick={() => onSelect(item.text)}
                onMouseEnter={() => setActiveIdx(i)}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2 transition-colors"
                style={{
                  background: active ? 'rgba(110, 231, 183, 0.06)' : 'transparent',
                  borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                }}
              >
                <CategoryBadge category={item.category} />

                <span
                  style={{
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 500,
                    color: active ? 'var(--color-accent)' : 'var(--color-text-primary)',
                    minWidth: 0,
                    flex: 'none',
                  }}
                >
                  {item.label}
                </span>

                <span
                  className="truncate"
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-muted)',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {item.description}
                </span>

                {item.status && <StatusBadge status={item.status} />}
              </button>
            )
          })}
        </div>
      )}

      {/* Validation / usage bar */}
      {validation.usage && (
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
        >
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', opacity: 0.6 }}>
            {validation.usage}
          </span>
        </div>
      )}

      {/* Hint */}
      <div className="flex items-center gap-3 px-3 py-1" style={{ borderTop: '1px solid var(--color-border)' }}>
        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', opacity: 0.5 }}>
          Tab to complete &middot; &uarr;&darr; navigate &middot; Esc dismiss
        </span>
      </div>
    </div>
  )
}
