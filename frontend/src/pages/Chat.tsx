import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import {
  conversations as convsApi,
  prompts as promptsApi,
  agents as agentsApi,
  type Prompt,
  type Agent,
  type ChatMessage,
} from '../api'
import PromptCard from '../components/PromptCard'
import ChatInput, { type ChatInputHandle } from '../components/ChatInput'
import CommandSuggestions from '../components/CommandSuggestions'
import ModelSelector from '../components/ModelSelector'
import RefineSelector, { type RefineMode } from '../components/RefineSelector'
import RefineDiff from '../components/RefineDiff'
import HistoryPanel from '../components/HistoryPanel'
import SessionsPanel from '../components/SessionsPanel'
import { useCommandSuggestions } from '../hooks/useCommandSuggestions'

interface Props {
  provider: string;
  model: string;
  onModelChange: (provider: string, model: string) => void;
}

interface SystemEntry {
  id: string;
  content: string;
  type: 'info' | 'error';
}

export default function Chat({ provider, model, onModelChange }: Props) {
  const { conversationId } = useParams<{ conversationId: string }>()
  const outletCtx = useOutletContext<{ selectedProject?: string | null; setSelectedProject?: (id: string | null) => void } | null>()
  const selectedProject = outletCtx?.selectedProject ?? null

  // Prompt cards state
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loadingPrompts, setLoadingPrompts] = useState(false)

  // Conversation view state (for /c/:id route)
  const [convMessages, setConvMessages] = useState<ChatMessage[]>([])
  const [loadingConv, setLoadingConv] = useState(false)

  // System log (slash command output)
  const [systemLog, setSystemLog] = useState<SystemEntry[]>([])

  // Slash command state
  const [slashQuery, setSlashQuery] = useState<string | null>(null)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [showRefineSelector, setShowRefineSelector] = useState(false)
  const [refiningPromptId, setRefiningPromptId] = useState<string | null>(null)
  const [refineDiff, setRefineDiff] = useState<{ promptId: string; original: string; refined: string } | null>(null)
  const [refineLoading, setRefineLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showSessions, setShowSessions] = useState(false)

  const chatInputRef = useRef<ChatInputHandle>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { suggestions } = useCommandSuggestions(slashQuery ?? '')
  const showSuggestions = slashQuery !== null

  // Load prompts and agents when project changes
  useEffect(() => {
    if (!selectedProject) { setPrompts([]); setAgents([]); return }
    setLoadingPrompts(true)
    setSystemLog([])
    Promise.all([
      promptsApi.list(selectedProject),
      agentsApi.listByProject(selectedProject),
    ]).then(([p, a]) => {
      setPrompts(p)
      setAgents(a)
      // Restore scroll position after prompts load
      requestAnimationFrame(() => {
        const el = scrollRef.current
        if (!el) return
        try {
          const saved = sessionStorage.getItem(`aicp:scroll:${selectedProject}`)
          if (saved) el.scrollTop = parseInt(saved, 10)
        } catch {}
      })
    }).catch(() => {})
      .finally(() => setLoadingPrompts(false))
  }, [selectedProject])

  // Save scroll position (debounced)
  function handleScroll() {
    if (!selectedProject || !scrollRef.current) return
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(`aicp:scroll:${selectedProject}`, String(scrollRef.current!.scrollTop))
      } catch {}
    }, 200)
  }

  // Load conversation messages (for /c/:id)
  useEffect(() => {
    if (!conversationId) { setConvMessages([]); return }
    setLoadingConv(true)
    convsApi.messages(conversationId)
      .then(msgs => setConvMessages(msgs.filter(m => m.role !== 'tool')))
      .catch(() => setConvMessages([]))
      .finally(() => setLoadingConv(false))
  }, [conversationId])

  // ── System log helper ──────────────────────────────────────────────
  const pushSystemEntry = useCallback((content: string, type: 'info' | 'error' = 'info') => {
    setSystemLog(prev => [...prev, {
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content,
      type,
    }])
  }, [])

  // ── Prompt CRUD ────────────────────────────────────────────────────
  function handlePromptUpdate(updated: Prompt) {
    setPrompts(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  const createDraftPrompt = useCallback(async (text: string) => {
    if (!selectedProject) return
    try {
      const prompt = await promptsApi.create({
        project_id: selectedProject,
        title: text.length > 60 ? text.slice(0, 57) + '...' : text,
        body: text,
        order_index: prompts.length,
      })
      setPrompts(prev => [...prev, prompt])
    } catch (err) {
      pushSystemEntry(err instanceof Error ? err.message : 'Failed to create prompt', 'error')
    }
  }, [selectedProject, prompts.length, pushSystemEntry])

  // ── Slash command execution ────────────────────────────────────────
  const handleSlashExecute = useCallback((command: string) => {
    const cmd = command.trim().toLowerCase()

    switch (cmd) {
      case '/new':
        if (!selectedProject) {
          pushSystemEntry('Select a project first', 'error')
        } else {
          createDraftPrompt('Untitled prompt')
        }
        break

      case '/snippet':
        pushSystemEntry('Snippet browser — coming soon')
        break

      case '/model':
        setShowModelSelector(true)
        break

      case '/refine':
        if (prompts.length === 0) {
          pushSystemEntry('No prompts to refine', 'error')
        } else {
          setShowRefineSelector(true)
        }
        break

      case '/history':
        if (selectedProject) {
          setShowHistory(true)
        } else {
          pushSystemEntry('Select a project first', 'error')
        }
        break

      case '/sessions':
        if (selectedProject) {
          setShowSessions(true)
        } else {
          pushSystemEntry('Select a project first', 'error')
        }
        break

      default:
        pushSystemEntry(`Unknown command: ${command}`, 'error')
    }
  }, [selectedProject, provider, model, prompts, pushSystemEntry, createDraftPrompt])

  // ── Unified send handler ───────────────────────────────────────────
  const handleSend = useCallback((text: string) => {
    if (selectedProject) {
      createDraftPrompt(text)
    }
  }, [selectedProject, createDraftPrompt])

  function handleModelSelect(p: string, m: string) {
    onModelChange(p, m)
    setShowModelSelector(false)
    pushSystemEntry(`Switched to ${p}/${m}`)
  }

  function handleRefineSelect(mode: RefineMode) {
    setShowRefineSelector(false)
    const sorted = prompts.slice().sort((a, b) => a.order_index - b.order_index)
    const last = sorted[sorted.length - 1]
    if (!last) return

    if (mode === 'manual') {
      setRefiningPromptId(last.id)
    } else {
      setRefineLoading(true)
      setRefineDiff(null)
      promptsApi.refine(last.id, provider, model)
        .then(res => {
          setRefineDiff({ promptId: res.prompt_id, original: res.original, refined: res.refined })
        })
        .catch(err => {
          pushSystemEntry(err instanceof Error ? err.message : 'Refine failed', 'error')
        })
        .finally(() => setRefineLoading(false))
    }
  }

  async function handleRefineAccept() {
    if (!refineDiff) return
    try {
      const updated = await promptsApi.update(refineDiff.promptId, {
        body: refineDiff.refined,
        title: refineDiff.refined.length > 60 ? refineDiff.refined.slice(0, 57) + '...' : refineDiff.refined,
      })
      handlePromptUpdate(updated)
      pushSystemEntry('Prompt refined')
    } catch (err) {
      pushSystemEntry(err instanceof Error ? err.message : 'Failed to save refinement', 'error')
    }
    setRefineDiff(null)
  }

  function handleHistoryRestore(prompt: Prompt) {
    handlePromptUpdate(prompt)
    pushSystemEntry(`Restored prompt "${prompt.title}"`)
  }

  function handleSuggestionSelect(text: string) {
    chatInputRef.current?.setValue(text)
  }

  // ── View mode ──────────────────────────────────────────────────────
  const showPromptCards = !!selectedProject && !conversationId
  const showConversation = !!conversationId

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Main content area */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

          {/* System log */}
          {systemLog.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {systemLog.map(entry => (
                <div
                  key={entry.id}
                  className="px-3 py-2 rounded text-xs font-mono leading-relaxed whitespace-pre-wrap"
                  style={{
                    background: entry.type === 'error' ? 'rgba(239, 68, 68, 0.06)' : 'var(--color-surface-1)',
                    border: `1px solid ${entry.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'var(--color-border)'}`,
                    color: entry.type === 'error' ? 'var(--color-danger)' : 'var(--color-text-secondary)',
                  }}
                >
                  {entry.content}
                </div>
              ))}
              <button
                onClick={() => setSystemLog([])}
                className="text-[9px] font-mono text-text-muted hover:text-text-secondary transition-colors"
              >
                clear
              </button>
            </div>
          )}

          {/* Refine diff preview */}
          {(refineDiff || refineLoading) && (
            <RefineDiff
              original={refineDiff?.original ?? ''}
              refined={refineDiff?.refined ?? ''}
              loading={refineLoading}
              onAccept={handleRefineAccept}
              onReject={() => setRefineDiff(null)}
            />
          )}

          {/* History panel */}
          {showHistory && selectedProject && (
            <HistoryPanel
              projectId={selectedProject}
              onRestore={handleHistoryRestore}
              onDismiss={() => setShowHistory(false)}
            />
          )}

          {/* Sessions panel */}
          {showSessions && selectedProject && (
            <SessionsPanel
              projectId={selectedProject}
              agents={agents}
              onDismiss={() => setShowSessions(false)}
            />
          )}

          {/* Prompt Cards view */}
          {showPromptCards && (
            loadingPrompts ? (
              <div className="text-text-muted font-mono text-sm animate-pulse py-8 text-center">
                Loading prompts...
              </div>
            ) : prompts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="text-text-muted text-sm mb-2">No prompts in this project.</div>
                <div className="text-text-muted text-xs font-mono">
                  Type below to create a draft prompt.
                </div>
              </div>
            ) : (
              prompts
                .slice()
                .sort((a, b) => a.order_index - b.order_index)
                .map(prompt => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    agents={agents}
                    onUpdate={(p) => { handlePromptUpdate(p); setRefiningPromptId(null) }}
                    onNavigateHistory={() => setShowHistory(true)}
                    autoRefine={refiningPromptId === prompt.id}
                    onRefineDismiss={() => setRefiningPromptId(null)}
                  />
                ))
            )
          )}

          {/* Conversation view */}
          {showConversation && (
            loadingConv ? (
              <div className="text-text-muted font-mono text-sm animate-pulse py-8 text-center">
                Loading session...
              </div>
            ) : convMessages.length === 0 ? (
              <div className="text-center py-16 text-text-muted text-sm">
                No messages in this session.
              </div>
            ) : (
              convMessages.map(msg => (
                <div
                  key={msg.id}
                  className="rounded-lg border overflow-hidden"
                  style={{
                    background: msg.role === 'assistant' ? 'var(--color-surface-1)' : 'var(--color-surface-2)',
                    borderColor: msg.role === 'assistant' ? 'rgba(110, 231, 183, 0.15)' : 'var(--color-border)',
                  }}
                >
                  <div
                    className="flex items-center gap-2 px-4 py-2"
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                  >
                    <span
                      className="text-[9px] font-mono font-semibold uppercase tracking-wider"
                      style={{ color: msg.role === 'assistant' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
                    >
                      {msg.role}
                    </span>
                    <span className="text-[9px] font-mono text-text-muted">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="px-4 py-3 text-xs font-mono text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              ))
            )
          )}

          {/* Empty state */}
          {!showPromptCards && !showConversation && systemLog.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="font-mono text-accent text-2xl font-bold mb-2">AICP</div>
              <p className="text-text-muted text-sm">Select a project to view prompts.</p>
            </div>
          )}

        </div>
      </div>

      {/* Input area */}
      <div className="relative">
        {showModelSelector && (
          <ModelSelector
            currentProvider={provider}
            currentModel={model}
            onSelect={handleModelSelect}
            onDismiss={() => setShowModelSelector(false)}
          />
        )}

        {showRefineSelector && (
          <RefineSelector
            onSelect={handleRefineSelect}
            onDismiss={() => setShowRefineSelector(false)}
          />
        )}

        {!showModelSelector && !showRefineSelector && showSuggestions && (
          <CommandSuggestions
            suggestions={suggestions}
            onSelect={handleSuggestionSelect}
            onDismiss={() => setSlashQuery(null)}
          />
        )}

        <ChatInput
          ref={chatInputRef}
          onSend={handleSend}
          onSlashExecute={handleSlashExecute}
          disabled={false}
          onSlashTrigger={setSlashQuery}
          onSlashDismiss={() => setSlashQuery(null)}
          slashActive={slashQuery !== null}
        />
      </div>
    </div>
  )
}
