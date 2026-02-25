import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { conversations as api, sendChatMessage } from '../api'
import ConversationSidebar from '../components/ConversationSidebar'
import ChatBubble from '../components/ChatBubble'
import ChatInput from '../components/ChatInput'
import SlashCommandMenu from '../components/SlashCommandMenu'

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

const SUGGESTIONS = [
  'Create a new project',
  'Show me my projects',
  'Help me organize my prompts',
  'Create a snippet collection',
]

export default function Chat({ provider, model, onModelChange }: Props) {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()

  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [slashQuery, setSlashQuery] = useState<string | null>(null)

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
  }, [messages, streaming])

  const handleSend = useCallback((text: string) => {
    // Add user message immediately
    const userMsg: DisplayMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setStreaming(true)

    // Placeholder for assistant
    const assistantId = 'assistant-' + Date.now()
    const assistantMsg: DisplayMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      toolResults: [],
    }
    setMessages((prev) => [...prev, assistantMsg])

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

  function handleNewChat() {
    abortRef.current?.abort()
    setMessages([])
    setStreaming(false)
    navigate('/')
  }

  function handleSelectConversation(id: string) {
    abortRef.current?.abort()
    setStreaming(false)
    navigate(`/c/${id}`)
  }

  function handleSlashInsertSnippet(content: string) {
    // This is handled at the input level - we can't easily insert into the textarea from here
    // Instead, just dismiss and let user copy
    setSlashQuery(null)
    handleSend(content)
  }

  return (
    <>
      <ConversationSidebar
        activeId={conversationId || null}
        onSelect={handleSelectConversation}
        onNew={handleNewChat}
        refreshKey={refreshKey}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          <div className="max-w-3xl mx-auto px-4 py-6">
            {messages.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="font-mono text-accent text-2xl font-bold mb-2">AICP</div>
                <p className="text-text-muted text-sm mb-6">How can I help you today?</p>
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
              messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  toolCalls={msg.toolCalls}
                  toolResults={msg.toolResults}
                  streaming={streaming && msg.id.startsWith('assistant-') && msg === messages[messages.length - 1]}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="relative">
          {slashQuery !== null && (
            <SlashCommandMenu
              query={slashQuery}
              onInsertSnippet={handleSlashInsertSnippet}
              onSelectModel={(p, m) => { onModelChange(p, m); setSlashQuery(null) }}
              onDismiss={() => setSlashQuery(null)}
            />
          )}
          <ChatInput
            onSend={handleSend}
            disabled={streaming}
            provider={provider}
            model={model}
            onSlashTrigger={setSlashQuery}
            onSlashDismiss={() => setSlashQuery(null)}
            slashActive={slashQuery !== null}
          />
        </div>
      </div>
    </>
  )
}
