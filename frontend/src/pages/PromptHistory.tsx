import { useState, useEffect } from 'react'
import { sessions as sessionsApi, messages as messagesApi, type Prompt, type Session, type Message } from '../api'
import StatusBadge from '../components/StatusBadge'

interface Props {
  projectId: string
  prompts: Prompt[]
}

export default function PromptHistory({ projectId, prompts }: Props) {
  const [sessionList, setSessionList] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [messageList, setMessageList] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null)

  const doneOrSent = prompts.filter((p) => p.status === 'sent' || p.status === 'done')

  useEffect(() => {
    sessionsApi.listByProject(projectId).then(setSessionList).catch(() => {})
  }, [projectId])

  async function loadMessages(sessionId: string) {
    setSelectedSession(sessionId)
    setLoadingMessages(true)
    try {
      const msgs = await messagesApi.listBySession(sessionId)
      setMessageList(msgs)
    } catch {
      setMessageList([])
    } finally {
      setLoadingMessages(false)
    }
  }

  // Filter sessions by selected prompt's agent
  const filteredSessions = selectedPrompt
    ? sessionList.filter((s) => {
        const prompt = prompts.find((p) => p.id === selectedPrompt)
        return prompt?.agent_id ? s.agent_id === prompt.agent_id : true
      })
    : sessionList

  return (
    <div className="flex gap-4">
      {/* Left: prompt filter + session list */}
      <div className="w-72 shrink-0 space-y-3">
        <span className="text-xs font-mono text-text-muted uppercase tracking-wider block">Filter by Prompt</span>

        <select
          value={selectedPrompt || ''}
          onChange={(e) => { setSelectedPrompt(e.target.value || null); setSelectedSession(null); setMessageList([]) }}
          className="w-full px-3 py-2 text-xs font-mono bg-surface-2 border border-border rounded text-text-primary focus:outline-none focus:border-accent/50"
        >
          <option value="">All prompts</option>
          {doneOrSent.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>

        {/* Prompt info */}
        {selectedPrompt && (() => {
          const p = prompts.find((pr) => pr.id === selectedPrompt)
          if (!p) return null
          return (
            <div className="p-3 bg-surface-1 border border-border rounded-lg text-xs space-y-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={p.status} />
                <span className="font-medium">{p.title}</span>
              </div>
              {p.sent_at && <div className="font-mono text-text-muted">Sent: {new Date(p.sent_at).toLocaleString()}</div>}
              {p.done_at && <div className="font-mono text-text-muted">Done: {new Date(p.done_at).toLocaleString()}</div>}
            </div>
          )
        })()}

        <span className="text-xs font-mono text-text-muted uppercase tracking-wider block mt-4">
          Sessions ({filteredSessions.length})
        </span>

        {filteredSessions.length === 0 ? (
          <div className="text-text-muted text-xs py-4 text-center">No sessions</div>
        ) : (
          <div className="space-y-1">
            {filteredSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadMessages(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                  selectedSession === s.id
                    ? 'bg-accent/10 border border-accent/20 text-accent'
                    : 'bg-surface-1 border border-border hover:border-border-bright text-text-secondary'
                }`}
              >
                <div className="font-mono font-medium truncate">{s.id.slice(0, 12)}...</div>
                <div className="text-text-muted text-[10px] font-mono mt-0.5">
                  {new Date(s.started_at).toLocaleString()}
                  {s.ended_at ? ' — ended' : ' — active'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: messages */}
      <div className="flex-1 min-w-0">
        <span className="text-xs font-mono text-text-muted uppercase tracking-wider block mb-3">Messages</span>

        {!selectedSession ? (
          <div className="text-center py-16 text-text-muted text-sm">
            Select a session to view messages
          </div>
        ) : loadingMessages ? (
          <div className="text-text-muted font-mono text-sm animate-pulse">Loading messages...</div>
        ) : messageList.length === 0 ? (
          <div className="text-center py-16 text-text-muted text-sm">
            No messages in this session
          </div>
        ) : (
          <div className="space-y-2">
            {messageList.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg border text-sm ${
                  msg.role === 'user'
                    ? 'bg-surface-2 border-border ml-8'
                    : 'bg-accent/5 border-accent/15 mr-8'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider ${
                    msg.role === 'user' ? 'text-status-ready' : 'text-accent'
                  }`}>
                    {msg.role}
                  </span>
                  <span className="text-text-muted text-[10px] font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-text-primary text-xs font-mono leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
