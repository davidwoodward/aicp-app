import { useState, useEffect, useRef, useCallback } from 'react'
import { snippets as snippetsApi } from '../api'
import type { Snippet } from '../api'

interface Props {
  onSelect: (snippet: Snippet) => void
  onDismiss: () => void
}

export default function SnippetSelectorModal({ onSelect, onDismiss }: Props) {
  const [snippetList, setSnippetList] = useState<Snippet[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    snippetsApi.list()
      .then(setSnippetList)
      .catch(() => setSnippetList([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = query.trim()
    ? snippetList.filter(s =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.content.toLowerCase().includes(query.toLowerCase())
      )
    : snippetList

  // Reset selection when query changes
  useEffect(() => { setSelectedIdx(0) }, [query])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      onSelect(filtered[selectedIdx])
    } else if (e.key === 'Escape') {
      onDismiss()
    }
  }, [filtered, selectedIdx, onSelect, onDismiss])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ paddingTop: '15vh', background: 'rgba(4, 5, 8, 0.85)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div
        className="w-full overflow-hidden flex flex-col"
        style={{
          maxWidth: '520px',
          maxHeight: '420px',
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
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-accent)', flexShrink: 0 }}>
            Snippets
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search snippets..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: '13px', fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-primary)', caretColor: 'var(--color-accent)',
            }}
          />
          <kbd
            onClick={onDismiss}
            style={{
              fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)',
              padding: '2px 5px', border: '1px solid var(--color-border)', borderRadius: '4px',
              cursor: 'pointer', background: 'var(--color-surface-2)', flexShrink: 0,
            }}
          >
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto flex-1 py-1">
          {loading ? (
            <div className="px-4 py-6 text-center">
              <div className="typing-indicator" style={{ justifyContent: 'center' }}>
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-6 text-center" style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              {snippetList.length === 0 ? 'No snippets yet' : `No results for "${query}"`}
            </div>
          ) : (
            filtered.map((snippet, idx) => (
              <div
                key={snippet.id}
                data-idx={idx}
                onClick={() => onSelect(snippet)}
                onMouseEnter={() => setSelectedIdx(idx)}
                className="px-4 py-2 cursor-pointer transition-colors"
                style={{
                  background: idx === selectedIdx ? 'rgba(110, 231, 183, 0.08)' : 'transparent',
                  borderLeft: idx === selectedIdx ? '2px solid var(--color-accent)' : '2px solid transparent',
                }}
              >
                <div
                  className="truncate"
                  style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: idx === selectedIdx ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
                >
                  {snippet.name}
                </div>
                <div
                  className="truncate mt-0.5"
                  style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
                >
                  {snippet.content.slice(0, 80)}{snippet.content.length > 80 ? '...' : ''}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-4 px-4 border-t border-border"
          style={{ height: '32px', flexShrink: 0 }}
        >
          {[['↑↓', 'navigate'], ['↵', 'insert'], ['esc', 'close']].map(([key, label]) => (
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
