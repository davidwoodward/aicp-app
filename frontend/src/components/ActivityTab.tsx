import { useState, useEffect } from 'react'
import { activityLogs, RestoreConflictError, type ActivityLog, type EntityType, type FieldDiff } from '../api'
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

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'string') return val
  return JSON.stringify(val)
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

function DiffTable({ diffs }: { diffs: FieldDiff[] }) {
  if (diffs.length === 0) {
    return (
      <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', padding: '6px 0' }}>
        No field changes recorded.
      </div>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
          <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
            Field
          </th>
          <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(239,68,68,0.6)' }}>
            Before
          </th>
          <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(110,231,183,0.6)' }}>
            After
          </th>
        </tr>
      </thead>
      <tbody>
        {diffs.map((d) => {
          const bStr = truncate(formatValue(d.before), 120)
          const aStr = truncate(formatValue(d.after), 120)
          const isAdded = d.before === null || d.before === undefined
          const isRemoved = d.after === null || d.after === undefined

          return (
            <tr
              key={d.field}
              style={{
                borderBottom: '1px solid var(--color-border)',
                background: isAdded
                  ? 'rgba(110,231,183,0.04)'
                  : isRemoved
                    ? 'rgba(239,68,68,0.04)'
                    : 'rgba(110,231,183,0.02)',
              }}
            >
              <td style={{ padding: '5px 8px', color: 'var(--color-accent)', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                {d.field}
              </td>
              <td style={{ padding: '5px 8px', color: 'var(--color-text-secondary)', wordBreak: 'break-word', verticalAlign: 'top' }}>
                {!isAdded && (
                  <span style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '2px', padding: '1px 3px' }}>
                    {bStr}
                  </span>
                )}
                {isAdded && <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
              </td>
              <td style={{ padding: '5px 8px', color: 'var(--color-text-secondary)', wordBreak: 'break-word', verticalAlign: 'top' }}>
                {!isRemoved && (
                  <span style={{ background: 'rgba(110,231,183,0.08)', borderRadius: '2px', padding: '1px 3px' }}>
                    {aStr}
                  </span>
                )}
                {isRemoved && <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function LogEntry({ log, onRestore }: { log: ActivityLog; onRestore: (log: ActivityLog) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [diffs, setDiffs] = useState<FieldDiff[] | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  const color = ACTION_COLORS[log.action_type] ?? 'var(--color-text-muted)'
  const hasBefore = log.metadata.before_state && Object.keys(log.metadata.before_state).length > 0
  const hasAfter = log.metadata.after_state && Object.keys(log.metadata.after_state).length > 0
  const hasDiff = hasBefore || hasAfter
  const canRestore = hasBefore && log.action_type !== 'create'

  const ts = new Date(log.created_at)
  const timeStr = ts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = ts.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  function handleToggle() {
    if (!hasDiff) return
    const next = !expanded
    setExpanded(next)
    if (next && diffs === null) {
      setDiffLoading(true)
      activityLogs.diff(log.id)
        .then(res => setDiffs(res.diffs))
        .catch(() => setDiffs([]))
        .finally(() => setDiffLoading(false))
    }
  }

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
        onClick={handleToggle}
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

      {/* Expanded diff table */}
      {expanded && (
        <div className="px-3 pb-3" style={{ paddingLeft: '28px' }}>
          {diffLoading ? (
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', padding: '6px 0' }} className="animate-pulse">
              Loading diff…
            </div>
          ) : (
            <div
              className="rounded overflow-hidden"
              style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-1)' }}
            >
              <DiffTable diffs={diffs ?? []} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ActivityTab({ entityType, entityId, projectId, onRestored }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<ActivityLog | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [conflicts, setConflicts] = useState<FieldDiff[] | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setCursor(null)
    setHasMore(false)
    activityLogs.list({
      entity_type: entityType,
      entity_id: entityId,
      project_id: projectId,
      limit: 20,
    })
      .then(data => {
        setLogs(data.logs)
        setCursor(data.next_cursor)
        setHasMore(data.has_more)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [entityType, entityId, projectId])

  async function loadMore() {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await activityLogs.list({
        entity_type: entityType,
        entity_id: entityId,
        project_id: projectId,
        limit: 20,
        cursor,
      })
      setLogs(prev => [...prev, ...data.logs])
      setCursor(data.next_cursor)
      setHasMore(data.has_more)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more')
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleRestore(force: boolean) {
    if (!restoreTarget) return
    setRestoring(true)
    try {
      const result = await activityLogs.restore(restoreTarget.id, force || undefined)
      // Prepend a synthetic "restored" entry to avoid full refetch
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
      setLogs(prev => [syntheticLog, ...prev])
      setRestoreTarget(null)
      setConflicts(null)
      onRestored?.()
    } catch (err) {
      if (err instanceof RestoreConflictError) {
        setConflicts(err.conflict.conflicts)
      } else {
        setError(err instanceof Error ? err.message : 'Restore failed')
        setRestoreTarget(null)
        setConflicts(null)
      }
    } finally {
      setRestoring(false)
    }
  }

  function handleCancelRestore() {
    setRestoreTarget(null)
    setConflicts(null)
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
        <>
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

          {hasMore && (
            <div className="mt-2 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '4px 16px',
                  borderRadius: '4px', border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-1)', color: 'var(--color-text-muted)',
                  cursor: loadingMore ? 'default' : 'pointer',
                  opacity: loadingMore ? 0.6 : 1,
                }}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      {restoreTarget && (
        <RestoreConfirmModal
          log={restoreTarget}
          onConfirm={handleRestore}
          onCancel={handleCancelRestore}
          restoring={restoring}
          conflicts={conflicts}
        />
      )}
    </div>
  )
}
