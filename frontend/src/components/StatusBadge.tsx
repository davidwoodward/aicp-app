import type { PromptStatus } from '../api'

const STATUS_STYLES: Record<PromptStatus, string> = {
  draft: 'bg-status-draft/20 text-status-draft border-status-draft/30',
  ready: 'bg-status-ready/20 text-status-ready border-status-ready/30',
  sent: 'bg-status-sent/20 text-status-sent border-status-sent/30',
  done: 'bg-status-done/20 text-status-done border-status-done/30',
}

export default function StatusBadge({ status }: { status: PromptStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider border rounded ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  )
}
