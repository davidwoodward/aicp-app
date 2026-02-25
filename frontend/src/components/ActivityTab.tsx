import { useState, useEffect } from 'react'
import { activityLogs, type ActivityLog, type EntityType } from '../api'
import RestoreConfirmModal from './RestoreConfirmModal'

interface Props {
  entityType: EntityType;
  entityId?: string;
  projectId?: string;
  onRestored?: () => void;
}

const ACTION_COLORS: Record<string, string> = {
  create: 'var(--color-status-ready)',
  update: 'var(--color-accent)',
  delete: 'var(--color-status-offline)',
  status_change: 'var(--color-status-sent)',
  reorder: 'var(--color-text-muted)',
  execute: 'var(--color-status-busy)',
  restored: 'var(--color-status-done)',
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  status_change: 'Status',
  reorder: 'Reordered',
  execute: 'Executed',
  restored: 'Restored',
}

const ACTOR_LABELS: Record<string, string> = {
  user: 'user',
  system: 'sys',
  llm: 'llm',
}

function diffKeys(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): string[] {
  if (!before && !after) return []
  if (!before) return Object.keys(after ?? {})
  if (!after) return Object.keys(before)
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  const changed: string[] = []
  for (const k of allKeys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      changed.push(k)
    }
  }
  return changed
}

