import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from 'react'
import { prompts as api, type Prompt } from '../api'
import type { PromptMetrics } from '../api'
import StatusBadge from '../components/StatusBadge'
import { StatusFilter, filterPromptsByStatus, type StatusFilterValue } from '../components/StatusFilter'
import { useTreeMetrics } from '../hooks/useTreeMetrics'
import { useCollapseState } from '../hooks/useCollapseState'

interface Props {
  projectId: string
  prompts: Prompt[]
  setPrompts: Dispatch<SetStateAction<Prompt[]>>
}

const HEAT_BG: Record<string, string> = {
  neutral: 'transparent',
  light: 'rgba(110, 231, 183, 0.04)',
  medium: 'rgba(110, 231, 183, 0.08)',
  strong: 'rgba(110, 231, 183, 0.14)',
}

function buildTree(items: Prompt[], parentId: string | null = null): Prompt[] {
  return items
    .filter((p) => p.parent_prompt_id === parentId)
    .sort((a, b) => a.order_index - b.order_index)
}

function isDescendant(promptId: string, ancestorId: string, allPrompts: Prompt[]): boolean {
  const byId = new Map(allPrompts.map(p => [p.id, p]))
  let current = byId.get(promptId)
  while (current) {
    if (current.parent_prompt_id === ancestorId) return true
    current = current.parent_prompt_id ? byId.get(current.parent_prompt_id) : undefined
  }
  return false
}

