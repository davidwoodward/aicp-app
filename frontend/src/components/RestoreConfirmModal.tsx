import type { ActivityLog, FieldDiff } from '../api'

interface Props {
  log: ActivityLog;
  onConfirm: (force: boolean) => void;
  onCancel: () => void;
  restoring: boolean;
  conflicts?: FieldDiff[] | null;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  status_change: 'Status Change',
  reorder: 'Reorder',
  execute: 'Execute',
  restored: 'Restore',
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'string') return val
  return JSON.stringify(val)
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

export default function RestoreConfirmModal({ log, onConfirm, onCancel, restoring, conflicts }: Props) {
  const before = log.metadata.before_state
  const hasBefore = before && Object.keys(before).length > 0
  const hasConflicts = conflicts && conflicts.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(4, 5, 8, 0.85)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="w-full overflow-hidden flex flex-col"
        style={{
          maxWidth: hasConflicts ? '560px' : '480px',
          maxHeight: hasConflicts ? '520px' : '420px',
          background: 'var(--color-surface-1)',
          border: `1px solid ${hasConflicts ? 'rgba(239, 68, 68, 0.35)' : 'rgba(110, 231, 183, 0.25)'}`,
          borderRadius: '10px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <span style={{
            fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: hasConflicts ? 'rgba(239, 68, 68, 0.8)' : 'var(--color-text-muted)',
          }}>
            {hasConflicts ? 'Conflict Detected' : 'Confirm Restore'}
          </span>
        </div>

        {/* Body */}
        <div className="px-4 py-3 overflow-y-auto flex-1 space-y-3">
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
            {hasConflicts ? (
              <>
                The <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{log.entity_type}</span> has
                been modified since this <span style={{ fontWeight: 600 }}>{ACTION_LABELS[log.action_type] ?? log.action_type}</span> event.
                Force restore to override?
              </>
            ) : (
              <>
                Restore <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{log.entity_type}</span> to
                the state before this <span style={{ fontWeight: 600 }}>{ACTION_LABELS[log.action_type] ?? log.action_type}</span> event?
              </>
            )}
          </div>

          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
            Event: {log.id.slice(0, 16)}… · {new Date(log.created_at).toLocaleString()} · by {log.actor}
          </div>

          {/* Conflict diff table */}
          {hasConflicts && (
            <div>
              <div style={{
                fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700,
                letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(239, 68, 68, 0.7)',
                marginBottom: '4px',
              }}>
                Changes since this event ({conflicts.length} field{conflicts.length !== 1 ? 's' : ''})
              </div>
              <div
                className="rounded overflow-hidden"
                style={{ border: '1px solid rgba(239, 68, 68, 0.2)', maxHeight: '180px', overflowY: 'auto' }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(239,68,68,0.03)' }}>
                      <th style={{ textAlign: 'left', padding: '3px 8px', fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                        Field
                      </th>
                      <th style={{ textAlign: 'left', padding: '3px 8px', fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                        At Event
                      </th>
                      <th style={{ textAlign: 'left', padding: '3px 8px', fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                        Current
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflicts.map((d) => (
                      <tr
                        key={d.field}
                        style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(239,68,68,0.02)' }}
                      >
                        <td style={{ padding: '4px 8px', color: 'rgba(239, 68, 68, 0.8)', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                          {d.field}
                        </td>
                        <td style={{ padding: '4px 8px', color: 'var(--color-text-secondary)', wordBreak: 'break-word', verticalAlign: 'top' }}>
                          {truncate(formatValue(d.before), 80)}
                        </td>
                        <td style={{ padding: '4px 8px', color: 'var(--color-text-secondary)', wordBreak: 'break-word', verticalAlign: 'top' }}>
                          <span style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '2px', padding: '1px 3px' }}>
                            {truncate(formatValue(d.after), 80)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!hasBefore && !hasConflicts && (
            <div
              className="px-3 py-2 rounded"
              style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-status-offline)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              This event has no before_state. Restore may fail.
            </div>
          )}

          {hasBefore && !hasConflicts && (
            <div>
              <div style={{
                fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700,
                letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-text-muted)',
                marginBottom: '4px',
              }}>
                Will restore to
              </div>
              <pre
                style={{
                  fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)', borderRadius: '4px', padding: '8px 10px',
                  lineHeight: 1.5, maxHeight: '160px', overflowY: 'auto', margin: 0,
                }}
              >
                {JSON.stringify(before, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-4 py-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button
            onClick={onCancel}
            disabled={restoring}
            style={{
              fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '5px 16px',
              borderRadius: '4px', background: 'transparent', color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(!!hasConflicts)}
            disabled={restoring || !hasBefore}
            style={{
              fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '5px 16px',
              borderRadius: '4px',
              background: restoring
                ? 'var(--color-surface-2)'
                : hasConflicts
                  ? 'rgba(239, 68, 68, 0.8)'
                  : 'var(--color-accent)',
              color: restoring ? 'var(--color-text-muted)' : 'var(--color-surface-0)',
              border: 'none', cursor: restoring || !hasBefore ? 'default' : 'pointer',
              fontWeight: 600, opacity: !hasBefore ? 0.4 : 1,
            }}
          >
            {restoring ? 'Restoring…' : hasConflicts ? 'Force Restore' : 'Restore'}
          </button>
        </div>
      </div>
    </div>
  )
}
