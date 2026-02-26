import { useState, useEffect, useRef } from 'react'
import { models as modelsApi, type ModelInfo } from '../api'

interface Props {
  currentProvider: string
  currentModel: string
  onSelect: (provider: string, model: string) => void
  onDismiss: () => void
}

export default function ModelSelector({ currentProvider, currentModel, onSelect, onDismiss }: Props) {
  const [items, setItems] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIdx, setActiveIdx] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    modelsApi.list()
      .then(data => {
        const configured = data.providers.filter(p => p.configured)
        setItems(configured)
        const idx = configured.findIndex(
          p => p.name === currentProvider && p.model === currentModel,
        )
        if (idx >= 0) setActiveIdx(idx)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentProvider, currentModel])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onDismiss(); return }
      if (items.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = items[activeIdx]
        if (item) onSelect(item.name, item.model)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [items, activeIdx, onSelect, onDismiss])

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
        Select Model
      </div>

      {loading ? (
        <div className="px-3 py-4 text-center" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
          Loading...
        </div>
      ) : items.length === 0 ? (
        <div className="px-3 py-4 text-center" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
          No configured models.
        </div>
      ) : (
        <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
          {items.map((item, i) => {
            const active = i === activeIdx
            const isCurrent = item.name === currentProvider && item.model === currentModel
            return (
              <button
                key={`${item.name}:${item.model}`}
                onClick={() => onSelect(item.name, item.model)}
                onMouseEnter={() => setActiveIdx(i)}
                className="w-full text-left flex items-center gap-3 px-3 py-2 transition-colors"
                style={{
                  background: active ? 'rgba(110, 231, 183, 0.06)' : 'transparent',
                  borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                }}
              >
                <span
                  style={{
                    width: '12px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: 'var(--color-accent)',
                    textAlign: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isCurrent ? '*' : ''}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 500,
                    color: active ? 'var(--color-accent)' : 'var(--color-text-primary)',
                  }}
                >
                  {item.name}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {item.model}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-center px-3 py-1" style={{ borderTop: '1px solid var(--color-border)' }}>
        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', opacity: 0.5 }}>
          &uarr;&darr; navigate &middot; Enter select &middot; Esc dismiss
        </span>
      </div>
    </div>
  )
}
