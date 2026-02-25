import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useOutletContext } from 'react-router-dom'
import { conversations as api, sendChatMessage, plan as planApi, type Snippet } from '../api'
import ConversationSidebar from '../components/ConversationSidebar'
import ChatBubble from '../components/ChatBubble'
import ChatInput from '../components/ChatInput'
import SlashCommandMenu from '../components/SlashCommandMenu'
import PlanConfirmation from '../components/PlanConfirmation'

interface Props {
  provider: string;
  model: string;
  onModelChange: (provider: string, model: string) => void;
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  toolResults?: Array<{ tool_call_id: string; name: string; result: string }>;
}

interface PendingPlan {
  action: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'applying';
}

const SUGGESTIONS = [
  'Create a new project',
  'Show me my projects',
  'Help me organize my prompts',
  'Create a snippet collection',
]

export default function Chat({ provider, model, onModelChange }: Props) {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const outletCtx = useOutletContext<{ hideSidebar?: boolean; planningMode?: boolean } | null>()
  const hideSidebar = outletCtx?.hideSidebar ?? false
  const planningMode = outletCtx?.planningMode ?? false

  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [slashQuery, setSlashQuery] = useState<string | null>(null)
  const [attachedSnippets, setAttachedSnippets] = useState<Snippet[]>([])
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load conversation messages
  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }
    api.messages(conversationId).then((msgs) => {
      const display: DisplayMessage[] = []
      for (const msg of msgs) {
        if (msg.role === 'tool') continue // tool results are folded into assistant
        display.push({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          toolCalls: msg.tool_calls,
        })
      }
      setMessages(display)
    }).catch(() => {})
  }, [conversationId])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming, pendingPlan])

  // ── Normal chat send ────────────────────────────────────────────────────
  const handleChatSend = useCallback((text: string) => {
    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content: text,
    }
    const assistantId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const assistantMsg: DisplayMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      toolResults: [],
    }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setStreaming(true)

    abortRef.current = sendChatMessage(
      {
        message: text,
        conversation_id: conversationId || undefined,
        provider,
        model,
      },
      {
        onConversation: (data) => {
          if (!conversationId) {
            navigate(`/c/${data.id}`, { replace: true })
          }
          setRefreshKey((k) => k + 1)
        },
        onDelta: (data) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + data.content }
                : m
            )
          )
        },
        onToolCall: (data) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, toolCalls: [...(m.toolCalls || []), data] }
                : m
            )
          )
        },
        onToolResult: (data) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, toolResults: [...(m.toolResults || []), data] }
                : m
            )
          )
        },
        onDone: () => {
          setStreaming(false)
          setRefreshKey((k) => k + 1)
        },
        onError: (data) => {
          setStreaming(false)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content || `Error: ${data.error}` }
                : m
            )
          )
        },
      },
    )
  }, [conversationId, provider, model, navigate])

  // ── Planning mode send ──────────────────────────────────────────────────
  const handlePlanSend = useCallback(async (text: string) => {
    // Show user message
    const userMsg: DisplayMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setStreaming(true)

    try {
      const result = await planApi.interpret(text)
      setPendingPlan({ action: result.action, payload: result.payload, status: 'pending' })
    } catch (err) {
      const errMsg: DisplayMessage = {
        id: 'assistant-' + Date.now(),
        role: 'assistant',
        content: `Plan error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setStreaming(false)
    }
  }, [])

  // ── Apply a pending plan ────────────────────────────────────────────────
  async function handleApplyPlan() {
    if (!pendingPlan) return

    setPendingPlan({ ...pendingPlan, status: 'applying' })

    try {
      const result = await planApi.apply(pendingPlan.action, pendingPlan.payload)
      const resultStr = typeof result.result === 'string'
        ? result.result
        : JSON.stringify(result.result, null, 2)

      const assistantMsg: DisplayMessage = {
        id: 'assistant-' + Date.now(),
        role: 'assistant',
        content: `Applied **${pendingPlan.action}**:\n\`\`\`json\n${resultStr}\n\`\`\``,
      }
      setMessages((prev) => [...prev, assistantMsg])
      setRefreshKey((k) => k + 1)
    } catch (err) {
      const errMsg: DisplayMessage = {
        id: 'assistant-' + Date.now(),
        role: 'assistant',
        content: `Apply failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setPendingPlan(null)
    }
  }

  function handleDismissPlan() {
    const dismissMsg: DisplayMessage = {
      id: 'assistant-' + Date.now(),
      role: 'assistant',
      content: `Plan dismissed: ${pendingPlan?.action ?? 'unknown'}`,
    }
    setMessages((prev) => [...prev, dismissMsg])
    setPendingPlan(null)
  }

  // ── Unified send handler ────────────────────────────────────────────────
  const handleSend = useCallback((text: string) => {
    if (planningMode) {
      handlePlanSend(text)
    } else {
      handleChatSend(text)
    }
  }, [planningMode, handlePlanSend, handleChatSend])

  function handleNewChat() {
    abortRef.current?.abort()
    setMessages([])
    setStreaming(false)
    setPendingPlan(null)
    navigate('/')
  }

  function handleSelectConversation(id: string) {
    abortRef.current?.abort()
    setStreaming(false)
    setPendingPlan(null)
    navigate(`/c/${id}`)
  }

  function handleConfirmSnippets(snippets: Snippet[]) {
    setAttachedSnippets(prev => {
      const map = new Map(prev.map(s => [s.id, s]))
      snippets.forEach(s => map.set(s.id, s))
      return Array.from(map.values())
    })
    setSlashQuery(null)
  }

  function removeAttachedSnippet(id: string) {
    setAttachedSnippets(prev => prev.filter(s => s.id !== id))
  }

  return (
    <>
      {!hideSidebar && (
        <ConversationSidebar
          activeId={conversationId || null}
          onSelect={handleSelectConversation}
          onNew={handleNewChat}
          refreshKey={refreshKey}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          <div className="max-w-3xl mx-auto px-4 py-6">
            {messages.length === 0 && !pendingPlan ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="font-mono text-accent text-2xl font-bold mb-2">AICP</div>
                <p className="text-text-muted text-sm mb-6">
                  {planningMode
                    ? 'Describe an action — it will be confirmed before executing.'
                    : 'How can I help you today?'}
                </p>
                <div className="grid grid-cols-2 gap-2 max-w-md">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="px-4 py-3 text-xs text-left bg-surface-1 border border-border rounded-lg hover:border-accent/30 hover:bg-surface-2 transition-all text-text-secondary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    toolCalls={msg.toolCalls}
                    toolResults={msg.toolResults}
                    streaming={streaming && msg.id.startsWith('assistant-') && msg === messages[messages.length - 1]}
                  />
                ))}

                {/* Pending plan confirmation card */}
                {pendingPlan && (
                  <PlanConfirmation
                    action={pendingPlan.action}
                    payload={pendingPlan.payload}
                    status={pendingPlan.status}
                    onApply={handleApplyPlan}
                    onDismiss={handleDismissPlan}
                  />
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="relative">
          {slashQuery !== null && (
            <SlashCommandMenu
              query={slashQuery}
              currentProvider={provider}
              currentModel={model}
              onConfirmSnippets={handleConfirmSnippets}
              onSelectModel={(p, m) => { onModelChange(p, m); setSlashQuery(null) }}
              onDismiss={() => setSlashQuery(null)}
            />
          )}

          {/* Attached snippet chips */}
          {attachedSnippets.length > 0 && (
            <div
              className="flex items-center gap-1.5 flex-wrap px-4 py-2"
              style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}
            >
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                Context
              </span>
              {attachedSnippets.map(s => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
                  style={{
                    background: 'rgba(110, 231, 183, 0.08)',
                    border: '1px solid rgba(110, 231, 183, 0.3)',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-accent)',
                  }}
                >
                  <span className="max-w-[120px] truncate">{s.name}</span>
                  <button
                    onClick={() => removeAttachedSnippet(s.id)}
                    style={{ opacity: 0.6, lineHeight: 1, cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', padding: 0 }}
                    className="hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                onClick={() => setAttachedSnippets([])}
                style={{ marginLeft: 'auto', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                className="hover:text-text-secondary transition-colors"
              >
                clear all
              </button>
            </div>
          )}
          <ChatInput
            onSend={handleSend}
            disabled={streaming || pendingPlan?.status === 'applying'}
            provider={provider}
            model={model}
            planningMode={planningMode}
            onSlashTrigger={setSlashQuery}
            onSlashDismiss={() => setSlashQuery(null)}
            slashActive={slashQuery !== null}
          />
        </div>
      </div>
    </>
  )
}
