import { useState, useRef, useCallback, type Dispatch, type SetStateAction } from 'react'
import { prompts as api, type Prompt, type DayActivity } from '../api'
import type { PromptMetrics } from '../api'
import StatusBadge from '../components/StatusBadge'
import PromptComposer from '../components/PromptComposer'
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

function Sparkline({ data }: { data: DayActivity[] }) {
  const counts = data.map(d => d.count)
  const max = Math.max(...counts, 1)
  const W = 42
  const H = 14
  const barW = 5
  const gap = 1
  return (
    <svg width={W} height={H} style={{ flexShrink: 0, opacity: 0.7 }}>
      {counts.slice(-7).map((v, i) => {
        const barH = Math.max(1, Math.round((v / max) * H))
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={H - barH}
            width={barW}
            height={barH}
            fill={v > 0 ? 'var(--color-accent)' : 'var(--color-border)'}
            rx={1}
          />
        )
      })}
    </svg>
  )
}

function TreeNode({
  prompt,
  allPrompts,
  depth,
  onEdit,
  onAddChild,
  onDrop,
  metricsMap,
  timelineMap,
  isCollapsed,
  onToggleCollapse,
}: {
  prompt: Prompt
  allPrompts: Prompt[]
  depth: number
  onEdit: (p: Prompt) => void
  onAddChild: (parentId: string) => void
  onDrop: (draggedId: string, targetId: string | null) => void
  metricsMap: Map<string, PromptMetrics>
  timelineMap: Map<string, DayActivity[]>
  isCollapsed: (id: string) => boolean
  onToggleCollapse: (id: string) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const dragLeaveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const children = buildTree(allPrompts, prompt.id)
  const hasChildren = children.length > 0
  const collapsed = isCollapsed(prompt.id)

  const metrics = metricsMap.get(prompt.id)
  const timeline = timelineMap.get(prompt.id)
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
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropOnNode}
        className="group flex items-center gap-2 py-1.5 px-2 rounded hover:bg-surface-2 transition-colors cursor-pointer"
        style={{
          paddingLeft: `${depth * 20 + 8}px`,
          background: dragOver ? 'rgba(110, 231, 183, 0.12)' : heatBg,
          borderLeft: dragOver ? '3px solid var(--color-accent)' : '3px solid transparent',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {/* Expand/collapse */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(prompt.id) }}
          className={`w-4 h-4 flex items-center justify-center text-text-muted text-[10px] font-mono ${!hasChildren ? 'invisible' : ''}`}
        >
          {collapsed ? '▶' : '▼'}
        </button>

        {/* Sparkline for parent nodes */}
        {hasChildren && timeline && timeline.length > 0 && (
          <Sparkline data={timeline} />
        )}

        {/* Connector line */}
        {depth > 0 && (
          <div className="w-2 h-px bg-border-bright" />
        )}

        {/* Status */}
        <StatusBadge status={prompt.status} />

        {/* Title */}
        <span className="text-sm font-medium truncate flex-1">{prompt.title}</span>

        {/* Stale badge */}
        {metrics?.stale && (
          <span
            title="No activity in 7+ days"
            style={{ fontSize: '12px', flexShrink: 0, color: 'var(--color-status-offline)', lineHeight: 1 }}
          >
            ⚠
          </span>
        )}

        {/* Actions */}
        <div className="hidden group-hover:flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(prompt) }}
            className="px-1.5 py-0.5 text-[10px] font-mono text-text-muted hover:text-text-primary transition-colors"
          >
            edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(prompt.id) }}
            className="px-1.5 py-0.5 text-[10px] font-mono text-text-muted hover:text-accent transition-colors"
          >
            +child
          </button>
        </div>
      </div>

      {/* Children */}
      {!collapsed && children.map((child) => (
        <TreeNode
          key={child.id}
          prompt={child}
          allPrompts={allPrompts}
          depth={depth + 1}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDrop={onDrop}
          metricsMap={metricsMap}
          timelineMap={timelineMap}
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
        />
      ))}
    </div>
  )
}

