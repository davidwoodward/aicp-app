interface Props {
  action: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'applying';
  onApply: () => void;
  onDismiss: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  create_project: 'Create Project',
  list_projects: 'List Projects',
  add_prompt: 'Add Prompt',
  create_snippet: 'Create Snippet',
  list_snippets: 'List Snippets',
  list_snippet_collections: 'List Collections',
  create_snippet_collection: 'Create Collection',
  unknown: 'Unrecognized',
}

export default function PlanConfirmation({ action, payload, status, onApply, onDismiss }: Props) {
  const label = ACTION_LABELS[action] ?? action
  const entries = Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== '')
  const isUnknown = action === 'unknown'
  const isReadOnly = action.startsWith('list_')

  return (
    <div className="flex justify-start mb-3">
      <div
        className="max-w-[75%] rounded-lg overflow-hidden"
        style={{
          border: `1px solid ${isUnknown ? 'var(--color-status-offline)' : 'rgba(110, 231, 183, 0.3)'}`,
          borderLeft: `3px solid ${isUnknown ? 'var(--color-status-offline)' : 'var(--color-accent)'}`,
          background: 'var(--color-surface-1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <span style={{
            fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700,
            letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-text-muted)',
          }}>
            Plan
          </span>
          <span style={{
            fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: isUnknown ? 'var(--color-status-offline)' : 'var(--color-accent)',
          }}>
            {label}
          </span>
          {isReadOnly && (
            <span style={{
              fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)',
              padding: '1px 5px', border: '1px solid var(--color-border)', borderRadius: '3px',
            }}>
              read-only
            </span>
          )}
        </div>

        {/* Payload fields */}
        {entries.length > 0 && (
          <div className="px-4 py-2.5 space-y-1.5">
            {entries.map(([key, value]) => (
              <div key={key} className="flex gap-3">
                <span style={{
                  fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)',
                  minWidth: '90px', flexShrink: 0, textAlign: 'right',
                }}>
                  {key}
                </span>
                {typeof value === 'string' && value.length > 80 ? (
                  <pre style={{
                    fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5,
                    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                    borderRadius: '4px', padding: '4px 8px', flex: 1, margin: 0,
                  }}>
                    {value}
                  </pre>
                ) : (
                  <span style={{
                    fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)',
                    wordBreak: 'break-word',
                  }}>
                    {typeof value === 'string' ? value : JSON.stringify(value)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          {status === 'applying' ? (
            <span className="inline-flex items-center gap-2" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
              <span className="inline-flex typing-indicator"><span className="dot" /><span className="dot" /><span className="dot" /></span>
              Applying…
            </span>
          ) : (
            <>
              {!isUnknown && (
                <button
                  onClick={onApply}
                  style={{
                    fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '3px 14px',
                    borderRadius: '4px', background: 'var(--color-accent)', color: 'var(--color-surface-0)',
                    border: 'none', cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  Apply
                </button>
              )}
              <button
                onClick={onDismiss}
                style={{
                  fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '3px 14px',
                  borderRadius: '4px', background: 'transparent', color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)', cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
              <span className="ml-auto" style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                {isUnknown ? 'Intent not recognized' : isReadOnly ? 'Will query, not mutate' : 'Will mutate data'}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
