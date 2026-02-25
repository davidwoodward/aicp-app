import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { projects as projectsApi, prompts as promptsApi, conversations as convsApi } from '../api'
import type { Project, Prompt, Conversation } from '../api'

interface Props {
  onProjectSelect: (projectId: string | null) => void
}

const STATUS_COLOR: Record<string, string> = {
  draft:   'var(--color-status-draft)',
  ready:   'var(--color-status-ready)',
  sent:    'var(--color-status-sent)',
  done:    'var(--color-status-done)',
}

const HEAT_BORDER: Record<number, string> = {
  0: 'transparent',
  1: 'rgba(110, 231, 183, 0.25)',
  2: 'rgba(110, 231, 183, 0.55)',
  3: 'rgba(110, 231, 183, 0.90)',
}

const HEAT_BG: Record<number, string> = {
  0: 'transparent',
  1: 'rgba(110, 231, 183, 0.02)',
  2: 'rgba(110, 231, 183, 0.05)',
  3: 'rgba(110, 231, 183, 0.10)',
}

function getHeatLevel(executionCount: number): 0 | 1 | 2 | 3 {
  if (executionCount === 0) return 0
  if (executionCount <= 2) return 1
  if (executionCount <= 5) return 2
  return 3
}

function isStale(prompt: Prompt): boolean {
  if (prompt.status !== 'draft' && prompt.status !== 'ready') return false
  const anchor = prompt.done_at ?? prompt.sent_at ?? prompt.created_at
  if (!anchor) return false
  const age = Date.now() - new Date(anchor).getTime()
  return age > 7 * 24 * 60 * 60 * 1000
}

// Returns counts per day for the last 7 days (index 0 = oldest, 6 = today)
function getSparklineData(prompts: Prompt[]): number[] {
  const bins = new Array(7).fill(0)
  const now = Date.now()
  for (const p of prompts) {
    const dates = [p.done_at, p.sent_at, p.created_at].filter(Boolean) as string[]
    for (const d of dates) {
      const age = now - new Date(d).getTime()
      const dayIdx = Math.floor(age / (24 * 60 * 60 * 1000))
      if (dayIdx >= 0 && dayIdx < 7) {
        bins[6 - dayIdx]++
      }
    }
  }
  return bins
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  const W = 42
  const H = 14
  const barW = 5
  const gap = 1
  return (
    <svg width={W} height={H} style={{ flexShrink: 0, opacity: 0.7 }}>
      {data.map((v, i) => {
        const barH = Math.max(1, Math.round((v / max) * H))
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={H - barH}
            width={barW}
            height={barH}
            fill={v > 0 ? 'var(--color-accent)' : 'var(--color-border)'}
            rx={1}
          />
        )
      })}
    </svg>
  )
}

function StatusDot({ status }: { status: string }) {
  const isSent = status === 'sent'
  return (
    <span
      className={isSent ? 'status-pulse' : ''}
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: STATUS_COLOR[status] ?? 'var(--color-text-muted)',
        flexShrink: 0,
        color: STATUS_COLOR[status] ?? 'var(--color-text-muted)',
      }}
    />
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 pt-3 pb-1 flex items-center justify-between"
      style={{ fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}
    >
      {children}
    </div>
  )
}

interface PromptNodeProps {
  prompt: Prompt
  allPrompts: Prompt[]
  projectId: string
  depth: number
  onReorder: (projectId: string, prompts: Prompt[]) => void
  allProjectPrompts: Prompt[]
}