function TreeNode({
  prompt,
  allPrompts,
  depth,
  onAddChild,
  onDelete,
  onRestore,
  onPermanentDelete,
  onDrop,
  metricsMap,
  isCollapsed,
  onToggleCollapse,
}: {
  prompt: Prompt
  allPrompts: Prompt[]
  depth: number
  onAddChild: (parentId: string) => void
  onDelete: (p: Prompt) => void
  onRestore?: (p: Prompt) => void
  onPermanentDelete?: (p: Prompt) => void
  onDrop: (draggedId: string, targetId: string | null) => void
  metricsMap: Map<string, PromptMetrics>
  isCollapsed: (id: string) => boolean
  onToggleCollapse: (id: string) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false)
  const dragLeaveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const children = buildTree(allPrompts, prompt.id)
  const hasChildren = children.length > 0
  const collapsed = isCollapsed(prompt.id)
  const isArchived = !!prompt.deleted_at

  const metrics = metricsMap.get(prompt.id)
  const heatBg = HEAT_BG[metrics?.heatmap_level ?? 'neutral']

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', prompt.id)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    clearTimeout(dragLeaveTimeout.current)
    setDragOver(true)
  }

  function handleDragLeave() {
    dragLeaveTimeout.current = setTimeout(() => setDragOver(false), 50)
  }

  function handleDropOnNode(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const draggedId = e.dataTransfer.getData('text/plain')
    if (!draggedId || draggedId === prompt.id) return
    // Prevent dropping on own descendant (cycle)
    if (isDescendant(prompt.id, draggedId, allPrompts)) return
    onDrop(draggedId, prompt.id)
  }

  return (
    <div>
      <div
        draggable={!isArchived}
        onDragStart={isArchived ? undefined : handleDragStart}
        onDragOver={isArchived ? undefined : handleDragOver}
        onDragLeave={isArchived ? undefined : handleDragLeave}
        onDrop={isArchived ? undefined : handleDropOnNode}
        className="group flex items-center gap-2 py-1.5 px-2 rounded hover:bg-surface-2 transition-colors cursor-pointer"
        style={{
          paddingLeft: `${depth * 20 + 8}px`,
          background: dragOver ? 'rgba(110, 231, 183, 0.12)' : heatBg,
          borderLeft: dragOver ? '3px solid var(--color-accent)' : '3px solid transparent',
          opacity: isArchived ? 0.8 : 1,
          transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
        }}
      >
        {/* Expand/collapse */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(prompt.id) }}
          className={`w-4 h-4 flex items-center justify-center text-text-muted text-[10px] font-mono ${!hasChildren ? 'invisible' : ''}`}
        >
          {collapsed ? '▶' : '▼'}
        </button>

        {/* Connector line */}
        {depth > 0 && (
          <div className="w-2 h-px bg-border-bright" />
        )}

        {/* Status */}
        <StatusBadge status={prompt.status} />

        {/* Title */}
        <span className="text-sm font-medium truncate flex-1">{prompt.title}</span>

        {/* Stale badge */}
        {!isArchived && metrics?.stale && (
          <span
            title="No activity in 7+ days"
            style={{ fontSize: '12px', flexShrink: 0, color: 'var(--color-status-offline)', lineHeight: 1 }}
          >
            ⚠
          </span>
        )}

        {/* Actions */}
        {isArchived ? (
          <div className="hidden group-hover:flex items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onRestore?.(prompt) }}
              className="p-0.5 rounded hover:bg-accent/15 transition-colors"
              title="Restore prompt"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
            {confirmPermanentDelete ? (
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded ml-0.5"
                style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-danger)' }}>Delete forever?</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onPermanentDelete?.(prompt); setConfirmPermanentDelete(false) }}
                  className="px-1 py-0 rounded text-[9px] font-mono font-bold transition-colors"
                  style={{ background: 'rgba(239, 68, 68, 0.8)', color: '#fff' }}
                >
                  Yes
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmPermanentDelete(false) }}
                  className="px-1 py-0 rounded text-[9px] font-mono text-text-muted hover:text-text-primary transition-colors"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmPermanentDelete(true) }}
                className="p-0.5 rounded hover:bg-danger/15 transition-colors ml-0.5"
                title="Permanently delete"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="hidden group-hover:flex items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onAddChild(prompt.id) }}
              className="px-1.5 py-0.5 text-[10px] font-mono text-text-muted hover:text-accent transition-colors"
            >
              +child
            </button>
            {confirmDelete ? (
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded ml-0.5"
                style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-danger)' }}>Archive?</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(prompt); setConfirmDelete(false) }}
                  className="px-1 py-0 rounded text-[9px] font-mono font-bold transition-colors"
                  style={{ background: 'rgba(239, 68, 68, 0.8)', color: '#fff' }}
                >
                  Yes
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
                  className="px-1 py-0 rounded text-[9px] font-mono text-text-muted hover:text-text-primary transition-colors"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
                className="p-0.5 rounded hover:bg-danger/15 transition-colors ml-0.5"
                title="Archive"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {!collapsed && children.map((child) => (
        <TreeNode
          key={child.id}
          prompt={child}
          allPrompts={allPrompts}
          depth={depth + 1}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onRestore={onRestore}
          onPermanentDelete={onPermanentDelete}
          onDrop={onDrop}
          metricsMap={metricsMap}
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
        />
      ))}
    </div>
  )
}

type PromptFilter = 'active' | 'all' | 'archived'

