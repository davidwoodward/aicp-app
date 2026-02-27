import { useState, useEffect } from 'react'
import {
  activityLogs,
  messages as messagesApi,
  type ActivityLog,
  type Message,
  type Agent,
} from '../api'

interface Props {
  promptId: string
  projectId: string
  agents: Agent[]
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

function actionLabel(log: ActivityLog, agentMap: Map<string, Agent>): string {
  switch (log.action_type) {
    case 'execute': {
      const agentId = log.metadata?.agent_id as string | undefined
      const agent = agentId ? agentMap.get(agentId) : undefined
      const name = agent?.machine_name ?? agentId?.slice(0, 12) ?? 'unknown'
      return `Executed on ${name}`
    }
    case 'status_change': {
      const from = (log.metadata?.before_state as Record<string, unknown>)?.status as string | undefined
      const to = (log.metadata?.after_state as Record<string, unknown>)?.status as string | undefined
      if (from && to) return `Status: ${from} → ${to}`
      return 'Status changed'
    }
    case 'update':
      return 'Updated'
    case 'create':
      return 'Created'
    case 'delete':
      return 'Deleted'
    case 'restored':
      return 'Restored'
    default:
      return log.action_type
  }
}

function actionIcon(action: string): string {
  switch (action) {
    case 'execute': return '▸'
    case 'status_change': return '◆'
    case 'update': return '✎'
    case 'create': return '+'
    case 'delete': return '×'
    case 'restored': return '↺'
    default: return '·'
  }
}

export default function PromptExecutionHistory({ promptId, projectId, agents }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)

  const agentMap = new Map(agents.map(a => [a.id, a]))

  useEffect(() => {
    setLoading(true)
    setLogs([])
    setExpandedId(null)
    setMessages([])
    activityLogs.list({ entity_type: 'prompt', entity_id: promptId, project_id: projectId, limit: 20 })
      .then(res => setLogs(res.logs))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [promptId, projectId])

  function toggleExpand(log: ActivityLog) {
    const sessionId = log.metadata?.session_id as string | undefined
    if (!sessionId) return

    if (expandedId === log.id) {
      setExpandedId(null)
      setMessages([])
      return
    }
    setExpandedId(log.id)
    setLoadingMsgs(true)
    messagesApi.listBySession(sessionId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false))
  }

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ background: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-2"
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
          Activity
        </span>
      </div>

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
          No activity yet.
        </div>
      ) : (
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {logs.map(log => {
            const sessionId = log.metadata?.session_id as string | undefined
            const canExpand = log.action_type === 'execute' && !!sessionId
            const expanded = expandedId === log.id

            return (
              <div key={log.id}>
                <button
                  onClick={() => canExpand && toggleExpand(log)}
                  className="w-full text-left px-4 py-2.5 transition-colors"
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    background: expanded ? 'rgba(110, 231, 183, 0.04)' : 'transparent',
                    cursor: canExpand ? 'pointer' : 'default',
                  }}
                >
                  <div className="flex items-center gap-2">
                    {/* Expand indicator */}
                    <span
                      className="text-text-muted transition-transform"
                      style={{
                        fontSize: '10px',
                        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        display: 'inline-block',
                        opacity: canExpand ? 1 : 0.3,
                      }}
                    >
                      {actionIcon(log.action_type)}
                    </span>

                    {/* Label */}
                    <span className="text-xs font-mono text-text-secondary flex-1">
                      {actionLabel(log, agentMap)}
                    </span>

                    {/* Timestamp */}
                    <span className="text-[10px] font-mono text-text-muted">
                      {formatTime(log.created_at)}
                    </span>
                  </div>
                </button>

                {/* Expanded session messages */}
                {expanded && (
                  <div
                    className="px-4 py-3"
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      background: 'var(--color-surface-0)',
                    }}
                  >
                    {loadingMsgs ? (
                      <div className="text-center py-3">
                        <div className="typing-indicator" style={{ justifyContent: 'center' }}>
                          <span className="dot" />
                          <span className="dot" />
                          <span className="dot" />
                        </div>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-text-muted text-xs font-mono text-center py-3">
                        No messages in this session.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {messages.map(msg => (
                          <div key={msg.id}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                className="text-[9px] font-mono font-semibold uppercase tracking-wider"
                                style={{
                                  color: msg.role === 'claude'
                                    ? 'var(--color-accent)'
                                    : 'var(--color-text-muted)',
                                }}
                              >
                                {msg.role}
                              </span>
                              <span className="text-[9px] font-mono text-text-muted">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-xs font-mono text-text-secondary leading-relaxed whitespace-pre-wrap ml-2">
                              {msg.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
