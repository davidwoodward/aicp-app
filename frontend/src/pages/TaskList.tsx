import { useState, useEffect, useRef } from 'react'
import { prompts as api, agents as agentsApi, type Prompt, type Agent } from '../api'

interface Props {
  projectId: string
  prompts: Prompt[]
  setPrompts: React.Dispatch<React.SetStateAction<Prompt[]>>
}

export default function TaskList({ projectId, prompts, setPrompts }: Props) {
  const [agentList, setAgentList] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [executing, setExecuting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)

  const readyPrompts = prompts
    .filter((p) => p.status === 'ready')
    .sort((a, b) => a.order_index - b.order_index)

  useEffect(() => {
    agentsApi.listByProject(projectId).then(setAgentList).catch(() => {})
  }, [projectId])

  const idleAgents = agentList.filter((a) => a.status === 'idle')

  async function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return
    if (dragItem.current === dragOverItem.current) return

    const reordered = [...readyPrompts]
    const [moved] = reordered.splice(dragItem.current, 1)
    reordered.splice(dragOverItem.current, 0, moved)

    // Optimistic reorder — update order_index in state immediately
    const snapshot = [...prompts]
    setPrompts(prev => {
      const updated = [...prev]
      reordered.forEach((rp, i) => {
        const idx = updated.findIndex(p => p.id === rp.id)
        if (idx !== -1) updated[idx] = { ...updated[idx], order_index: i }
      })
      return updated
    })

    dragItem.current = null
    dragOverItem.current = null

    try {
      await api.reorder(projectId, reordered.map((p) => p.id))
    } catch (err: unknown) {
      setPrompts(snapshot)
      setError(err instanceof Error ? err.message : 'Failed to reorder')
    }
  }

  async function handleExecute(promptId: string) {
    if (!selectedAgent) return
    setExecuting(promptId)
    setError('')

    // Optimistic: mark as 'sent' immediately
    const snapshot = prompts.find(p => p.id === promptId)
    setPrompts(prev => prev.map(p =>
      p.id === promptId ? { ...p, status: 'sent' as const, sent_at: new Date().toISOString() } : p
    ))

    try {
      await api.execute(promptId, selectedAgent)
    } catch (err: unknown) {
      // Rollback to previous status
      if (snapshot) {
        setPrompts(prev => prev.map(p => p.id === promptId ? snapshot : p))
      }
      setError(err instanceof Error ? err.message : 'Failed to execute')
    } finally {
      setExecuting(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
          Task Queue ({readyPrompts.length})
        </span>

        {/* Agent selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-text-muted">Agent:</span>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="px-2 py-1 text-xs font-mono bg-surface-2 border border-border rounded text-text-primary focus:outline-none focus:border-accent/50"
          >
            <option value="">Select agent...</option>
            {idleAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.machine_name} ({a.status})
              </option>
            ))}
          </select>
          {agentList.length > 0 && idleAgents.length === 0 && (
            <span className="text-[10px] font-mono text-status-busy">No idle agents</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 text-xs font-mono bg-danger/10 text-danger border border-danger/20 rounded">
          {error}
        </div>
      )}

      {readyPrompts.length === 0 ? (
        <div className="text-center py-10 text-text-muted text-sm">
          No ready prompts. Mark prompts as "ready" in the Prompts tab.
        </div>
      ) : (
        <div className="space-y-1">
          {readyPrompts.map((prompt, index) => (
            <div
              key={prompt.id}
              draggable
              onDragStart={() => { dragItem.current = index }}
              onDragEnter={() => { dragOverItem.current = index }}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className="flex items-center gap-3 px-3 py-2.5 bg-surface-1 border border-border rounded-lg hover:border-border-bright transition-colors cursor-grab active:cursor-grabbing group"
            >
              {/* Drag handle */}
              <span className="text-text-muted text-xs font-mono w-4 text-center select-none">
                {index + 1}
              </span>
              <div className="w-1 h-6 bg-status-ready/40 rounded-full" />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{prompt.title}</div>
                <div className="text-text-muted text-[10px] font-mono truncate mt-0.5">{prompt.body}</div>
              </div>

              {/* Execute */}
              <button
                onClick={() => handleExecute(prompt.id)}
                disabled={!selectedAgent || executing === prompt.id}
                className="hidden group-hover:flex items-center gap-1 px-3 py-1.5 text-[10px] font-mono font-semibold bg-accent/10 text-accent border border-accent/20 rounded hover:bg-accent/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {executing === prompt.id ? (
                  'Sending...'
                ) : (
                  <>
                    <span className="text-xs">▶</span> Execute
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
