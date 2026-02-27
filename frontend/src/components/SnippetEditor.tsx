import { useState, useEffect, useRef, useCallback } from 'react'
import { snippets as snippetsApi } from '../api'
import type { Snippet } from '../api'

interface Props {
  snippetId: string
  onClose: () => void
}

function generateTitleFromContent(content: string): string {
  if (!content.trim()) return 'Untitled'
  const firstLine = content.trim().split('\n')[0].trim()
  if (!firstLine) return 'Untitled'
  const threshold = 35
  if (firstLine.length <= threshold) return firstLine
  for (let i = threshold; i < Math.min(firstLine.length, threshold + 15); i++) {
    if (/[\s.,;:!?)\-]/.test(firstLine[i])) return firstLine.slice(0, i).trimEnd()
  }
  return firstLine.slice(0, threshold)
}

export default function SnippetEditor({ snippetId, onClose }: Props) {
  const [snippet, setSnippet] = useState<Snippet | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoad = useRef(true)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const isNewSnippet = useRef(false)

  // Load snippet
  useEffect(() => {
    initialLoad.current = true
    setLoading(true)
    setError(null)
    snippetsApi.get(snippetId)
      .then(s => {
        setSnippet(s)
        setName(s.name)
        setContent(s.content)
        setSaveStatus('idle')
        isNewSnippet.current = !s.name
      })
      .catch(() => setError('Failed to load snippet'))
      .finally(() => {
        setLoading(false)
        // Allow a tick for state to settle before enabling auto-save
        setTimeout(() => { initialLoad.current = false }, 50)
      })
  }, [snippetId])

  // Auto-focus content textarea for new snippets
  useEffect(() => {
    if (!loading && isNewSnippet.current && contentRef.current) {
      contentRef.current.focus()
    }
  }, [loading])

  // Auto-save with debounce
  const doSave = useCallback(async (n: string, c: string) => {
    setSaveStatus('saving')
    try {
      await snippetsApi.update(snippetId, { name: n, content: c })
      setSaveStatus('saved')
    } catch {
      setSaveStatus('idle')
    }
  }, [snippetId])

  useEffect(() => {
    if (initialLoad.current || !snippet) return
    if (name === snippet.name && content === snippet.content) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(name, content), 500)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [name, content, snippet, doSave])

  // Close handler: flush pending save, auto-title if needed
  const handleClose = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }

    const finalName = name.trim() ? name.trim() : generateTitleFromContent(content)
    if (finalName !== name || (snippet && (finalName !== snippet.name || content !== snippet.content))) {
      try {
        await snippetsApi.update(snippetId, { name: finalName, content })
      } catch { /* best-effort */ }
    }

    onClose()
  }, [name, content, snippet, snippetId, onClose])

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleClose])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--color-surface-1)' }}>
        <div className="typing-indicator">
          <span className="dot" /><span className="dot" /><span className="dot" />
        </div>
      </div>
    )
  }

  if (error || !snippet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3" style={{ background: 'var(--color-surface-1)' }}>
        <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-danger)' }}>
          {error || 'Snippet not found'}
        </div>
        <button
          onClick={onClose}
          style={{
            fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '5px 16px',
            borderRadius: '4px', background: 'var(--color-surface-2)',
            color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)',
            cursor: 'pointer',
          }}
        >
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-surface-1)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{ height: '48px', borderBottom: '1px solid var(--color-border)' }}
      >
        <button
          onClick={handleClose}
          style={{
            fontSize: '16px', color: 'var(--color-text-muted)', background: 'none',
            border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 2px',
            flexShrink: 0,
          }}
          title="Close editor (Esc)"
        >
          &#x2190;
        </button>

        <span
          style={{
            fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: 'var(--color-text-primary)', flexShrink: 0,
          }}
        >
          Snippet Editor
        </span>

        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{
            flex: 1, fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600,
            background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
            borderRadius: '4px', padding: '4px 8px', outline: 'none',
            color: 'var(--color-text-primary)', caretColor: 'var(--color-accent)',
            minWidth: 0,
          }}
          placeholder="Snippet name"
        />

        <span
          style={{
            fontSize: '10px', fontFamily: 'var(--font-mono)',
            color: saveStatus === 'saving' ? 'var(--color-accent)' : 'var(--color-text-muted)',
            flexShrink: 0, transition: 'color 0.2s',
          }}
        >
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
        </span>

        {confirmDelete ? (
          <span className="flex items-center gap-1.5" style={{ flexShrink: 0 }}>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>Delete?</span>
            <button
              disabled={archiving}
              onClick={async () => {
                if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
                setArchiving(true)
                try {
                  await snippetsApi.delete(snippetId)
                  onClose()
                } catch {
                  setArchiving(false)
                  setConfirmDelete(false)
                }
              }}
              style={{
                fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 8px',
                borderRadius: '4px', background: archiving ? 'var(--color-surface-2)' : 'rgba(239, 68, 68, 0.8)',
                color: '#fff', border: 'none', cursor: archiving ? 'default' : 'pointer',
              }}
            >
              {archiving ? 'Deleting...' : 'Yes'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 8px',
                borderRadius: '4px', background: 'none',
                color: 'var(--color-text-muted)', border: '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              No
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center px-1 py-0.5 rounded hover:bg-surface-2 transition-colors"
            style={{ flexShrink: 0 }}
            title="Delete snippet"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden px-12 py-6">
        <textarea
          ref={contentRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          style={{
            width: '100%', height: '100%', resize: 'none',
            fontSize: '12px', fontFamily: 'var(--font-mono)', lineHeight: 1.7,
            background: 'var(--color-surface-2)', color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)', borderRadius: '6px',
            padding: '12px 14px', outline: 'none', boxSizing: 'border-box',
            caretColor: 'var(--color-accent)',
          }}
          placeholder="Snippet content..."
        />
      </div>

    </div>
  )
}
