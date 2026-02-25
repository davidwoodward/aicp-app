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

const ACTION_DESCRIPTIONS: Record<string, string> = {
  create_project: 'A new project will be created in your workspace.',
  list_projects: 'Query all existing projects. No data will be modified.',
  add_prompt: 'A new prompt node will be added to the specified project tree.',
  create_snippet: 'A reusable snippet will be created and available for composition.',
  list_snippets: 'Query existing snippets. No data will be modified.',
  list_snippet_collections: 'Query snippet collections. No data will be modified.',
  create_snippet_collection: 'A new snippet collection will be created.',
  unknown: 'The requested action could not be understood.',
}

interface AffectedEntity {
  type: string;
  label: string;
}

function deriveAffectedEntities(action: string, payload: Record<string, unknown>): AffectedEntity[] {
  const entities: AffectedEntity[] = []

  switch (action) {
    case 'create_project':
      if (payload.name) entities.push({ type: 'project', label: payload.name as string })
      break
    case 'add_prompt':
      if (payload.title) entities.push({ type: 'prompt', label: payload.title as string })
      if (payload.project_id) entities.push({ type: 'project', label: `project ${(payload.project_id as string).slice(0, 8)}…` })
      break
    case 'create_snippet':
      if (payload.name) entities.push({ type: 'snippet', label: payload.name as string })
      break
    case 'create_snippet_collection':
      if (payload.name) entities.push({ type: 'collection', label: payload.name as string })
      break
  }

  return entities
}

const ENTITY_ICONS: Record<string, string> = {
  project: '◆',
  prompt: '▸',
  snippet: '§',
  collection: '▤',
}

export default function PlanConfirmation({ action, payload, status, onApply, onDismiss }: Props) {
  const label = ACTION_LABELS[action] ?? action
  const description = ACTION_DESCRIPTIONS[action] ?? 'This action will be executed.'
  const entries = Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== '')
  const isUnknown = action === 'unknown'
  const isReadOnly = action.startsWith('list_')
  const isMutation = !isReadOnly && !isUnknown
  const affectedEntities = deriveAffectedEntities(action, payload)

  return (
    <div className="flex justify-start mb-3">
      <div
        className="max-w-[75%] rounded-lg overflow-hidden"
        style={{
          border: `1px solid ${isUnknown ? 'var(--color-status-offline)' : isMutation ? 'rgba(110, 231, 183, 0.3)' : 'var(--color-border)'}`,
          borderLeft: `3px solid ${isUnknown ? 'var(--color-status-offline)' : isMutation ? 'var(--color-accent)' : 'var(--color-text-muted)'}`,
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
          {isMutation && (
            <span style={{
              fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)',
              padding: '1px 5px', border: '1px solid rgba(110, 231, 183, 0.25)', borderRadius: '3px',
              background: 'rgba(110, 231, 183, 0.06)',
            }}>
              mutation
            </span>
          )}
        </div>

        {/* Action description */}
        <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <p style={{
            fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)',
            margin: 0, lineHeight: 1.5,
          }}>
            {description}
          </p>
        </div>

        {/* Affected entities */}
        {affectedEntities.length > 0 && (
          <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span style={{
              fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700,
              letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-text-muted)',
              display: 'block', marginBottom: '4px',
            }}>
              Affected
            </span>
            <div className="flex flex-wrap gap-1.5">
              {affectedEntities.map((e, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
                  style={{
                    background: isMutation ? 'rgba(110, 231, 183, 0.06)' : 'var(--color-surface-2)',
                    border: `1px solid ${isMutation ? 'rgba(110, 231, 183, 0.15)' : 'var(--color-border)'}`,
                    fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)',
                  }}
                >
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '9px' }}>
                    {ENTITY_ICONS[e.type] ?? '•'}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '9px' }}>{e.type}</span>
                  <span>{e.label}</span>
                </span>
              ))}
            </div>
          </div>
        )}

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
                    borderRadius: '4px',
                    background: isMutation ? 'var(--color-accent)' : 'var(--color-surface-2)',
                    color: isMutation ? 'var(--color-surface-0)' : 'var(--color-text-secondary)',
                    border: isMutation ? 'none' : '1px solid var(--color-border)',
                    cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  {isMutation ? 'Confirm & Apply' : 'Run'}
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
                {isUnknown ? 'Intent not recognized' : isMutation ? 'LLM-initiated — requires confirmation' : 'Read-only query'}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
