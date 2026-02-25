import { useState, type Dispatch, type SetStateAction } from 'react'
import { prompts as api, type Prompt } from '../api'
import StatusBadge from '../components/StatusBadge'

interface Props {
  projectId: string
  prompts: Prompt[]
  setPrompts: Dispatch<SetStateAction<Prompt[]>>
}

function buildTree(items: Prompt[], parentId: string | null = null): Prompt[] {
  return items
    .filter((p) => p.parent_prompt_id === parentId)
    .sort((a, b) => a.order_index - b.order_index)
}

function TreeNode({
  prompt,
  allPrompts,
  depth,
  onEdit,
  onBranch,
}: {
  prompt: Prompt
  allPrompts: Prompt[]
  depth: number
  onEdit: (p: Prompt) => void
  onBranch: (parentId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const children = buildTree(allPrompts, prompt.id)
  const hasChildren = children.length > 0

  return (
    <div>
      <div
        className="group flex items-center gap-2 py-1.5 px-2 rounded hover:bg-surface-2 transition-colors cursor-pointer"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-4 h-4 flex items-center justify-center text-text-muted text-[10px] font-mono ${!hasChildren ? 'invisible' : ''}`}
        >
          {expanded ? '▼' : '▶'}
        </button>

        {/* Connector line */}
        {depth > 0 && (
          <div className="w-2 h-px bg-border-bright" />
        )}

        {/* Status */}
        <StatusBadge status={prompt.status} />

        {/* Title */}
        <span className="text-sm font-medium truncate flex-1">{prompt.title}</span>

        {/* Actions */}
        <div className="hidden group-hover:flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(prompt) }}
            className="px-1.5 py-0.5 text-[10px] font-mono text-text-muted hover:text-text-primary transition-colors"
          >
            edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onBranch(prompt.id) }}
            className="px-1.5 py-0.5 text-[10px] font-mono text-text-muted hover:text-accent transition-colors"
          >
            +branch
          </button>
        </div>
      </div>

      {/* Children */}
      {expanded && children.map((child) => (
        <TreeNode
          key={child.id}
          prompt={child}
          allPrompts={allPrompts}
          depth={depth + 1}
          onEdit={onEdit}
          onBranch={onBranch}
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

  const roots = buildTree(prompts, null)

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
        // Optimistic update
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
        } catch (err: unknown) {
          setPrompts(prev => prev.map(p => p.id === snapshot.id ? snapshot : p))
          setError(err instanceof Error ? err.message : 'Failed to save')
          setEditing(snapshot)
          setTitle(snapshot.title)
          setBody(snapshot.body)
          setStatus(snapshot.status)
        }
      } else if (creating) {
        // Optimistic create with temp ID
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
    // Optimistic delete
    const snapshot = editing
    setPrompts(prev => prev.filter(p => p.id !== snapshot.id))
    setEditing(null)
    try {
      await api.delete(snapshot.id)
    } catch (err: unknown) {
      setPrompts(prev => [...prev, snapshot])
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSaving(false)
    }
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
            {roots.map((p) => (
              <TreeNode
                key={p.id}
                prompt={p}
                allPrompts={prompts}
                depth={0}
                onEdit={openEdit}
                onBranch={(parentId) => openCreate(parentId)}
              />
            ))}
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
