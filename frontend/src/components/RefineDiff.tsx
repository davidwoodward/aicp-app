interface Props {
  original: string
  refined: string
  loading?: boolean
  onAccept: () => void
  onReject: () => void
}

export default function RefineDiff({ original, refined, loading, onAccept, onReject }: Props) {
  if (loading) {
    return (
      <div
        className="rounded-lg border overflow-hidden"
        style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}
      >
        <div
          className="px-4 py-2"
          style={{
            borderBottom: '1px solid var(--color-border)',
            fontSize: '9px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--color-accent)',
          }}
        >
          Refining...
        </div>
        <div className="px-4 py-6 text-center">
          <div className="typing-indicator" style={{ justifyContent: 'center' }}>
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ background: 'var(--color-surface-1)', borderColor: 'rgba(110, 231, 183, 0.25)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-2"
        style={{
          borderBottom: '1px solid var(--color-border)',
          fontSize: '9px',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--color-accent)',
        }}
      >
        Refine Preview
      </div>

      {/* Original */}
      <div className="px-4 pt-3 pb-2">
        <div
          style={{
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: '6px',
          }}
        >
          Original
        </div>
        <div
          className="text-xs font-mono leading-relaxed whitespace-pre-wrap rounded px-3 py-2"
          style={{
            color: 'var(--color-text-muted)',
            background: 'var(--color-surface-0)',
            border: '1px solid var(--color-border)',
            textDecoration: 'line-through',
            textDecorationColor: 'rgba(239, 68, 68, 0.4)',
          }}
        >
          {original}
        </div>
      </div>

      {/* Refined */}
      <div className="px-4 pt-1 pb-3">
        <div
          style={{
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-accent)',
            marginBottom: '6px',
          }}
        >
          Refined
        </div>
        <div
          className="text-xs font-mono leading-relaxed whitespace-pre-wrap rounded px-3 py-2"
          style={{
            color: 'var(--color-text-primary)',
            background: 'rgba(110, 231, 183, 0.04)',
            border: '1px solid rgba(110, 231, 183, 0.2)',
          }}
        >
          {refined}
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <button
          onClick={onAccept}
          className="px-3 py-1.5 text-[10px] font-mono font-semibold bg-accent text-surface-0 rounded hover:bg-accent/90 transition-colors"
        >
          Accept
        </button>
        <button
          onClick={onReject}
          className="px-3 py-1.5 text-[10px] font-mono font-medium text-text-muted hover:text-text-primary border border-border rounded hover:border-border-bright transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  )
}
