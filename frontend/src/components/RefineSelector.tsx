import { useState, useEffect, useRef } from 'react'

export type RefineMode = 'manual' | 'auto'

interface Props {
  onSelect: (mode: RefineMode) => void
  onDismiss: () => void
}

const STORAGE_KEY = 'aicp:refine-mode'

const OPTIONS: { mode: RefineMode; label: string; description: string }[] = [
  { mode: 'manual', label: 'Manual', description: 'Edit the prompt yourself' },
  { mode: 'auto', label: 'Auto', description: 'LLM generates a refined version' },
]

function getSavedMode(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'auto') return 1
  } catch {}
  return 0
}

export default function RefineSelector({ onSelect, onDismiss }: Props) {
  const [activeIdx, setActiveIdx] = useState(getSavedMode)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onDismiss(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, OPTIONS.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const opt = OPTIONS[activeIdx]
        localStorage.setItem(STORAGE_KEY, opt.mode)
        onSelect(opt.mode)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeIdx, onSelect, onDismiss])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onDismiss()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onDismiss])

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 right-0 mb-1 max-w-3xl mx-auto overflow-hidden z-50"
      style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div
        className="px-3 py-1.5"
        style={{
          borderBottom: '1px solid var(--color-border)',
          fontSize: '9px',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}
      >
        Refine Mode
      </div>

      <div>
        {OPTIONS.map((opt, i) => {
          const active = i === activeIdx
          return (
            <button
              key={opt.mode}
              onClick={() => {
                localStorage.setItem(STORAGE_KEY, opt.mode)
                onSelect(opt.mode)
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className="w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors"
              style={{
                background: active ? 'rgba(110, 231, 183, 0.06)' : 'transparent',
                borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: active ? 'var(--color-accent)' : 'var(--color-text-primary)',
                }}
              >
                {opt.label}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-text-muted)',
                }}
              >
                {opt.description}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center px-3 py-1" style={{ borderTop: '1px solid var(--color-border)' }}>
        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', opacity: 0.5 }}>
          &uarr;&darr; navigate &middot; Enter select &middot; Esc dismiss
        </span>
      </div>
    </div>
  )
}
