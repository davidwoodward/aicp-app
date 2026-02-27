import { useState, useEffect, useRef, useCallback } from 'react'
import {
  snippets as snippetsApi,
  snippetCollections as collectionsApi,
} from '../api'
import type { Snippet, SnippetCollection } from '../api'

interface Props {
  onClose: () => void
  onRefresh: () => void
  onCreateAndEdit?: () => void
}

type Tab = 'snippets' | 'collections'
type FilterMode = 'active' | 'archived'

export default function SnippetManagementPanel({ onClose, onRefresh, onCreateAndEdit }: Props) {
  const [tab, setTab] = useState<Tab>('snippets')

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(4, 5, 8, 0.85)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full overflow-hidden flex flex-col"
        style={{
          maxWidth: '560px',
          maxHeight: '600px',
          background: 'var(--color-surface-1)',
          border: '1px solid rgba(110, 231, 183, 0.20)',
          borderRadius: '10px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <span style={{
            fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}>
            Snippet Manager
          </span>
          <button
            onClick={onClose}
            style={{
              fontSize: '14px', color: 'var(--color-text-muted)', background: 'none',
              border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0,
            }}
          >
            &#x2715;
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex px-4 pt-3 pb-0 gap-1 shrink-0">
          {(['snippets', 'collections'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600,
                padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                background: tab === t ? 'rgba(110, 231, 183, 0.12)' : 'transparent',
                color: tab === t ? 'var(--color-accent)' : 'var(--color-text-muted)',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {tab === 'snippets' ? (
            <SnippetsTab onRefresh={onRefresh} onCreateAndEdit={onCreateAndEdit} />
          ) : (
            <CollectionsTab onRefresh={onRefresh} />
          )}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Snippets Tab
// ──────────────────────────────────────────────

function SnippetsTab({ onRefresh, onCreateAndEdit }: { onRefresh: () => void; onCreateAndEdit?: () => void }) {
  const [filter, setFilter] = useState<FilterMode>('active')
  const [items, setItems] = useState<Snippet[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'archive' | 'delete' | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const fetcher = filter === 'active' ? snippetsApi.list() : snippetsApi.listDeleted()
    fetcher.then(setItems).catch(() => setItems([])).finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])

  async function handleArchive(id: string) {
    const item = items.find(s => s.id === id)
    setItems(prev => prev.filter(s => s.id !== id))
    try {
      await snippetsApi.delete(id)
      onRefresh()
    } catch {
      if (item) setItems(prev => [...prev, item])
    }
    setConfirmId(null)
    setConfirmAction(null)
  }

  async function handleRestore(id: string) {
    const item = items.find(s => s.id === id)
    setItems(prev => prev.filter(s => s.id !== id))
    try {
      await snippetsApi.restore(id)
      onRefresh()
    } catch {
      if (item) setItems(prev => [...prev, item])
    }
  }

  async function handlePermanentDelete(id: string) {
    setItems(prev => prev.filter(s => s.id !== id))
    try {
      await snippetsApi.permanentDelete(id)
      onRefresh()
    } catch {
      load()
    }
    setConfirmId(null)
    setConfirmAction(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter + new button */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <div className="flex gap-1">
          {(['active', 'archived'] as FilterMode[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: '10px', fontFamily: 'var(--font-mono)',
                padding: '2px 8px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                background: filter === f ? 'var(--color-surface-3)' : 'transparent',
                color: filter === f ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>
        {filter === 'active' && (
          <button
            onClick={() => onCreateAndEdit?.()}
            style={{
              fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600,
              padding: '3px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer',
              background: 'rgba(110, 231, 183, 0.12)', color: 'var(--color-accent)',
            }}
          >
            + New
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-3">
        {loading ? (
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', padding: '8px 0' }}>
            Loading...
          </div>
        ) : items.length === 0 ? (
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', padding: '8px 0' }}>
            {filter === 'active' ? 'No snippets' : 'No archived snippets'}
          </div>
        ) : (
          <div className="space-y-1">
            {items.map(snippet => (
              <div
                key={snippet.id}
                className="flex items-center gap-2 rounded px-3 py-2"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                    {snippet.name || 'Untitled'}
                  </div>
                  <div className="truncate" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                    {snippet.content.slice(0, 60)}{snippet.content.length > 60 ? '...' : ''}
                  </div>
                </div>

                {/* Actions */}
                {filter === 'active' ? (
                  confirmId === snippet.id && confirmAction === 'archive' ? (
                    <ConfirmInline
                      label="Archive?"
                      onYes={() => handleArchive(snippet.id)}
                      onNo={() => { setConfirmId(null); setConfirmAction(null) }}
                    />
                  ) : (
                    <ActionButton
                      label="Archive"
                      color="var(--color-text-muted)"
                      onClick={() => { setConfirmId(snippet.id); setConfirmAction('archive') }}
                    />
                  )
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    {confirmId === snippet.id && confirmAction === 'delete' ? (
                      <ConfirmInline
                        label="Delete forever?"
                        onYes={() => handlePermanentDelete(snippet.id)}
                        onNo={() => { setConfirmId(null); setConfirmAction(null) }}
                        danger
                      />
                    ) : (
                      <>
                        <ActionButton label="Restore" color="var(--color-accent)" onClick={() => handleRestore(snippet.id)} />
                        <ActionButton label="Delete" color="var(--color-danger)" onClick={() => { setConfirmId(snippet.id); setConfirmAction('delete') }} />
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Collections Tab
// ──────────────────────────────────────────────

function CollectionsTab({ onRefresh }: { onRefresh: () => void }) {
  const [filter, setFilter] = useState<FilterMode>('active')
  const [items, setItems] = useState<SnippetCollection[]>([])
  const [allSnippets, setAllSnippets] = useState<Snippet[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'archive' | 'delete' | null>(null)
  const [newName, setNewName] = useState('')
  const [showNewInput, setShowNewInput] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showPicker, setShowPicker] = useState<string | null>(null)
  const newInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    const fetcher = filter === 'active' ? collectionsApi.list() : collectionsApi.listDeleted()
    Promise.all([fetcher, snippetsApi.list()])
      .then(([cols, snips]) => { setItems(cols); setAllSnippets(snips) })
      .catch(() => { setItems([]); setAllSnippets([]) })
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (showNewInput) newInputRef.current?.focus()
  }, [showNewInput])

  async function handleCreateCollection() {
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      const col = await collectionsApi.create({ name: newName.trim() })
      setItems(prev => [col, ...prev])
      setNewName('')
      setShowNewInput(false)
      onRefresh()
    } catch { /* ignore */ }
    setCreating(false)
  }

  async function handleArchive(id: string) {
    const item = items.find(c => c.id === id)
    setItems(prev => prev.filter(c => c.id !== id))
    try {
      await collectionsApi.delete(id)
      onRefresh()
    } catch {
      if (item) setItems(prev => [...prev, item])
    }
    setConfirmId(null)
    setConfirmAction(null)
  }

  async function handleRestore(id: string) {
    const item = items.find(c => c.id === id)
    setItems(prev => prev.filter(c => c.id !== id))
    try {
      await collectionsApi.restore(id)
      onRefresh()
    } catch {
      if (item) setItems(prev => [...prev, item])
    }
  }

  async function handlePermanentDelete(id: string) {
    setItems(prev => prev.filter(c => c.id !== id))
    try {
      await collectionsApi.permanentDelete(id)
      onRefresh()
    } catch {
      load()
    }
    setConfirmId(null)
    setConfirmAction(null)
  }

  async function addSnippetToCollection(collectionId: string, snippetId: string) {
    const col = items.find(c => c.id === collectionId)
    if (!col || col.snippet_ids.includes(snippetId)) return

    const updated = [...col.snippet_ids, snippetId]
    setItems(prev => prev.map(c => c.id === collectionId ? { ...c, snippet_ids: updated } : c))
    try {
      await collectionsApi.update(collectionId, { snippet_ids: updated })
    } catch {
      setItems(prev => prev.map(c => c.id === collectionId ? { ...c, snippet_ids: col.snippet_ids } : c))
    }
    setShowPicker(null)
  }

  async function removeSnippetFromCollection(collectionId: string, snippetId: string) {
    const col = items.find(c => c.id === collectionId)
    if (!col) return

    const updated = col.snippet_ids.filter(id => id !== snippetId)
    setItems(prev => prev.map(c => c.id === collectionId ? { ...c, snippet_ids: updated } : c))
    try {
      await collectionsApi.update(collectionId, { snippet_ids: updated })
    } catch {
      setItems(prev => prev.map(c => c.id === collectionId ? { ...c, snippet_ids: col.snippet_ids } : c))
    }
  }

  async function reorderSnippetInCollection(collectionId: string, fromIdx: number, toIdx: number) {
    const col = items.find(c => c.id === collectionId)
    if (!col) return

    const reordered = [...col.snippet_ids]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    setItems(prev => prev.map(c => c.id === collectionId ? { ...c, snippet_ids: reordered } : c))
    try {
      await collectionsApi.update(collectionId, { snippet_ids: reordered })
    } catch {
      setItems(prev => prev.map(c => c.id === collectionId ? { ...c, snippet_ids: col.snippet_ids } : c))
    }
  }

  const snippetMap = new Map(allSnippets.map(s => [s.id, s]))

  return (
    <div className="flex flex-col h-full">
      {/* Filter + new button */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <div className="flex gap-1">
          {(['active', 'archived'] as FilterMode[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: '10px', fontFamily: 'var(--font-mono)',
                padding: '2px 8px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                background: filter === f ? 'var(--color-surface-3)' : 'transparent',
                color: filter === f ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>
        {filter === 'active' && (
          <button
            onClick={() => setShowNewInput(true)}
            style={{
              fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600,
              padding: '3px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer',
              background: 'rgba(110, 231, 183, 0.12)', color: 'var(--color-accent)',
            }}
          >
            + New
          </button>
        )}
      </div>

      {/* Inline new collection input */}
      {showNewInput && (
        <div className="flex items-center gap-2 px-4 pb-2 shrink-0">
          <input
            ref={newInputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Collection name"
            style={{
              flex: 1, fontSize: '11px', fontFamily: 'var(--font-mono)',
              padding: '4px 8px', borderRadius: '4px',
              border: '1px solid var(--color-border)', background: 'var(--color-surface-2)',
              color: 'var(--color-text-primary)', outline: 'none',
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreateCollection()
              if (e.key === 'Escape') { setShowNewInput(false); setNewName('') }
            }}
          />
          <button
            onClick={handleCreateCollection}
            disabled={!newName.trim() || creating}
            style={{
              fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600,
              padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer',
              background: newName.trim() ? 'var(--color-accent)' : 'var(--color-surface-2)',
              color: newName.trim() ? '#000' : 'var(--color-text-muted)',
            }}
          >
            {creating ? '...' : 'Create'}
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-3">
        {loading ? (
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', padding: '8px 0' }}>
            Loading...
          </div>
        ) : items.length === 0 ? (
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', padding: '8px 0' }}>
            {filter === 'active' ? 'No collections' : 'No archived collections'}
          </div>
        ) : (
          <div className="space-y-1">
            {items.map(col => {
              const isExpanded = expandedId === col.id

              return (
                <div key={col.id}>
                  <div
                    className="flex items-center gap-2 rounded px-3 py-2"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
                  >
                    {/* Expand toggle */}
                    {filter === 'active' && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : col.id)}
                        style={{
                          fontSize: '7px', color: 'var(--color-text-muted)', background: 'none',
                          border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1,
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s ease', flexShrink: 0,
                        }}
                      >
                        &#x25B6;
                      </button>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="truncate" style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                        {col.name}
                      </div>
                      <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                        {col.snippet_ids.length} snippet{col.snippet_ids.length !== 1 ? 's' : ''}
                        {col.description && ` \u2014 ${col.description}`}
                      </div>
                    </div>

                    {/* Actions */}
                    {filter === 'active' ? (
                      confirmId === col.id && confirmAction === 'archive' ? (
                        <ConfirmInline
                          label="Archive?"
                          onYes={() => handleArchive(col.id)}
                          onNo={() => { setConfirmId(null); setConfirmAction(null) }}
                        />
                      ) : (
                        <ActionButton
                          label="Archive"
                          color="var(--color-text-muted)"
                          onClick={() => { setConfirmId(col.id); setConfirmAction('archive') }}
                        />
                      )
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        {confirmId === col.id && confirmAction === 'delete' ? (
                          <ConfirmInline
                            label="Delete forever?"
                            onYes={() => handlePermanentDelete(col.id)}
                            onNo={() => { setConfirmId(null); setConfirmAction(null) }}
                            danger
                          />
                        ) : (
                          <>
                            <ActionButton label="Restore" color="var(--color-accent)" onClick={() => handleRestore(col.id)} />
                            <ActionButton label="Delete" color="var(--color-danger)" onClick={() => { setConfirmId(col.id); setConfirmAction('delete') }} />
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expanded snippet list for collection */}
                  {isExpanded && filter === 'active' && (
                    <CollectionSnippetList
                      collection={col}
                      snippetMap={snippetMap}
                      allSnippets={allSnippets}
                      onAdd={(snippetId) => addSnippetToCollection(col.id, snippetId)}
                      onRemove={(snippetId) => removeSnippetFromCollection(col.id, snippetId)}
                      onReorder={(fromIdx, toIdx) => reorderSnippetInCollection(col.id, fromIdx, toIdx)}
                      showPicker={showPicker === col.id}
                      onTogglePicker={() => setShowPicker(showPicker === col.id ? null : col.id)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Collection snippet list (expanded)
// ──────────────────────────────────────────────

function CollectionSnippetList({
  collection,
  snippetMap,
  allSnippets,
  onAdd,
  onRemove,
  onReorder,
  showPicker,
  onTogglePicker,
}: {
  collection: SnippetCollection
  snippetMap: Map<string, Snippet>
  allSnippets: Snippet[]
  onAdd: (snippetId: string) => void
  onRemove: (snippetId: string) => void
  onReorder: (fromIdx: number, toIdx: number) => void
  showPicker: boolean
  onTogglePicker: () => void
}) {
  const dragIdx = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const available = allSnippets.filter(s => !collection.snippet_ids.includes(s.id))

  return (
    <div
      className="ml-4 mt-1 mb-1 space-y-0.5"
      style={{ paddingLeft: '8px', borderLeft: '1px solid var(--color-border)' }}
    >
      {collection.snippet_ids.length === 0 && (
        <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', padding: '4px 0' }}>
          No snippets in collection
        </div>
      )}

      {collection.snippet_ids.map((sid, idx) => {
        const snippet = snippetMap.get(sid)
        if (!snippet) return null

        return (
          <div
            key={sid}
            draggable
            onDragStart={() => { dragIdx.current = idx }}
            onDragOver={e => { e.preventDefault(); setDragOverIdx(idx) }}
            onDrop={() => {
              if (dragIdx.current !== null && dragIdx.current !== idx) {
                onReorder(dragIdx.current, idx)
              }
              dragIdx.current = null
              setDragOverIdx(null)
            }}
            onDragEnd={() => { dragIdx.current = null; setDragOverIdx(null) }}
            className="flex items-center gap-1.5 rounded px-2 py-1 group"
            style={{
              background: dragOverIdx === idx ? 'rgba(110, 231, 183, 0.08)' : 'transparent',
              cursor: 'grab',
            }}
          >
            <span style={{ fontSize: '8px', color: 'var(--color-text-muted)', flexShrink: 0 }}>&#x2801;</span>
            <span
              className="truncate flex-1"
              style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}
            >
              {snippet.name}
            </span>
            <button
              onClick={() => onRemove(sid)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ fontSize: '10px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0, flexShrink: 0 }}
            >
              &#x00D7;
            </button>
          </div>
        )
      })}

      {/* Add snippet button + picker */}
      <div>
        <button
          onClick={onTogglePicker}
          style={{
            fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)',
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
          }}
        >
          + add snippet
        </button>

        {showPicker && (
          <div
            className="rounded mt-1 overflow-hidden"
            style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', maxHeight: '120px', overflowY: 'auto' }}
          >
            {available.length === 0 ? (
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', padding: '6px 8px' }}>
                {allSnippets.length === 0 ? 'No snippets available' : 'All snippets added'}
              </div>
            ) : (
              available.map(s => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-surface-1 transition-colors"
                  onClick={() => onAdd(s.id)}
                >
                  <span className="truncate" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', flex: 1, minWidth: 0 }}>
                    {s.name}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Shared micro-components
// ──────────────────────────────────────────────

function ActionButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      style={{
        fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600,
        padding: '3px 8px', borderRadius: '3px', border: 'none',
        cursor: 'pointer', background: 'transparent', color, flexShrink: 0,
      }}
    >
      {label}
    </button>
  )
}

function ConfirmInline({ label, onYes, onNo, danger }: { label: string; onYes: () => void; onNo: () => void; danger?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: danger ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
        {label}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onYes() }}
        style={{
          fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600,
          padding: '2px 6px', borderRadius: '3px', border: 'none', cursor: 'pointer',
          background: danger ? 'var(--color-danger)' : 'var(--color-accent)',
          color: danger ? '#fff' : '#000',
        }}
      >
        Yes
      </button>
      <button
        onClick={e => { e.stopPropagation(); onNo() }}
        style={{
          fontSize: '10px', fontFamily: 'var(--font-mono)',
          padding: '2px 6px', borderRadius: '3px', cursor: 'pointer',
          background: 'transparent', color: 'var(--color-text-muted)',
          border: '1px solid var(--color-border)',
        }}
      >
        No
      </button>
    </div>
  )
}
