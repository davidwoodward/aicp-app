import { useState, useEffect, useRef, useCallback } from 'react'
import { snippets as snippetsApi, compositions, type Snippet } from '../api'

interface Props {
  promptId: string
  onApplied: (composedBody: string) => void
}

interface ChipItem {
  snippet: Snippet
  included: boolean
}

export default function PromptComposer({ promptId, onApplied }: Props) {
  const [allSnippets, setAllSnippets] = useState<Snippet[]>([])
  const [chips, setChips] = useState<ChipItem[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const dragIdx = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Load all available snippets
  useEffect(() => {
    snippetsApi.list().then(setAllSnippets).catch(() => {})
  }, [])

  // Live preview — debounced on chip changes
  const fetchPreview = useCallback(() => {
    const included = chips.filter(c => c.included)
    if (included.length === 0) {
      setPreview(null)
      return
    }
    setPreviewLoading(true)
    compositions.preview(promptId, included.map(c => c.snippet.id))
      .then(res => setPreview(res.composed_body))
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false))
  }, [promptId, chips])

  useEffect(() => {
    const timer = setTimeout(fetchPreview, 300)
    return () => clearTimeout(timer)
  }, [fetchPreview])

  function addSnippet(snippet: Snippet) {
    if (chips.some(c => c.snippet.id === snippet.id)) return
    setChips(prev => [...prev, { snippet, included: true }])
    setShowPicker(false)
  }

  function removeChip(id: string) {
    setChips(prev => prev.filter(c => c.snippet.id !== id))
  }

  function toggleChip(id: string) {
    setChips(prev => prev.map(c =>
      c.snippet.id === id ? { ...c, included: !c.included } : c
    ))
  }

  // Drag reorder handlers
  function handleChipDragStart(idx: number) {
    dragIdx.current = idx
  }

  function handleChipDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  function handleChipDrop(idx: number) {
    if (dragIdx.current === null || dragIdx.current === idx) {
      dragIdx.current = null
      setDragOverIdx(null)
      return
    }
    setChips(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx.current!, 1)
      next.splice(idx, 0, moved)
      return next
    })
    dragIdx.current = null
    setDragOverIdx(null)
  }

  function handleChipDragEnd() {
    dragIdx.current = null
    setDragOverIdx(null)
  }

  async function handleApply() {
    const included = chips.filter(c => c.included)
    if (included.length === 0) return
    setApplying(true)
    setError('')
    try {
      const result = await compositions.apply(promptId, included.map(c => c.snippet.id))
      onApplied(result.composed_body)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply composition')
    } finally {
      setApplying(false)
    }
  }

  const availableSnippets = allSnippets.filter(s => !chips.some(c => c.snippet.id === s.id))
  const includedCount = chips.filter(c => c.included).length

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span
          style={{ fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}
        >
          Snippets {includedCount > 0 && `(${includedCount})`}
        </span>
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="px-1.5 py-0.5 text-[10px] font-mono text-text-muted hover:text-accent transition-colors"
        >
          + add
        </button>
      </div>

      {/* Snippet picker dropdown */}
      {showPicker && (
        <div
          className="rounded overflow-hidden"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', maxHeight: '140px', overflowY: 'auto' }}
        >
          {availableSnippets.length === 0 ? (
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', padding: '8px' }}>
              {allSnippets.length === 0 ? 'No snippets available' : 'All snippets added'}
            </div>
          ) : (
            availableSnippets.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-surface-1 transition-colors"
                onClick={() => addSnippet(s)}
              >
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', flex: 1, minWidth: 0 }} className="truncate">
                  {s.name}
                </span>
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                  {s.content.length}c
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Chip list — drag to reorder */}
      {chips.length > 0 && (
        <div className="space-y-1">
          {chips.map((chip, idx) => (
            <div
              key={chip.snippet.id}
              draggable
              onDragStart={() => handleChipDragStart(idx)}
              onDragOver={(e) => handleChipDragOver(e, idx)}
              onDrop={() => handleChipDrop(idx)}
              onDragEnd={handleChipDragEnd}
              className="flex items-center gap-1.5 rounded transition-colors"
              style={{
                padding: '3px 6px',
                background: dragOverIdx === idx
                  ? 'rgba(110, 231, 183, 0.12)'
                  : chip.included
                    ? 'rgba(110, 231, 183, 0.06)'
                    : 'var(--color-surface-2)',
                border: dragOverIdx === idx
                  ? '1px solid var(--color-accent)'
                  : chip.included
                    ? '1px solid rgba(110, 231, 183, 0.15)'
                    : '1px solid var(--color-border)',
                opacity: chip.included ? 1 : 0.5,
                cursor: 'grab',
              }}
            >
              {/* Drag handle */}
              <span style={{ fontSize: '8px', color: 'var(--color-text-muted)', flexShrink: 0 }}>⠿</span>

              {/* Order number */}
              <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', flexShrink: 0, width: '12px', textAlign: 'center' }}>
                {idx + 1}
              </span>

              {/* Toggle inclusion */}
              <button
                type="button"
                onClick={() => toggleChip(chip.snippet.id)}
                style={{
                  width: '12px', height: '12px', borderRadius: '2px', flexShrink: 0,
                  background: chip.included ? 'var(--color-accent)' : 'transparent',
                  border: chip.included ? 'none' : '1px solid var(--color-border)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '8px', color: 'var(--color-surface-0)',
                }}
              >
                {chip.included && '✓'}
              </button>

              {/* Name */}
              <span
                style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', flex: 1, minWidth: 0 }}
                className="truncate"
              >
                {chip.snippet.name}
              </span>

              {/* Remove */}
              <button
                type="button"
                onClick={() => removeChip(chip.snippet.id)}
                style={{ fontSize: '10px', color: 'var(--color-text-muted)', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Live preview */}
      {preview !== null && (
        <div>
          <div
            style={{ fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '3px' }}
          >
            Preview {previewLoading && '…'}
          </div>
          <pre
            style={{
              fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)', borderRadius: '4px', padding: '6px 8px',
              lineHeight: 1.5, maxHeight: '120px', overflowY: 'auto', margin: 0,
            }}
          >
            {preview}
          </pre>
        </div>
      )}

      {/* Apply button */}
      {includedCount > 0 && (
        <button
          type="button"
          onClick={handleApply}
          disabled={applying}
          className="w-full px-3 py-1.5 text-[10px] font-mono font-semibold rounded transition-colors disabled:opacity-50"
          style={{
            background: 'rgba(110, 231, 183, 0.12)',
            color: 'var(--color-accent)',
            border: '1px solid rgba(110, 231, 183, 0.2)',
          }}
        >
          {applying ? 'Applying…' : `Apply ${includedCount} snippet${includedCount !== 1 ? 's' : ''}`}
        </button>
      )}

      {error && (
        <div className="px-2 py-1 text-[10px] font-mono bg-danger/10 text-danger border border-danger/20 rounded">
          {error}
        </div>
      )}
    </div>
  )
}