function DiffView({ before, after }: {
  before: Record<string, unknown> | null | undefined;
  after: Record<string, unknown> | null | undefined;
}) {
  const keys = diffKeys(before, after)

  if (keys.length === 0) {
    return (
      <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', padding: '6px 0' }}>
        No field changes recorded.
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {keys.map(key => {
        const bVal = before?.[key]
        const aVal = after?.[key]
        const bStr = bVal === undefined ? '—' : typeof bVal === 'string' ? bVal : JSON.stringify(bVal)
        const aStr = aVal === undefined ? '—' : typeof aVal === 'string' ? aVal : JSON.stringify(aVal)

        return (
          <div key={key}>
            <div style={{ fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
              {key}
            </div>
            <div className="flex gap-2" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
              {before !== undefined && before !== null && (
                <div className="flex-1 rounded px-2 py-1" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--color-text-secondary)', wordBreak: 'break-word' }}>
                  <span style={{ color: 'rgba(239,68,68,0.6)', marginRight: '4px' }}>-</span>
                  {bStr.length > 200 ? bStr.slice(0, 200) + '…' : bStr}
                </div>
              )}
              {after !== undefined && after !== null && (
                <div className="flex-1 rounded px-2 py-1" style={{ background: 'rgba(110,231,183,0.06)', border: '1px solid rgba(110,231,183,0.15)', color: 'var(--color-text-secondary)', wordBreak: 'break-word' }}>
                  <span style={{ color: 'rgba(110,231,183,0.6)', marginRight: '4px' }}>+</span>
                  {aStr.length > 200 ? aStr.slice(0, 200) + '…' : aStr}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LogEntry({ log, onRestore }: { log: ActivityLog; onRestore: (log: ActivityLog) => void }) {
  const [expanded, setExpanded] = useState(false)
  const color = ACTION_COLORS[log.action_type] ?? 'var(--color-text-muted)'
  const hasBefore = log.metadata.before_state && Object.keys(log.metadata.before_state).length > 0
  const hasAfter = log.metadata.after_state && Object.keys(log.metadata.after_state).length > 0
  const hasDiff = hasBefore || hasAfter
  const canRestore = hasBefore && log.action_type !== 'create'

  const ts = new Date(log.created_at)
  const timeStr = ts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = ts.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <div
      style={{
        borderLeft: `3px solid ${color}`,
        background: expanded ? 'var(--color-surface-2)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* Summary row */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer group"
        onClick={() => hasDiff && setExpanded(v => !v)}
      >
        {/* Expand chevron */}
        <span
          style={{
            fontSize: '7px', color: 'var(--color-text-muted)', width: '8px', flexShrink: 0,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
            display: 'inline-block',
            opacity: hasDiff ? 1 : 0.3,
          }}
        >
          ▶
        </span>

        {/* Action badge */}
        <span
          style={{
            fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 600,
            color, padding: '1px 6px', borderRadius: '3px',
            border: `1px solid ${color}`, opacity: 0.9, flexShrink: 0,
            minWidth: '64px', textAlign: 'center',
          }}
        >
          {ACTION_LABELS[log.action_type] ?? log.action_type}
        </span>

        {/* Entity ID */}
        <span
          style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', flex: 1, minWidth: 0 }}
          className="truncate"
        >
          {log.entity_id.slice(0, 16)}
        </span>

        {/* Actor */}
        <span
          style={{
            fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)',
            padding: '1px 4px', border: '1px solid var(--color-border)', borderRadius: '3px',
            flexShrink: 0,
          }}
        >
          {ACTOR_LABELS[log.actor] ?? log.actor}
        </span>

        {/* Timestamp */}
        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', flexShrink: 0 }}>
          {dateStr} {timeStr}
        </span>

        {/* Restore button */}
        {canRestore && (
          <button
            onClick={e => { e.stopPropagation(); onRestore(log) }}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '1px 8px',
              borderRadius: '3px', border: '1px solid var(--color-border)', background: 'var(--color-surface-1)',
              color: 'var(--color-text-muted)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            Restore
          </button>
        )}
      </div>

      {/* Expanded diff */}
      {expanded && (
        <div className="px-3 pb-3" style={{ paddingLeft: '28px' }}>
          <DiffView
            before={log.metadata.before_state}
            after={log.metadata.after_state}
          />
        </div>
      )}
    </div>
  )
}

export default function ActivityTab({ entityType, entityId, projectId, onRestored }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<ActivityLog | null>(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    activityLogs.list({
      entity_type: entityType,
      entity_id: entityId,
      project_id: !entityId ? projectId : undefined,
    })
      .then(data => setLogs(data.slice(0, 20)))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [entityType, entityId, projectId])

  async function handleRestore() {
    if (!restoreTarget) return
    setRestoring(true)
    try {
      const result = await activityLogs.restore(restoreTarget.id)
      // Optimistic: prepend a synthetic "restored" entry to avoid full refetch
      const syntheticLog: ActivityLog = {
        id: `restored-${Date.now()}`,
        project_id: restoreTarget.project_id,
        entity_type: result.entity_type,
        entity_id: result.entity_id,
        action_type: 'restored',
        metadata: {
          before_state: null,
          after_state: result.entity as Record<string, unknown>,
          restored_from_event: result.restored_from_event,
        },
        created_at: new Date().toISOString(),
        actor: 'user',
      }
      setLogs(prev => [syntheticLog, ...prev].slice(0, 20))
      setRestoreTarget(null)
      onRestored?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed')
    } finally {
      setRestoring(false)
    }
  }

  if (loading) {
    return <div className="text-text-muted font-mono text-sm animate-pulse py-6 text-center">Loading activity…</div>
  }

  if (error) {
    return (
      <div className="py-6 text-center">
        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-status-offline)' }}>{error}</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
          Activity — last {logs.length} entries
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="py-10 text-center" style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
          No activity recorded for this entity.
        </div>
      ) : (
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--color-border)' }}
        >
          {logs.map((log, i) => (
            <div
              key={log.id}
              style={{ borderBottom: i < logs.length - 1 ? '1px solid var(--color-border)' : undefined }}
            >
              <LogEntry log={log} onRestore={setRestoreTarget} />
            </div>
          ))}
        </div>
      )}

      {restoreTarget && (
        <RestoreConfirmModal
          log={restoreTarget}
          onConfirm={handleRestore}
          onCancel={() => setRestoreTarget(null)}
          restoring={restoring}
        />
      )}
    </div>
  )
}
