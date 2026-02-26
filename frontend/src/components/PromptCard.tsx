import { useState, useEffect } from 'react'
import type { Prompt, Agent } from '../api'
import { prompts as promptsApi } from '../api'
import StatusBadge from './StatusBadge'

interface Props {
  prompt: Prompt
  agents: Agent[]
  onUpdate: (prompt: Prompt) => void
  onNavigateHistory: () => void
  autoRefine?: boolean
  onRefineDismiss?: () => void
}

export default function PromptCard({ prompt, agents, onUpdate, onNavigateHistory, autoRefine, onRefineDismiss }: Props) {
  const [refining, setRefining] = useState(false)

  // Auto-open refine mode when triggered by /refine manual
  useEffect(() => {
    if (autoRefine && !refining) {
      setTitle(prompt.title)
      setBody(prompt.body)
      setRefining(true)
      setError(null)
    }
  }, [autoRefine])
  const [title, setTitle] = useState(prompt.title)
  const [body, setBody] = useState(prompt.body)
  const [saving, setSaving] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [output, setOutput] = useState<{ label: string; detail: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleExecute() {
    setExecuting(true)
    setError(null)
    try {
      const idle = agents.find(a => a.status === 'idle')
      if (!idle) throw new Error('No idle agent available')
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
    setSaving(true)
    setError(null)
    try {
      const updated = await promptsApi.update(prompt.id, { title, body })
      onUpdate(updated)
      setRefining(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function startRefine() {
    setTitle(prompt.title)
    setBody(prompt.body)
    setRefining(true)
    setError(null)
  }

  function cancelRefine() {
    setTitle(prompt.title)
    setBody(prompt.body)
    setRefining(false)
    setError(null)
    onRefineDismiss?.()
  }

  return (
    <div className="rounded-lg border border-border bg-surface-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
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
        <StatusBadge status={prompt.status} />
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {refining ? (
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 text-xs font-mono leading-relaxed bg-surface-2 border border-border rounded text-text-primary focus:outline-none focus:border-accent/50 resize-y"
          />
        ) : (
          <div className="text-xs font-mono text-text-secondary leading-relaxed whitespace-pre-wrap break-words">
            {prompt.body || (
              <span className="text-text-muted italic">No content</span>
            )}
          </div>
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
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border">
        {refining ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-[10px] font-mono font-semibold bg-accent text-surface-0 rounded hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={cancelRefine}
              className="px-3 py-1.5 text-[10px] font-mono text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleExecute}
              disabled={executing || prompt.status === 'done'}
              className="px-3 py-1.5 text-[10px] font-mono font-semibold bg-accent text-surface-0 rounded hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {executing ? 'Executing...' : 'Execute'}
            </button>
            <button
              onClick={startRefine}
              className="px-3 py-1.5 text-[10px] font-mono font-medium text-text-muted hover:text-text-primary border border-border rounded hover:border-border-bright transition-colors"
            >
              Refine
            </button>
            <button
              onClick={onNavigateHistory}
              className="px-3 py-1.5 text-[10px] font-mono font-medium text-text-muted hover:text-text-primary border border-border rounded hover:border-border-bright transition-colors"
            >
              History
            </button>
          </>
        )}
      </div>
    </div>
  )
}
