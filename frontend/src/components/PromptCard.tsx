import { useState, useEffect, useRef, useCallback } from 'react'
import type { Prompt, Agent, PromptStatus } from '../api'
import { prompts as promptsApi } from '../api'

const ALL_STATUSES: PromptStatus[] = ['draft', 'ready', 'sent', 'done']

const STATUS_COLORS: Record<PromptStatus, string> = {
  draft: 'var(--color-status-draft)',
  ready: 'var(--color-status-ready)',
  sent: 'var(--color-status-sent)',
  done: 'var(--color-status-done)',
}

const STATUS_BADGE_STYLES: Record<PromptStatus, string> = {
  draft: 'bg-status-draft/20 text-status-draft border-status-draft/30',
  ready: 'bg-status-ready/20 text-status-ready border-status-ready/30',
  sent: 'bg-status-sent/20 text-status-sent border-status-sent/30',
  done: 'bg-status-done/20 text-status-done border-status-done/30',
}

interface Props {
  prompt: Prompt
  agents: Agent[]
  onUpdate: (prompt: Prompt) => void
  onNavigateHistory: () => void
  onClose?: () => void
  autoRefine?: boolean
  onRefineDismiss?: () => void
  onInsertSnippet?: () => void
  pendingSnippetContent?: string | null
  onSnippetInserted?: () => void
  initialEdit?: boolean
  fillHeight?: boolean
  provider?: string
  model?: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }
  return (
    <button
      onClick={e => { e.stopPropagation(); handleCopy() }}
      className="p-1 rounded hover:bg-surface-2 transition-colors shrink-0"
      title="Copy content"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

export default function PromptCard({ prompt, agents, onUpdate, onNavigateHistory, onClose, autoRefine, onRefineDismiss, onInsertSnippet, pendingSnippetContent, onSnippetInserted, initialEdit, fillHeight, provider, model }: Props) {
  const [refining, setRefining] = useState(!!initialEdit)
  const [expanded, setExpanded] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const [title, setTitle] = useState(prompt.title)
  const [body, setBody] = useState(prompt.body)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoad = useRef(true)

  // Allow initial state to settle before enabling auto-save
  useEffect(() => {
    initialLoad.current = true
    setTitle(prompt.title)
    setBody(prompt.body)
    setExpanded(false)
    setTimeout(() => { initialLoad.current = false }, 50)
  }, [prompt.id])

  // Consume pending snippet content — append to body
  useEffect(() => {
    if (!pendingSnippetContent) return
    setBody(prev => prev ? `${prev}\n\n---\n\n${pendingSnippetContent}` : pendingSnippetContent)
    onSnippetInserted?.()
  }, [pendingSnippetContent, onSnippetInserted])

  // Auto-open refine mode when triggered by /refine manual
  useEffect(() => {
    if (autoRefine && !refining) {
      setTitle(prompt.title)
      setBody(prompt.body)
      setRefining(true)
      setError(null)
    }
  }, [autoRefine])
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const statusMenuRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [aiRefining, setAiRefining] = useState(false)
  const [output, setOutput] = useState<{ label: string; detail: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Auto-save with debounce
  const doAutoSave = useCallback(async (t: string, b: string) => {
    setSaveStatus('saving')
    try {
      const updated = await promptsApi.update(prompt.id, { title: t, body: b })
      onUpdate(updated)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('idle')
    }
  }, [prompt.id, onUpdate])

  useEffect(() => {
    if (initialLoad.current) return
    if (!refining) return
    if (title === prompt.title && body === prompt.body) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doAutoSave(title, body), 800)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [title, body, prompt.title, prompt.body, refining, doAutoSave])

  // Flush pending save on unmount (e.g. navigating away)
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
    }
  }, [])

  // Escape to close
  useEffect(() => {
    if (!onClose) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Flush pending auto-save
        if (saveTimer.current) {
          clearTimeout(saveTimer.current)
          saveTimer.current = null
          if (title !== prompt.title || body !== prompt.body) {
            promptsApi.update(prompt.id, { title, body }).then(onUpdate).catch(() => {})
          }
        }
        onClose!()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, title, body, prompt.id, prompt.title, prompt.body, onUpdate])

  // Detect if body text is truncated
  useEffect(() => {
    if (refining || !bodyRef.current) return
    setIsTruncated(bodyRef.current.scrollHeight > bodyRef.current.clientHeight)
  }, [prompt.body, refining, expanded])

  // Close status menu on click outside
  useEffect(() => {
    if (!statusMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setStatusMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [statusMenuOpen])

  async function handleStatusChange(newStatus: PromptStatus) {
    setStatusMenuOpen(false)
    if (newStatus === prompt.status) return
    try {
      const updated = await promptsApi.update(prompt.id, { status: newStatus })
      onUpdate(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status change failed')
    }
  }

  async function handleExecute() {
    setExecuting(true)
    setError(null)
    try {
      if (agents.length === 0) throw new Error('No agents connected')
      const idle = agents.find(a => a.status === 'idle')
      if (!idle) throw new Error('No idle agents available')
      const result = await promptsApi.execute(prompt.id, idle.id)
      setOutput({
        label: `Sent to ${idle.machine_name}`,
        detail: `session ${result.session_id.slice(0, 12)}... · status: ${result.status}`,
      })
      onUpdate({
        ...prompt,
        status: 'sent' as const,
        agent_id: result.agent_id,
        sent_at: new Date().toISOString(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed')
    } finally {
      setExecuting(false)
    }
  }

  async function handleSave() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await promptsApi.update(prompt.id, { title, body })
      onUpdate(updated)
      setSaveStatus('saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleAiRefine() {
    setAiRefining(true)
    setError(null)
    try {
      // Save current edits first so the API refines the latest content
      if (refining && (title !== prompt.title || body !== prompt.body)) {
        await promptsApi.update(prompt.id, { title, body })
      }
      const result = await promptsApi.refine(prompt.id, provider, model)
      // Auto-save the refined text
      const refinedTitle = result.refined.length > 60 ? result.refined.slice(0, 57) + '...' : result.refined.split('\n')[0].slice(0, 60)
      const updated = await promptsApi.update(prompt.id, { title: refinedTitle, body: result.refined })
      setTitle(updated.title)
      setBody(updated.body)
      onUpdate(updated)
      if (!refining) {
        setRefining(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refine failed')
    } finally {
      setAiRefining(false)
    }
  }

  function cancelRefine() {
    setTitle(prompt.title)
    setBody(prompt.body)
    setRefining(false)
    setError(null)
    onRefineDismiss?.()
  }

  return (
    <div className={`rounded-lg border border-border bg-surface-1 overflow-hidden${fillHeight ? ' flex flex-col h-full' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        {refining ? (
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="flex-1 px-2 py-1 text-sm font-medium bg-surface-2 border border-border rounded text-text-primary focus:outline-none focus:border-accent/50"
            autoFocus
          />
        ) : (
          <span className="flex-1 text-[13px] font-semibold text-text-primary truncate">
            {prompt.title}
          </span>
        )}

        {/* Save status indicator */}
        {refining && (
          <span
            className="text-[10px] font-mono shrink-0 transition-colors"
            style={{
              color: saveStatus === 'saving' ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}
          >
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
          </span>
        )}

        <CopyButton text={refining ? body : prompt.body} />

        <div ref={statusMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); setStatusMenuOpen(v => !v) }}
            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider border rounded cursor-pointer transition-colors ${STATUS_BADGE_STYLES[prompt.status]}`}
          >
            {prompt.status}
            <span className="ml-1 text-[8px] opacity-60">▼</span>
          </button>

          {statusMenuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '4px',
                zIndex: 40,
                minWidth: '100px',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border-bright)',
                borderRadius: '6px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                padding: '4px 0',
              }}
            >
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={e => { e.stopPropagation(); handleStatusChange(s) }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    width: '100%',
                    textAlign: 'left',
                    padding: '5px 10px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: s === prompt.status ? 700 : 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: s === prompt.status ? STATUS_COLORS[s] : 'var(--color-text-secondary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: STATUS_COLORS[s],
                      flexShrink: 0,
                    }}
                  />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={`px-4 py-3${fillHeight ? ' flex-1 flex flex-col overflow-hidden' : ''}`}>
        {refining ? (
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={fillHeight ? undefined : 6}
            className={`w-full px-3 py-2 text-xs font-mono leading-relaxed bg-surface-2 border border-border rounded text-text-primary focus:outline-none focus:border-accent/50${fillHeight ? ' flex-1 resize-none' : ' resize-y'}`}
          />
        ) : (
          <>
            <div
              ref={bodyRef}
              className={`text-xs font-mono text-text-secondary leading-relaxed whitespace-pre-wrap break-words${fillHeight ? ' flex-1 overflow-y-auto' : ''}`}
              style={!fillHeight && !expanded ? { maxHeight: '4.8em', overflow: 'hidden' } : undefined}
            >
              {prompt.body || (
                <span className="text-text-muted italic">No content</span>
              )}
            </div>
            {!fillHeight && (isTruncated || expanded) && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="mt-1 text-[10px] font-mono text-accent hover:text-accent/80 transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {expanded ? 'Less...' : 'More...'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Output block */}
      {output && (
        <div
          className="mx-4 mb-3 px-3 py-2.5 rounded"
          style={{
            background: 'var(--color-surface-0)',
            border: '1px solid rgba(110, 231, 183, 0.15)',
            borderLeft: '2px solid var(--color-accent)',
          }}
        >
          <div
            style={{
              fontSize: '9px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
              marginBottom: '4px',
            }}
          >
            Output
          </div>
          <div className="text-[11px] font-mono text-text-secondary">
            {output.label}
          </div>
          <div className="text-[10px] font-mono text-text-muted mt-0.5">
            {output.detail}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mb-3 px-3 py-2 text-[10px] font-mono bg-danger/10 text-danger border border-danger/20 rounded">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border shrink-0">
        <button
          onClick={handleSave}
          disabled={saving || !refining}
          className="px-3 py-1.5 text-[10px] font-mono font-semibold bg-accent text-surface-0 rounded hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={handleExecute}
          disabled={executing || prompt.status === 'done'}
          className="px-3 py-1.5 text-[10px] font-mono font-medium text-text-muted hover:text-text-primary border border-border rounded hover:border-border-bright transition-colors"
        >
          {executing ? 'Executing...' : 'Execute'}
        </button>
        <button
          onClick={handleAiRefine}
          disabled={aiRefining}
          className={`px-3 py-1.5 text-[10px] font-mono font-medium rounded transition-colors ${
            aiRefining
              ? 'border border-accent/50 text-accent'
              : 'text-text-muted hover:text-text-primary border border-border hover:border-border-bright'
          }`}
        >
          {aiRefining ? (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block animate-spin"
                style={{
                  width: '10px',
                  height: '10px',
                  border: '1.5px solid rgba(110, 231, 183, 0.3)',
                  borderTopColor: 'var(--color-accent)',
                  borderRadius: '50%',
                }}
              />
              Refining
            </span>
          ) : 'Refine'}
        </button>
        <button
          onClick={onNavigateHistory}
          className="px-3 py-1.5 text-[10px] font-mono font-medium text-text-muted hover:text-text-primary border border-border rounded hover:border-border-bright transition-colors"
        >
          History
        </button>
        {onInsertSnippet && (
          <button
            onClick={onInsertSnippet}
            className="px-3 py-1.5 text-[10px] font-mono font-medium text-text-muted hover:text-text-primary border border-border rounded hover:border-border-bright transition-colors"
          >
            Insert Snippet
          </button>
        )}
      </div>
    </div>
  )
}