export default function PromptTree({ projectId, prompts, setPrompts }: Props) {
  const [editing, setEditing] = useState<Prompt | null>(null)
  const [creating, setCreating] = useState<{ parentId: string | null } | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [rootDropOver, setRootDropOver] = useState(false)

  const { metricsMap, timelineMap, refresh: refreshMetrics } = useTreeMetrics(projectId)
  const { isCollapsed, toggle: toggleCollapse } = useCollapseState(projectId)

  const roots = buildTree(prompts, null)

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

  function openEdit(p: Prompt) {
    setEditing(p)
    setCreating(null)
    setTitle(p.title)
    setBody(p.body)
    setStatus(p.status)
    setError('')
  }

  function openCreate(parentId: string | null) {
    setCreating({ parentId })
    setEditing(null)
    setTitle('')
    setBody('')
    setStatus('')
    setError('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) {
        const updates: Record<string, unknown> = { title, body }
        if (status && status !== editing.status) updates.status = status
        const snapshot = editing
        const optimistic = { ...editing, title, body, ...(status && status !== editing.status ? { status: status as Prompt['status'] } : {}) }
        setPrompts(prev => prev.map(p => p.id === editing.id ? optimistic : p))
        setEditing(null)
        setCreating(null)
        try {
          const saved = await api.update(snapshot.id, updates)
          setPrompts(prev => prev.map(p => p.id === saved.id ? saved : p))
          refreshMetrics()
        } catch (err: unknown) {
          setPrompts(prev => prev.map(p => p.id === snapshot.id ? snapshot : p))
          setError(err instanceof Error ? err.message : 'Failed to save')
          setEditing(snapshot)
          setTitle(snapshot.title)
          setBody(snapshot.body)
          setStatus(snapshot.status)
        }
      } else if (creating) {
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
        }
        setPrompts(prev => [...prev, optimistic])
        setEditing(null)
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
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing) return
    setSaving(true)
    const snapshot = editing
    setPrompts(prev => prev.filter(p => p.id !== snapshot.id))
    setEditing(null)
    try {
      await api.delete(snapshot.id)
      refreshMetrics()
    } catch (err: unknown) {
      setPrompts(prev => [...prev, snapshot])
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSaving(false)
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
          <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Prompt Tree</span>
          <button
            onClick={() => openCreate(null)}
            className="px-2 py-1 text-[10px] font-mono font-medium bg-accent/10 text-accent border border-accent/20 rounded hover:bg-accent/20 transition-colors"
          >
            + Root Prompt
          </button>
        </div>

        {roots.length === 0 ? (
          <div className="text-center py-10 text-text-muted text-sm">
            No prompts yet.
          </div>
        ) : (
          <div className="bg-surface-1 border border-border rounded-lg p-2">
            {/* Root drop zone (top) */}
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

            {roots.map((p) => (
              <TreeNode
                key={p.id}
                prompt={p}
                allPrompts={prompts}
                depth={0}
                onEdit={openEdit}
                onAddChild={(parentId) => openCreate(parentId)}
                onDrop={handleDrop}
                metricsMap={metricsMap}
                timelineMap={timelineMap}
                isCollapsed={isCollapsed}
                onToggleCollapse={toggleCollapse}
              />
            ))}

            {/* Root drop zone (bottom) */}
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
          </div>
        )}

        {error && !editing && !creating && (
          <div className="mt-2 px-2 py-1.5 text-[10px] font-mono bg-danger/10 text-danger border border-danger/20 rounded">
            {error}
          </div>
        )}
      </div>

      {/* Editor panel */}
      {(editing || creating) && (
        <div className="w-80 shrink-0">
          <form onSubmit={handleSave} className="bg-surface-1 border border-border rounded-lg p-4 space-y-3 sticky top-16">
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider mb-2">
              {editing ? 'Edit Prompt' : 'New Prompt'}
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

            {editing && (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-surface-2 border border-border rounded text-text-primary focus:outline-none focus:border-accent/50"
              >
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="sent">Sent</option>
                <option value="done">Done</option>
              </select>
            )}

            {/* Snippet composer — only when editing an existing prompt */}
            {editing && (
              <PromptComposer
                promptId={editing.id}
                onApplied={(composedBody) => {
                  setBody(composedBody)
                  // Also update the prompt in the tree optimistically
                  setPrompts(prev => prev.map(p =>
                    p.id === editing.id ? { ...p, body: composedBody } : p
                  ))
                }}
              />
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-3 py-2 text-xs font-mono font-semibold bg-accent text-surface-0 rounded hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-3 py-2 text-xs font-mono font-medium bg-danger/10 text-danger border border-danger/20 rounded hover:bg-danger/20 transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => { setEditing(null); setCreating(null) }}
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
