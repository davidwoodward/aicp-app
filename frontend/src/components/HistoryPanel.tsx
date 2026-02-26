import { useState, useEffect } from 'react'
import {
  activityLogs,
  prompts as promptsApi,
  type ActivityLog,
  type Prompt,
  RestoreConflictError,
} from '../api'

interface Props {
  projectId: string
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

export default function HistoryPanel({ projectId, onRestore, onDismiss }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    activityLogs.list({
      project_id: projectId,
      entity_type: 'prompt',
      limit: 30,
    })
      .then(res => setLogs(res.logs))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [projectId])

  async function handleRestore(log: ActivityLog) {
    setRestoringId(log.id)
    setError(null)
    try {
      const result = await activityLogs.restore(log.id)
      // Refetch the updated prompt
      const updated = result.entity as unknown as Prompt
      if (updated?.id) {
        onRestore(updated)
      }
    } catch (err) {
      if (err instanceof RestoreConflictError) {
        // Force restore on conflict
        try {
          const result = await activityLogs.restore(log.id, true)
          const updated = result.entity as unknown as Prompt
          if (updated?.id) onRestore(updated)
        } catch (forceErr) {
          setError(forceErr instanceof Error ? forceErr.message : 'Restore failed')
        }
      } else {
        setError(err instanceof Error ? err.message : 'Restore failed')
      }
    } finally {
      setRestoringId(null)
    }
  }

  // Only show restorable entries (updates, status changes — not creates/deletes/reorders)
  const restorable = new Set(['update', 'status_change'])

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
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

      {error && (
        <div
          className="mx-4 mt-3 px-3 py-2 text-[10px] font-mono rounded"
          style={{
            background: 'rgba(239, 68, 68, 0.06)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--color-danger)',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="px-4 py-6 text-center">
          <div className="typing-indicator" style={{ justifyContent: 'center' }}>
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="px-4 py-8 text-center text-text-muted text-xs font-mono">
          No edit history for this project.
        </div>
      ) : (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {logs.map(log => (
            <div
              key={log.id}
              className="flex items-start gap-3 px-4 py-2.5"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              {/* Timeline dot */}
              <div className="pt-1 shrink-0">
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: log.action_type === 'delete'
                      ? 'var(--color-danger)'
                      : log.action_type === 'create'
                        ? 'var(--color-accent)'
                        : 'var(--color-text-muted)',
                  }}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-text-primary leading-relaxed">
                  {summarize(log)}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-text-muted">
                    {timeAgo(log.created_at)}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Restore button */}
              {restorable.has(log.action_type) && log.metadata.before_state && (
                <button
                  onClick={() => handleRestore(log)}
                  disabled={restoringId === log.id}
                  className="shrink-0 px-2 py-1 text-[10px] font-mono font-medium text-text-muted hover:text-accent border border-border rounded hover:border-accent/30 transition-colors disabled:opacity-50"
                >
                  {restoringId === log.id ? '...' : 'Restore'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