function PromptNode({ prompt, allPrompts, projectId, depth, onReorder, allProjectPrompts }: PromptNodeProps) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const dragOverRef = useRef(false)

  const children = allPrompts.filter(p => p.parent_prompt_id === prompt.id)
  const hasChildren = children.length > 0
  const stale = isStale(prompt)

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', prompt.id)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dragOverRef.current = true
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    dragOverRef.current = false
    const draggedId = e.dataTransfer.getData('text/plain')
    if (!draggedId || draggedId === prompt.id) return

    // Reorder at the flat project level (sibling swap)
    const flat = [...allProjectPrompts].sort((a, b) => a.order_index - b.order_index)
    const fromIdx = flat.findIndex(p => p.id === draggedId)
    const toIdx = flat.findIndex(p => p.id === prompt.id)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...flat]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    onReorder(projectId, reordered)
  }

  return (
    <div>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="flex items-center gap-2 cursor-pointer group"
        style={{ height: '26px', paddingLeft: `${depth * 12}px` }}
        onClick={() => navigate(`/projects/${projectId}/prompts`)}
      >
        {/* Collapse toggle for nodes with children */}
        {hasChildren ? (
          <span
            onClick={e => { e.stopPropagation(); setCollapsed(c => !c) }}
            style={{
              fontSize: '7px',
              color: 'var(--color-text-muted)',
              transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: 'transform 0.15s ease',
              display: 'inline-block',
              width: '8px',
              flexShrink: 0,
              cursor: 'pointer',
            }}
          >
            ▶
          </span>
        ) : (
          <span style={{ width: '8px', flexShrink: 0 }} />
        )}

        <StatusDot status={prompt.status} />

        <span
          className="truncate group-hover:text-text-primary transition-colors flex-1"
          style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', minWidth: 0 }}
        >
          {prompt.title}
        </span>

        {stale && (
          <span
            title="No activity in 7+ days"
            style={{ fontSize: '10px', flexShrink: 0, color: 'var(--color-status-offline)', lineHeight: 1 }}
          >
            ⚠
          </span>
        )}

        {/* Drag handle */}
        <span
          style={{ fontSize: '9px', color: 'var(--color-text-muted)', flexShrink: 0, cursor: 'grab', opacity: 0 }}
          className="group-hover:opacity-100 transition-opacity"
        >
          ⠿
        </span>
      </div>

      {hasChildren && !collapsed && (
        <div>
          {children.map(child => (
            <PromptNode
              key={child.id}
              prompt={child}
              allPrompts={allPrompts}
              projectId={projectId}
              depth={depth + 1}
              onReorder={onReorder}
              allProjectPrompts={allProjectPrompts}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function PlanTree({ onProjectSelect }: Props) {
  const navigate = useNavigate()
  const { conversationId } = useParams<{ conversationId: string }>()

  const [projectList, setProjectList] = useState<Project[]>([])
  const [promptMap, setPromptMap] = useState<Map<string, Prompt[]>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [convList, setConvList] = useState<Conversation[]>([])
  const [activeProject, setActiveProject] = useState<string | null>(null)

  useEffect(() => {
    projectsApi.list().then(setProjectList).catch(() => {})
    convsApi.list().then(setConvList).catch(() => {})
  }, [])

  function loadPrompts(id: string) {
    if (!promptMap.has(id)) {
      promptsApi.list(id).then(ps => {
        setPromptMap(m => new Map(m).set(id, ps))
      }).catch(() => {})
    }
  }

  function toggleProject(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        loadPrompts(id)
      }
      return next
    })
  }

  function selectProject(id: string) {
    const next = id === activeProject ? null : id
    setActiveProject(next)
    onProjectSelect(next)
  }

  async function handleReorder(projectId: string, reordered: Prompt[]) {
    setPromptMap(m => new Map(m).set(projectId, reordered))
    try {
      await promptsApi.reorder(projectId, reordered.map(p => p.id))
    } catch {
      // revert on failure
      loadPrompts(projectId)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-0">

      {/* ── PLAN section ─────────────────────────── */}
      <SectionLabel>
        <span>Plan</span>
        <button
          onClick={() => navigate('/projects')}
          className="text-text-muted hover:text-accent transition-colors"
          style={{ fontSize: '14px', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
          title="Manage projects"
        >
          +
        </button>
      </SectionLabel>

      <div className="flex-1 overflow-y-auto">
        {projectList.length === 0 ? (
          <div className="px-3 py-2" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            No projects yet
          </div>
        ) : (
          projectList.map(project => {
            const projectPrompts = promptMap.get(project.id) ?? []
            const executionCount = projectPrompts.filter(p => p.status === 'sent' || p.status === 'done').length
            const heat = getHeatLevel(executionCount)
            const sparkData = getSparklineData(projectPrompts)
            const rootPrompts = projectPrompts.filter(p => !p.parent_prompt_id)

            return (
              <div key={project.id}>
                {/* Project row */}
                <div
                  className="flex items-center gap-1.5 px-3 cursor-pointer group"
                  style={{
                    height: '30px',
                    borderLeft: `3px solid ${HEAT_BORDER[heat]}`,
                    background: HEAT_BG[heat],
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                  onClick={() => { toggleProject(project.id); selectProject(project.id) }}
                >
                  {/* Expand chevron */}
                  <span
                    style={{
                      fontSize: '8px',
                      color: 'var(--color-text-muted)',
                      transform: expanded.has(project.id) ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s ease',
                      display: 'inline-block',
                      width: '10px',
                      flexShrink: 0,
                    }}
                  >
                    ▶
                  </span>

                  {/* Folder icon */}
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                    {expanded.has(project.id) ? '📂' : '📁'}
                  </span>

                  <span
                    className="truncate group-hover:text-text-primary transition-colors flex-1"
                    style={{
                      fontSize: '12px',
                      color: activeProject === project.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      minWidth: 0,
                    }}
                  >
                    {project.name}
                  </span>

                  {/* Sparkline — only shown when expanded and prompts loaded */}
                  {expanded.has(project.id) && projectPrompts.length > 0 && (
                    <Sparkline data={sparkData} />
                  )}
                </div>

                {/* Prompt children */}
                {expanded.has(project.id) && (
                  <div className="tree-branch" style={{ marginLeft: '16px', paddingLeft: '12px' }}>
                    {rootPrompts.length === 0 ? (
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', padding: '4px 0' }}>
                        empty
                      </div>
                    ) : (
                      rootPrompts
                        .slice()
                        .sort((a, b) => a.order_index - b.order_index)
                        .map(prompt => (
                          <PromptNode
                            key={prompt.id}
                            prompt={prompt}
                            allPrompts={projectPrompts}
                            projectId={project.id}
                            depth={0}
                            onReorder={handleReorder}
                            allProjectPrompts={projectPrompts}
                          />
                        ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* ── CONVERSATIONS section ─────────────────────────── */}
        <SectionLabel>
          <span>Chats</span>
          <button
            onClick={() => navigate('/')}
            className="text-text-muted hover:text-accent transition-colors"
            style={{ fontSize: '14px', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
            title="New conversation"
          >
            +
          </button>
        </SectionLabel>

        {convList.length === 0 ? (
          <div className="px-3 py-2" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            No conversations
          </div>
        ) : (
          convList.slice(0, 20).map(conv => (
            <div
              key={conv.id}
              className="flex items-center gap-2 px-3 cursor-pointer group"
              style={{ height: '28px' }}
              onClick={() => navigate(`/c/${conv.id}`)}
            >
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                ◎
              </span>
              <span
                className="truncate group-hover:text-text-primary transition-colors"
                style={{
                  fontSize: '11px',
                  color: conversationId === conv.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {conv.title}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
