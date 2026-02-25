import { useState, useEffect, useRef } from 'react'
import { models as modelsApi, projects as projectsApi } from '../api'
import type { Project } from '../api'

interface Props {
  provider: string
  model: string
  onModelChange: (provider: string, model: string) => void
  selectedProject: string | null
}

interface AgentTelemetry {
  agent_id: string
  project_id: string
  status: 'idle' | 'busy' | 'offline'
  connected_at: number
}

interface ExecutionTelemetry {
  execution_id: string
  agent_id: string
  prompt_id: string
  session_id: string
  model?: string
  provider?: string
  started_at: number
  ended_at?: number
  duration_ms?: number
  token_usage?: { input_tokens?: number; output_tokens?: number }
}

interface TelemetrySnapshot {
  connected_agents: AgentTelemetry[]
  active_executions: ExecutionTelemetry[]
  completed_count: number
  timestamp: number
}

const AGENT_STATUS_COLOR: Record<string, string> = {
  idle:    'var(--color-status-idle)',
  busy:    'var(--color-status-busy)',
  offline: 'var(--color-status-offline)',
}

function Chip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="flex items-center justify-between px-2 py-1 rounded"
      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
    >
      <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <span
        className="truncate ml-2"
        style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: accent ? 'var(--color-accent)' : 'var(--color-text-secondary)', maxWidth: '120px', textAlign: 'right' }}
      >
        {value}
      </span>
    </div>
  )
}

function MetricBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span style={{ fontSize: '18px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginTop: '2px' }}>
        {label}
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

export default function TelemetryPanel({ provider, model, onModelChange, selectedProject }: Props) {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot>({
    connected_agents: [],
    active_executions: [],
    completed_count: 0,
    timestamp: Date.now(),
  })
  const [connected, setConnected] = useState(false)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [totalTokens, setTotalTokens] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)

  // Resolve project name from ID
  useEffect(() => {
    if (!selectedProject) { setProjectName(null); return }
    projectsApi.list().then((ps: Project[]) => {
      const p = ps.find(x => x.id === selectedProject)
      setProjectName(p?.name ?? null)
    }).catch(() => {})
  }, [selectedProject])

  // WebSocket telemetry connection — reconnects when selectedProject changes
  useEffect(() => {
    // tenant_id is required by the backend — don't connect without a project
    if (!selectedProject) {
      setConnected(false)
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = import.meta.env.DEV ? 'localhost:8080' : window.location.host
    const ws = new WebSocket(`${protocol}//${host}/ws/telemetry?tenant_id=${encodeURIComponent(selectedProject)}`)
    wsRef.current = ws

    // Reset state on reconnect (server sends fresh snapshot)
    setTotalTokens(0)

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)

    function processEvent(event: { type: string; [key: string]: unknown }) {
      switch (event.type) {
        case 'snapshot':
          setSnapshot(event.data as TelemetrySnapshot)
          break
        case 'agent_connected':
          setSnapshot(s => ({
            ...s,
            connected_agents: [...s.connected_agents.filter(a => a.agent_id !== (event.agent as AgentTelemetry).agent_id), event.agent as AgentTelemetry],
          }))
          break
        case 'agent_disconnected':
          setSnapshot(s => ({ ...s, connected_agents: s.connected_agents.filter(a => a.agent_id !== event.agent_id) }))
          break
        case 'agent_status':
          setSnapshot(s => ({
            ...s,
            connected_agents: s.connected_agents.map(a =>
              a.agent_id === event.agent_id ? { ...a, status: event.status as AgentTelemetry['status'] } : a
            ),
          }))
          break
        case 'execution_started':
          setSnapshot(s => ({
            ...s,
            active_executions: [...s.active_executions, event.execution as ExecutionTelemetry],
          }))
          break
        case 'execution_completed': {
          const exec = event.execution as ExecutionTelemetry
          const usage = exec.token_usage
          if (usage) {
            setTotalTokens(t => t + (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0))
          }
          setSnapshot(s => ({
            ...s,
            active_executions: s.active_executions.filter(e => e.execution_id !== exec.execution_id),
            completed_count: s.completed_count + 1,
          }))
          break
        }
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
        const event = JSON.parse(ev.data as string) as { type: string; [key: string]: unknown }
        processEvent(event)
      } catch { /* skip malformed */ }
    }

    return () => { ws.close(); wsRef.current = null }
  }, [selectedProject])

  // Attempt model selection when model chip clicked
  function cycleModel() {
    modelsApi.list().then(data => {
      const configured = data.providers.filter(p => p.configured)
      if (configured.length === 0) return
      const idx = configured.findIndex(p => p.name === provider)
      const next = configured[(idx + 1) % configured.length]
      onModelChange(next.name, next.model)
    }).catch(() => {})
  }

  const activeAgent = snapshot.connected_agents.find(a => a.status === 'busy')
  const modelShort = model.split('/').pop() ?? model

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-0 scan-surface">

      {/* ── CONTEXT ──────────────────────────────────── */}
      <SectionLabel>Context</SectionLabel>

      <div className="px-2 space-y-1.5 pb-2">
        <Chip label="Project" value={projectName ?? '—'} accent={!!projectName} />
        <Chip label="Branch" value={snapshot.connected_agents.find(a => a.status === 'busy')?.project_id ? 'main' : '—'} />
        <div
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={cycleModel}
          title="Click to cycle model"
        >
          <Chip label="Model" value={`${provider}/${modelShort}`} accent />
        </div>
        <Chip label="Agent" value={activeAgent ? activeAgent.agent_id.slice(0, 12) : '—'} accent={!!activeAgent} />
      </div>

      {/* Divider */}
      <div className="mx-2 border-t border-border" />

      {/* ── TELEMETRY ─────────────────────────────────── */}
      <SectionLabel>
        <span className="flex items-center gap-1.5">
          Telemetry
          <span
            style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: connected ? 'var(--color-accent)' : 'var(--color-status-offline)',
              display: 'inline-block',
            }}
            title={connected ? 'Live' : 'Disconnected'}
          />
        </span>
      </SectionLabel>

      {/* Metric grid */}
      <div
        className="mx-2 mb-3 p-2 rounded"
        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}
      >
        <MetricBlock label="Agents" value={snapshot.connected_agents.length} />
        <MetricBlock label="Active" value={snapshot.active_executions.length} />
        <MetricBlock label="Done" value={snapshot.completed_count} />
        <MetricBlock label="Tokens" value={totalTokens > 999 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens} />
      </div>

      {/* Divider */}
      <div className="mx-2 border-t border-border" />

      {/* ── AGENTS ─────────────────────────────────── */}
      <SectionLabel>Agents</SectionLabel>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {snapshot.connected_agents.length === 0 ? (
          <div className="py-2" style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            none connected
          </div>
        ) : (
          snapshot.connected_agents.map(agent => (
            <div
              key={agent.agent_id}
              className="flex items-center gap-2 px-2 py-1.5 rounded"
              style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}
            >
              <span
                className={agent.status === 'busy' ? 'status-pulse' : ''}
                style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: AGENT_STATUS_COLOR[agent.status],
                  flexShrink: 0,
                  color: AGENT_STATUS_COLOR[agent.status],
                  display: 'inline-block',
                }}
              />
              <span className="flex-1 truncate" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                {agent.agent_id.slice(0, 16)}
              </span>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: AGENT_STATUS_COLOR[agent.status] }}>
                {agent.status}
              </span>
            </div>
          ))
        )}
      </div>

      {/* ── ACTIVE EXECUTIONS ─────────────────────── */}
      {snapshot.active_executions.length > 0 && (
        <>
          <div className="mx-2 border-t border-border" />
          <SectionLabel>Executing</SectionLabel>
          <div className="px-2 pb-2 space-y-1">
            {snapshot.active_executions.map(exec => (
              <div
                key={exec.execution_id}
                className="px-2 py-1.5 rounded"
                style={{ background: 'rgba(110, 231, 183, 0.05)', border: '1px solid rgba(110, 231, 183, 0.2)' }}
              >
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                  {exec.agent_id === 'chat' ? 'chat' : exec.agent_id.slice(0, 12)}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {exec.model ?? exec.provider ?? '—'} · {Math.round((Date.now() - exec.started_at) / 1000)}s
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