export default function PromptTree({ projectId, prompts, setPrompts }: Props) {
  const [creating, setCreating] = useState<{ parentId: string | null } | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [rootDropOver, setRootDropOver] = useState(false)
  const [filter, setFilter] = useState<PromptFilter>('active')
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('draft+ready')
  const [archivedPrompts, setArchivedPrompts] = useState<Prompt[]>([])
  const [archivedLoadKey, setArchivedLoadKey] = useState(0)

  const { metricsMap, refresh: refreshMetrics } = useTreeMetrics(projectId)
  const { isCollapsed, toggle: toggleCollapse } = useCollapseState(projectId)

  // Load archived prompts when filter needs them or when archive state changes
  useEffect(() => {
    if (filter === 'archived' || filter === 'all') {
      api.listDeleted(projectId).then(setArchivedPrompts).catch(() => setArchivedPrompts([]))
    }
  }, [filter, projectId, archivedLoadKey])

  const basePrompts = filter === 'active'
    ? prompts
    : filter === 'archived'
      ? archivedPrompts
      : [...prompts, ...archivedPrompts]
  const displayPrompts = filter === 'active'
    ? filterPromptsByStatus(basePrompts, statusFilter)
    : basePrompts
  const roots = buildTree(displayPrompts, null)

  const handleDrop = useCallback(async (draggedId: string, targetId: string | null) => {
    const dragged = prompts.find(p => p.id === draggedId)
    if (!dragged) return
    if (dragged.parent_prompt_id === targetId) return

    // Optimistic update
    const snapshot = [...prompts]
    setPrompts(prev => prev.map(p =>
      p.id === draggedId ? { ...p, parent_prompt_id: targetId } : p
    ))

    try {
      await api.update(draggedId, { parent_prompt_id: targetId })
      refreshMetrics()
    } catch (err: unknown) {
      setPrompts(snapshot)
      setError(err instanceof Error ? err.message : 'Failed to move prompt')
    }
  }, [prompts, setPrompts, refreshMetrics])

  function openCreate(parentId: string | null) {
    setCreating({ parentId })
    setTitle('')
    setBody('')
    setError('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!creating) return
    setSaving(true)
    setError('')
    try {
      const tempId = `temp-${crypto.randomUUID()}`
      const optimistic: Prompt = {
        id: tempId,
        project_id: projectId,
        title,
        body,
        status: 'draft',
        order_index: prompts.length,
        parent_prompt_id: creating.parentId,
        agent_id: null,
        created_at: new Date().toISOString(),
        sent_at: null,
        done_at: null,
        deleted_at: null,
      }
      setPrompts(prev => [...prev, optimistic])
      setCreating(null)
      try {
        const saved = await api.create({
          project_id: projectId,
          title,
          body,
          order_index: prompts.length,
          parent_prompt_id: creating.parentId,
        })
        setPrompts(prev => prev.map(p => p.id === tempId ? saved : p))
        refreshMetrics()
      } catch (err: unknown) {
        setPrompts(prev => prev.filter(p => p.id !== tempId))
        setError(err instanceof Error ? err.message : 'Failed to create')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDirect(prompt: Prompt) {
    const snapshot = prompt
    setPrompts(prev => prev.filter(p => p.id !== snapshot.id))
    try {
      await api.delete(snapshot.id)
      // Trigger a refetch of archived prompts so it appears in Archived/All
      setArchivedLoadKey(k => k + 1)
      refreshMetrics()
    } catch (err: unknown) {
      setPrompts(prev => [...prev, snapshot])
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  async function handleRestore(prompt: Prompt) {
    try {
      const restored = await api.restore(prompt.id)
      // Add back to active prompts
      setPrompts(prev => [...prev, restored].sort((a, b) => a.order_index - b.order_index))
      // Remove from archived view
      setArchivedPrompts(prev => prev.filter(p => p.id !== prompt.id))
      refreshMetrics()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to restore')
    }
  }

  async function handlePermanentDelete(prompt: Prompt) {
    const snapshot = prompt
    setArchivedPrompts(prev => prev.filter(p => p.id !== snapshot.id))
    try {
      await api.permanentDelete(snapshot.id)
    } catch (err: unknown) {
      setArchivedPrompts(prev => [snapshot, ...prev])
      setError(err instanceof Error ? err.message : 'Failed to permanently delete')
    }
  }

  function handleRootDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setRootDropOver(true)
  }

  function handleRootDragLeave() {
    setRootDropOver(false)
  }

  function handleRootDrop(e: React.DragEvent) {
    e.preventDefault()
    setRootDropOver(false)
    const draggedId = e.dataTransfer.getData('text/plain')
    if (!draggedId) return
    handleDrop(draggedId, null)
  }

  return (
    <div className="flex gap-4">
      {/* Tree */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Prompt Tree</span>
            <div className="flex items-center gap-0.5 ml-2">
              {(['active', 'all', 'archived'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded transition-colors"
                  style={{
                    background: filter === f ? 'rgba(110, 231, 183, 0.12)' : 'transparent',
                    color: filter === f ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    border: filter === f ? '1px solid rgba(110, 231, 183, 0.25)' : '1px solid transparent',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            {filter === 'active' && (
              <>
                <div style={{ width: '1px', height: '16px', background: 'var(--color-border)', flexShrink: 0, marginLeft: '4px', marginRight: '4px' }} />
                <StatusFilter value={statusFilter} onChange={setStatusFilter} />
              </>
            )}
          </div>
          {filter === 'active' && (
            <button
              onClick={() => openCreate(null)}
              className="px-2 py-1 text-[10px] font-mono font-medium bg-accent/10 text-accent border border-accent/20 rounded hover:bg-accent/20 transition-colors"
            >
              + Root Prompt
            </button>
          )}
        </div>

        {roots.length === 0 ? (
          <div className="text-center py-10 text-text-muted text-sm">
            {filter === 'active' ? 'No prompts yet.' : filter === 'archived' ? 'No archived prompts.' : 'No prompts yet.'}
          </div>
        ) : (
          <div className="bg-surface-1 border border-border rounded-lg p-2">
            {/* Root drop zone (top) — only in active view */}
            {filter === 'active' && (
              <div
                onDragOver={handleRootDragOver}
                onDragLeave={handleRootDragLeave}
                onDrop={handleRootDrop}
                className="rounded transition-colors"
                style={{
                  height: rootDropOver ? '32px' : '4px',
                  background: rootDropOver ? 'rgba(110, 231, 183, 0.12)' : 'transparent',
                  borderLeft: rootDropOver ? '3px solid var(--color-accent)' : '3px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'height 0.15s, background 0.15s, border-color 0.15s',
                }}
              >
                {rootDropOver && (
                  <span className="text-[10px] font-mono text-accent">Drop here to make root</span>
                )}
              </div>
            )}

            {roots.map((p) => (
              <TreeNode
                key={p.id}
                prompt={p}
                allPrompts={displayPrompts}
                depth={0}
                onAddChild={(parentId) => openCreate(parentId)}
                onDelete={handleDeleteDirect}
                onRestore={handleRestore}
                onPermanentDelete={handlePermanentDelete}
                onDrop={handleDrop}
                metricsMap={metricsMap}
                isCollapsed={isCollapsed}
                onToggleCollapse={toggleCollapse}
              />
            ))}

            {/* Root drop zone (bottom) — only in active view */}
            {filter === 'active' && (
              <div
                onDragOver={handleRootDragOver}
                onDragLeave={handleRootDragLeave}
                onDrop={handleRootDrop}
                className="rounded transition-colors"
                style={{
                  height: rootDropOver ? '32px' : '4px',
                  background: rootDropOver ? 'rgba(110, 231, 183, 0.12)' : 'transparent',
                  borderLeft: rootDropOver ? '3px solid var(--color-accent)' : '3px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'height 0.15s, background 0.15s, border-color 0.15s',
                }}
              >
                {rootDropOver && (
                  <span className="text-[10px] font-mono text-accent">Drop here to make root</span>
                )}
              </div>
            )}
          </div>
        )}

        {error && !creating && (
          <div className="mt-2 px-2 py-1.5 text-[10px] font-mono bg-danger/10 text-danger border border-danger/20 rounded">
            {error}
          </div>
        )}
      </div>

      {/* Create panel */}
      {creating && (
        <div className="w-80 shrink-0">
          <form onSubmit={handleSave} className="bg-surface-1 border border-border rounded-lg p-4 space-y-3 sticky top-16">
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider mb-2">
              New Prompt
            </div>

            {error && (
              <div className="px-2 py-1.5 text-[10px] font-mono bg-danger/10 text-danger border border-danger/20 rounded">
                {error}
              </div>
            )}

            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface-2 border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
              autoFocus
            />

            <textarea
              placeholder="Prompt body..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 text-sm bg-surface-2 border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 resize-y font-mono text-xs leading-relaxed"
            />

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-3 py-2 text-xs font-mono font-semibold bg-accent text-surface-0 rounded hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setCreating(null)}
                className="px-3 py-2 text-xs font-mono text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
