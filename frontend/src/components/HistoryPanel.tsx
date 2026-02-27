import { useState, useEffect } from 'react'
import {
  activityLogs,
  type ActivityLog,
  type Prompt,
  RestoreConflictError,
} from '../api'
import { useError } from '../hooks/useError'

interface Props {
  projectId: string
  entityId?: string
  currentPrompt?: Prompt | null
  onView: (log: ActivityLog) => void
  onRestore: (prompt: Prompt) => void
  onDismiss: () => void
}

function summarize(log: ActivityLog): string {
  const before = log.metadata.before_state as Record<string, unknown> | null | undefined
  const after = log.metadata.after_state as Record<string, unknown> | null | undefined

  switch (log.action_type) {
    case 'create':
      return `Created "${after?.title ?? log.entity_id.slice(0, 8)}"`
    case 'update': {
      const fields: string[] = []
      if (before && after) {
        if (before.title !== after.title) fields.push('title')
        if (before.body !== after.body) fields.push('body')
        if (before.order_index !== after.order_index) fields.push('order')
        if (before.parent_prompt_id !== after.parent_prompt_id) fields.push('parent')
      }
      const what = fields.length > 0 ? fields.join(', ') : 'fields'
      return `Updated ${what} on "${after?.title ?? before?.title ?? log.entity_id.slice(0, 8)}"`
    }
    case 'status_change':
      return `${before?.status ?? '?'} → ${after?.status ?? '?'} on "${after?.title ?? log.entity_id.slice(0, 8)}"`
    case 'delete':
      return `Deleted "${before?.title ?? log.entity_id.slice(0, 8)}"`
    case 'execute':
      return `Executed "${before?.title ?? log.entity_id.slice(0, 8)}"`
    case 'reorder':
      return 'Reordered prompts'
    default:
      return `${log.action_type} on ${log.entity_id.slice(0, 8)}`
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function HistoryPanel({ projectId, entityId, onView, onRestore, onDismiss }: Props) {
  const { showError } = useError()
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const filters: { project_id: string; entity_type: 'prompt'; entity_id?: string; limit: number } = {
      project_id: projectId,
      entity_type: 'prompt',
      limit: 30,
    }
    if (entityId) filters.entity_id = entityId
    activityLogs.list(filters)
      .then(res => setLogs(res.logs))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [projectId, entityId])

  async function handleRestore(log: ActivityLog) {
    setRestoringId(log.id)
    try {
      const result = await activityLogs.restore(log.id)
      const updated = result.entity as unknown as Prompt
      if (updated?.id) {
        onRestore(updated)
      }
    } catch (err) {
      if (err instanceof RestoreConflictError) {
        try {
          const result = await activityLogs.restore(log.id, true)
          const updated = result.entity as unknown as Prompt
          if (updated?.id) onRestore(updated)
        } catch (forceErr) {
          showError(forceErr instanceof Error ? forceErr.message : 'Restore failed')
        }
      } else {
        showError(err instanceof Error ? err.message : 'Restore failed')
      }
    } finally {
      setRestoringId(null)
    }
  }

  async function handleDelete(log: ActivityLog) {
    setDeletingId(log.id)
    try {
      await activityLogs.delete(log.id)
      setLogs(prev => prev.filter(l => l.id !== log.id))
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  const viewable = new Set(['update', 'status_change'])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <span
          style={{
            fontSize: '9px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--color-accent)',
          }}
        >
          Prompt History
        </span>
        <button
          onClick={onDismiss}
          className="text-[10px] font-mono text-text-muted hover:text-text-primary transition-colors"
        >
          close
        </button>
      </div>

      {loading ? (
        <div className="px-3 py-6 text-center">
          <div className="typing-indicator" style={{ justifyContent: 'center' }}>
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="px-3 py-8 text-center text-text-muted text-xs font-mono">
          No edit history for this project.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {logs.map(log => {
            const canView = viewable.has(log.action_type) && log.metadata.before_state
            const canRestore = canView

            return (
              <div
                key={log.id}
                className="px-3 py-2"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                {/* Summary + time */}
                <div className="flex items-start gap-2">
                  <div
                    className="mt-1.5 shrink-0"
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: log.action_type === 'delete'
                        ? 'var(--color-danger)'
                        : log.action_type === 'create'
                          ? 'var(--color-accent)'
                          : 'var(--color-text-muted)',
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-[11px] font-mono text-text-primary leading-snug"
                      style={{ wordBreak: 'break-word' }}
                    >
                      {summarize(log)}
                    </div>
                    <div className="text-[9px] font-mono text-text-muted mt-0.5">
                      {timeAgo(log.created_at)}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 mt-1.5 pl-3.5">
                  {canView && (
                    <button
                      onClick={() => onView(log)}
                      className="px-1.5 py-0.5 text-[9px] font-mono font-medium text-text-muted hover:text-accent border border-border rounded hover:border-accent/30 transition-colors"
                    >
                      View
                    </button>
                  )}
                  {canRestore && (
                    <button
                      onClick={() => handleRestore(log)}
                      disabled={restoringId === log.id}
                      className="px-1.5 py-0.5 text-[9px] font-mono font-medium text-text-muted hover:text-accent border border-border rounded hover:border-accent/30 transition-colors disabled:opacity-50"
                    >
                      {restoringId === log.id ? '...' : 'Restore'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(log)}
                    disabled={deletingId === log.id}
                    className="px-1.5 py-0.5 text-[9px] font-mono font-medium text-text-muted hover:text-red-400 border border-border rounded hover:border-red-400/30 transition-colors disabled:opacity-50"
                  >
                    {deletingId === log.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
