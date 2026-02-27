import { useState, useEffect, useRef } from 'react'
import { models as modelsApi, projects as projectsApi } from '../api'
import type { Project, Prompt, ActivityLog, RefineMode } from '../api'
import HistoryPanel from './HistoryPanel'

interface Props {
  provider: string
  model: string
  onModelChange: (provider: string, model: string) => void
  selectedProject: string | null
  refineMode: RefineMode
  onRefineModeToggle: () => void
  historyProjectId?: string | null
  historyEntityId?: string
  historyRefreshKey?: number
  currentPrompt?: Prompt | null
  onHistoryView?: (log: ActivityLog) => void
  onHistoryRestore?: (prompt: Prompt) => void
  onHistoryDismiss?: () => void
}

interface ConnectedAgent {
  agent_id: string
  project_id: string
  connected_at: number
}

function Chip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="flex items-center justify-between px-2 py-1 rounded"
      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
    >
      <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-text-muted)', flexShrink: 0 }}>
        {label}
      </span>
      <span
        className="truncate"
        style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: accent ? 'var(--color-accent)' : 'var(--color-text-secondary)', minWidth: 0, textAlign: 'right' }}
      >
        {value}
      </span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 pt-3 pb-1"
      style={{ fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}
    >
      {children}
    </div>
  )
}

export default function TelemetryPanel({ provider, model, onModelChange, selectedProject, refineMode, onRefineModeToggle, historyProjectId, historyEntityId, historyRefreshKey, currentPrompt, onHistoryView, onHistoryRestore, onHistoryDismiss }: Props) {
  const [agents, setAgents] = useState<ConnectedAgent[]>([])
  const [projectName, setProjectName] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Resolve project name from ID
  useEffect(() => {
    if (!selectedProject) { setProjectName(null); return }
    projectsApi.list().then((ps: Project[]) => {
      const p = ps.find(x => x.id === selectedProject)
      setProjectName(p?.name ?? null)
    }).catch(() => {})
  }, [selectedProject])

  // WebSocket connection for agent visibility
  useEffect(() => {
    if (!selectedProject) {
      setAgents([])
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = import.meta.env.DEV ? 'localhost:8080' : window.location.host
    const ws = new WebSocket(`${protocol}//${host}/ws/telemetry?project_id=${encodeURIComponent(selectedProject)}`)
    wsRef.current = ws

    ws.onclose = () => setAgents([])

    function processEvent(event: { type: string; [key: string]: unknown }) {
      switch (event.type) {
        case 'snapshot': {
          const data = event.data as { connected_agents?: ConnectedAgent[] }
          setAgents(data.connected_agents ?? [])
          break
        }
        case 'agent_connected':
          setAgents(prev => [
            ...prev.filter(a => a.agent_id !== (event.agent as ConnectedAgent).agent_id),
            event.agent as ConnectedAgent,
          ])
          break
        case 'agent_disconnected':
          setAgents(prev => prev.filter(a => a.agent_id !== event.agent_id))
          break
        case 'batch': {
          const events = (event as unknown as { events: Array<{ type: string; [key: string]: unknown }> }).events
          if (Array.isArray(events)) {
            for (const e of events) processEvent(e)
          }
          break
        }
      }
    }

    ws.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data as string) as { type: string; [key: string]: unknown }
        processEvent(parsed)
      } catch { /* skip malformed */ }
    }

    return () => { ws.close(); wsRef.current = null }
  }, [selectedProject])

  // Cycle through configured models
  function cycleModel() {
    modelsApi.list().then(data => {
      const configured = data.providers.filter(p => p.configured)
      if (configured.length === 0) return
      const idx = configured.findIndex(p => p.name === provider)
      const next = configured[(idx + 1) % configured.length]
      onModelChange(next.name, next.model)
    }).catch(() => {})
  }

  const modelShort = model.split('/').pop() ?? model

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-0">

      {/* ── CONTEXT ──────────────────────────────────── */}
      <SectionLabel>Context</SectionLabel>

      <div className="px-2 space-y-1.5 pb-2">
        <Chip label="Project" value={projectName ?? '—'} accent={!!projectName} />
        <div
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={cycleModel}
          title="Click to cycle model"
        >
          <Chip label="Model" value={`${provider}/${modelShort}`} accent />
        </div>
        <div
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={onRefineModeToggle}
          title="Click to toggle refine mode"
        >
          <Chip label="Refine" value={refineMode} accent />
        </div>
        <Chip label="Agent" value={agents.length > 0 ? agents[0].agent_id.slice(0, 12) : 'Not Connected'} accent={agents.length > 0} />
      </div>

      {/* Divider */}
      <div className="mx-2 border-t border-border" />

      {/* ── HISTORY (replaces Agents when open) or AGENTS ── */}
      {historyProjectId && onHistoryView && onHistoryRestore && onHistoryDismiss ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <HistoryPanel
            key={historyRefreshKey}
            projectId={historyProjectId}
            entityId={historyEntityId}
            currentPrompt={currentPrompt}
            onView={onHistoryView}
            onRestore={onHistoryRestore}
            onDismiss={onHistoryDismiss}
          />
        </div>
      ) : (
        <>
          <SectionLabel>Agents</SectionLabel>

          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {agents.length === 0 ? (
              <div className="py-2" style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                None connected
              </div>
            ) : (
              agents.map(agent => (
                <div
                  key={agent.agent_id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded"
                  style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
                >
                  <span
                    style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: 'var(--color-accent)',
                      flexShrink: 0,
                      display: 'inline-block',
                    }}
                  />
                  <span className="flex-1 truncate" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                    {agent.agent_id.slice(0, 16)}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
