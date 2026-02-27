import { useState, useEffect, useRef, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  prompts as promptsApi,
  agents as agentsApi,
  type Prompt,
  type Agent,
  type Snippet,
} from '../api'
import PromptCard from '../components/PromptCard'
import SnippetSelectorModal from '../components/SnippetSelectorModal'
import ChatInput, { type ChatInputHandle } from '../components/ChatInput'
import CommandSuggestions from '../components/CommandSuggestions'
import ModelSelector from '../components/ModelSelector'
import RefineSelector, { type RefineMode } from '../components/RefineSelector'
import RefineDiff from '../components/RefineDiff'
import HistoryPanel from '../components/HistoryPanel'
import PromptExecutionHistory from '../components/PromptExecutionHistory'
import { useCommandSuggestions } from '../hooks/useCommandSuggestions'
import { useError } from '../hooks/useError'
import ErrorContainer from '../components/ErrorContainer'

interface Props {
  provider: string;
  model: string;
  onModelChange: (provider: string, model: string) => void;
}

interface SystemEntry {
  id: string;
  content: string;
}

export default function Chat({ provider, model, onModelChange }: Props) {
  const outletCtx = useOutletContext<{ selectedProject?: string | null; setSelectedProject?: (id: string | null) => void; activePromptId?: string | null; setActivePromptId?: (id: string | null) => void; onPromptUpdated?: () => void; promptPreviewLines?: number } | null>()
  const selectedProject = outletCtx?.selectedProject ?? null
  const activePromptId = outletCtx?.activePromptId ?? null
  const setActivePromptId = outletCtx?.setActivePromptId
  const onPromptUpdated = outletCtx?.onPromptUpdated
  const promptPreviewLines = outletCtx?.promptPreviewLines ?? 3

  // Prompt cards state
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  const promptsLoadedFor = useRef<string | null>(null)

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
  const [showSnippetSelector, setShowSnippetSelector] = useState(false)
  const [pendingSnippetContent, setPendingSnippetContent] = useState<string | null>(null)

  const draftPromptId = useRef<string | null>(null)
  const { showError } = useError()
  const chatInputRef = useRef<ChatInputHandle>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { suggestions } = useCommandSuggestions(slashQuery ?? '')
  const showSuggestions = slashQuery !== null

  // Load prompts and agents when project changes
  const loadPromptsForProject = useCallback((projectId: string) => {
    setLoadingPrompts(true)
    Promise.all([
      promptsApi.list(projectId).catch(() => [] as Prompt[]),
      agentsApi.listByProject(projectId).catch(() => [] as Agent[]),
    ]).then(([p, a]) => {
      setPrompts(p)
      setAgents(a)
      requestAnimationFrame(() => {
        const el = scrollRef.current
        if (!el) return
        try {
          const saved = sessionStorage.getItem(`aicp:scroll:${projectId}`)
          if (saved) el.scrollTop = parseInt(saved, 10)
        } catch {}
      })
    }).finally(() => {
      promptsLoadedFor.current = projectId
      setLoadingPrompts(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedProject) {
      setPrompts([]); setAgents([]); promptsLoadedFor.current = null
      return
    }
    setSystemLog([])
    loadPromptsForProject(selectedProject)
  }, [selectedProject, loadPromptsForProject])

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

  // ── System log helper (info messages only) ─────────────────────────
  const pushSystemEntry = useCallback((content: string) => {
    setSystemLog(prev => [...prev, {
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content,
    }])
  }, [])

  // ── Prompt CRUD ────────────────────────────────────────────────────
  function handlePromptUpdate(updated: Prompt) {
    setPrompts(prev => prev.map(p => p.id === updated.id ? updated : p))
    onPromptUpdated?.()
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
      showError(err instanceof Error ? err.message : 'Failed to create prompt')
    }
  }, [selectedProject, prompts.length, showError])

  // Close prompt editor — delete empty drafts created via /new
  const closePromptEditor = useCallback(() => {
    const closingId = activePromptId
    if (closingId && draftPromptId.current === closingId) {
      const current = prompts.find(p => p.id === closingId)
      if (current && !current.body?.trim()) {
        // Empty draft — remove from state and delete from backend
        setPrompts(prev => prev.filter(p => p.id !== closingId))
        promptsApi.delete(closingId).catch(() => {})
      }
      draftPromptId.current = null
    }
    setActivePromptId?.(null)
  }, [activePromptId, prompts, setActivePromptId])

  // ── Slash command execution ────────────────────────────────────────
  const handleSlashExecute = useCallback((command: string) => {
    const trimmed = command.trim()
    const spaceIdx = trimmed.indexOf(' ')
    const cmd = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase()
    const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim()

    switch (cmd) {
      case '/new':
        if (!selectedProject) {
          showError('Select a project first')
        } else if (args) {
          createDraftPrompt(args)
        } else {
          // Open editor with an empty draft — deleted on close if still empty
          promptsApi.create({
            project_id: selectedProject,
            title: '',
            body: '',
            order_index: prompts.length,
          }).then(p => {
            draftPromptId.current = p.id
            setPrompts(prev => [...prev, p])
            setActivePromptId?.(p.id)
          }).catch(err => {
            showError(err instanceof Error ? err.message : 'Failed to create prompt')
          })
        }
        break

      case '/snippet':
        if (!activePromptId) {
          showError('Select a prompt first to insert a snippet')
        } else {
          setShowSnippetSelector(true)
        }
        break

      case '/model':
        setShowModelSelector(true)
        break

      case '/refine':
        if (prompts.length === 0) {
          showError('No prompts to refine')
        } else {
          setShowRefineSelector(true)
        }
        break

      case '/history':
        if (selectedProject) {
          setShowHistory(true)
        } else {
          showError('Select a project first')
        }
        break

      default:
        showError(`Unknown command: ${command}`)
    }
  }, [selectedProject, provider, model, prompts, createDraftPrompt, showError])

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
          showError(err instanceof Error ? err.message : 'Refine failed')
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
      showError(err instanceof Error ? err.message : 'Failed to save refinement')
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

  function handleSnippetInsert(snippet: Snippet) {
    setShowSnippetSelector(false)
    if (activePromptId) {
      setPendingSnippetContent(snippet.content)
      pushSystemEntry(`Inserted snippet "${snippet.name}"`)
    } else {
      showError('Select a prompt first to insert a snippet')
    }
  }

  // ── View mode ──────────────────────────────────────────────────────
  const showSinglePrompt = !!activePromptId && !!selectedProject
  const showPromptCards = !!selectedProject && !activePromptId

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Single Prompt editor (full-bleed, fills panel) ──────────── */}
      {showSinglePrompt && (() => {
        const promptsStale = promptsLoadedFor.current !== selectedProject
        if (loadingPrompts || promptsStale) {
          return (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-text-muted font-mono text-sm animate-pulse">
                Loading prompt...
              </div>
            </div>
          )
        }
        const activePrompt = prompts.find(p => p.id === activePromptId)
        if (!activePrompt) {
          return (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-text-muted text-sm mb-2">Prompt not found.</div>
              <button
                onClick={closePromptEditor}
                className="text-xs font-mono text-accent hover:underline"
              >
                Show all prompts
              </button>
            </div>
          )
        }
        return (
          <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
            <div
              className="flex items-center gap-3 shrink-0"
              style={{ height: '48px', borderBottom: '1px solid var(--color-border)', margin: '-16px -16px 0', padding: '0 16px' }}
            >
              <button
                onClick={closePromptEditor}
                style={{
                  fontSize: '16px', color: 'var(--color-text-muted)', background: 'none',
                  border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 2px',
                  flexShrink: 0,
                }}
                title="Back to all prompts"
              >
                &#x2190;
              </button>
              <span
                style={{
                  fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}
              >
                Prompt Editor
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <PromptCard
                key={activePrompt.id}
                prompt={activePrompt}
                agents={agents}
                onUpdate={(p) => { handlePromptUpdate(p); setRefiningPromptId(null) }}
                onNavigateHistory={() => setShowHistory(true)}
                onClose={closePromptEditor}
                autoRefine={refiningPromptId === activePrompt.id}
                onRefineDismiss={() => setRefiningPromptId(null)}
                onInsertSnippet={() => setShowSnippetSelector(true)}
                pendingSnippetContent={pendingSnippetContent}
                onSnippetInserted={() => setPendingSnippetContent(null)}
                initialEdit
                fillHeight
                provider={provider}
                model={model}
              />
            </div>
          </div>
        )
      })()}

      {/* ── Scrollable content (prompt cards, empty state, etc.) ──── */}
      {!showSinglePrompt && (
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

            {/* System log (info messages only) */}
            {systemLog.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {systemLog.map(entry => (
                  <div
                    key={entry.id}
                    className="px-3 py-2 rounded text-xs font-mono leading-relaxed whitespace-pre-wrap"
                    style={{
                      background: 'var(--color-surface-1)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-secondary)',
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
                    <div
                      key={prompt.id}
                      className="cursor-pointer"
                      onClick={() => setActivePromptId?.(prompt.id)}
                    >
                      <PromptCard
                        prompt={prompt}
                        agents={agents}
                        onUpdate={(p) => { handlePromptUpdate(p); setRefiningPromptId(null) }}
                        onNavigateHistory={() => setShowHistory(true)}
                        autoRefine={refiningPromptId === prompt.id}
                        onRefineDismiss={() => setRefiningPromptId(null)}
                        previewLines={promptPreviewLines}
                      />
                    </div>
                  ))
              )
            )}

            {/* Empty state */}
            {!showPromptCards && systemLog.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="font-mono text-accent text-2xl font-bold mb-2">AICP</div>
                <p className="text-text-muted text-sm">Select a project to view prompts.</p>
              </div>
            )}

          </div>
        </div>
      )}

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

        {showSnippetSelector && (
          <SnippetSelectorModal
            onSelect={handleSnippetInsert}
            onDismiss={() => setShowSnippetSelector(false)}
          />
        )}

        <ErrorContainer />

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
