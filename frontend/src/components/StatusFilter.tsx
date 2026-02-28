import type { Prompt } from '../api'

export type StatusFilterValue = 'draft+ready' | 'draft' | 'ready' | 'sent' | 'done' | 'all'

const OPTIONS: { value: StatusFilterValue; label: string; compact: string; tooltip: string }[] = [
  { value: 'draft+ready', label: 'D+R', compact: 'd+r', tooltip: 'Draft + Ready' },
  { value: 'draft', label: 'Draft', compact: 'd', tooltip: 'Draft only' },
  { value: 'ready', label: 'Ready', compact: 'r', tooltip: 'Ready only' },
  { value: 'sent', label: 'Sent', compact: 's', tooltip: 'Sent only' },
  { value: 'done', label: 'Done', compact: 'dn', tooltip: 'Done only' },
  { value: 'all', label: 'All', compact: 'all', tooltip: 'All statuses' },
]

interface Props {
  value: StatusFilterValue
  onChange: (v: StatusFilterValue) => void
  compact?: boolean
}

export function StatusFilter({ value, onChange, compact }: Props) {
  const fontSize = compact ? '8px' : '9px'

  return (
    <div className="flex items-center gap-0.5">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          title={compact ? opt.tooltip : undefined}
          className="font-mono uppercase tracking-wider rounded transition-colors"
          style={{
            padding: compact ? '1px 4px' : '2px 8px',
            fontSize,
            background: value === opt.value ? 'rgba(110, 231, 183, 0.12)' : 'transparent',
            color: value === opt.value ? 'var(--color-accent)' : 'var(--color-text-muted)',
            border: value === opt.value ? '1px solid rgba(110, 231, 183, 0.25)' : '1px solid transparent',
            lineHeight: 1.4,
          }}
        >
          {compact ? opt.compact : opt.label}
        </button>
      ))}
    </div>
  )
}

export function filterPromptsByStatus(prompts: Prompt[], filter: StatusFilterValue): Prompt[] {
  if (filter === 'all') return prompts
  if (filter === 'draft+ready') return prompts.filter(p => p.status === 'draft' || p.status === 'ready')
  return prompts.filter(p => p.status === filter)
}
