import { useState, useEffect } from 'react'
import {
  sessions as sessionsApi,
  messages as messagesApi,
  type Session,
  type Message,
  type Agent,
} from '../api'

interface Props {
  projectId: string
  agents: Agent[]
  onDismiss: () => void
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

function duration(start: string, end: string | null): string {
  if (!end) return 'active'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ${secs % 60}s`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}

export default function SessionsPanel({ projectId, agents, onDismiss }: Props) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)

  const agentMap = new Map(agents.map(a => [a.id, a]))

  useEffect(() => {
    sessionsApi.listByProject(projectId)
      .then(list => setSessions(list.sort((a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      )))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [projectId])

  function toggleSession(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
      setMessages([])
      return
    }
    setExpandedId(id)
    setLoadingMsgs(true)
    messagesApi.listBySession(id)
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
          Sessions
        </span>
        <button
          onClick={onDismiss}
          className="text-[10px] font-mono text-text-muted hover:text-text-primary transition-colors"
        >
          close
        </button>
      </div>

      {loading ? (
        <div className="px-4 py-6 text-center">
          <div className="typing-indicator" style={{ justifyContent: 'center' }}>
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="px-4 py-8 text-center text-text-muted text-xs font-mono">
          No sessions for this project.
        </div>
      ) : (
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {sessions.map(session => {
            const agent = agentMap.get(session.agent_id)
            const expanded = expandedId === session.id
            const isActive = !session.ended_at

            return (
              <div key={session.id}>
                {/* Session row */}
                <button
                  onClick={() => toggleSession(session.id)}
                  className="w-full text-left px-4 py-2.5 transition-colors"
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    background: expanded ? 'rgba(110, 231, 183, 0.04)' : 'transparent',
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
                      }}
                    >
                      ▸
                    </span>

                    {/* Status dot */}
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                        flexShrink: 0,
                      }}
                    />

                    {/* Agent name */}
                    <span className="text-xs font-mono font-medium text-text-primary">
                      {agent?.machine_name ?? session.agent_id.slice(0, 12)}
                    </span>

                    {/* Duration */}
                    <span className="text-[10px] font-mono text-text-muted ml-auto">
                      {duration(session.started_at, session.ended_at)}
                    </span>
                  </div>

                  {/* Timestamps */}
                  <div className="flex items-center gap-3 mt-1 ml-6">
                    <span className="text-[10px] font-mono text-text-muted">
                      {formatTime(session.started_at)}
                    </span>
                    {session.ended_at && (
                      <>
                        <span className="text-[10px] text-text-muted">→</span>
                        <span className="text-[10px] font-mono text-text-muted">
                          {formatTime(session.ended_at)}
                        </span>
                      </>
                    )}
                  </div>
                </button>

                {/* Expanded messages */}
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
