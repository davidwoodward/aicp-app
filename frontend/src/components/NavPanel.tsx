import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { projects as projectsApi, prompts as promptsApi, snippets as snippetsApi, snippetCollections as collectionsApi } from '../api'
import type { Project, Prompt, Snippet, SnippetCollection, PromptMetrics, DayActivity } from '../api'
import { useTreeMetrics } from '../hooks/useTreeMetrics'
import DeleteProjectModal from './DeleteProjectModal'

interface Props {
  onProjectSelect: (projectId: string | null) => void
  activePromptId?: string | null
  onPromptSelect?: (promptId: string | null) => void
  activeSnippetId?: string | null
  onSnippetSelect?: (id: string | null) => void
  onOpenSnippetManager?: () => void
  promptRefreshKey?: number
  snippetRefreshKey?: number
}

const STATUS_COLOR: Record<string, string> = {
  draft:   'var(--color-status-draft)',
  ready:   'var(--color-status-ready)',
  sent:    'var(--color-status-sent)',
  done:    'var(--color-status-done)',
}

const HEAT_BORDER: Record<string, string> = {
  neutral: 'transparent',
  light: 'rgba(110, 231, 183, 0.25)',
  medium: 'rgba(110, 231, 183, 0.55)',
  strong: 'rgba(110, 231, 183, 0.90)',
}

const HEAT_BG: Record<string, string> = {
  neutral: 'transparent',
  light: 'rgba(110, 231, 183, 0.02)',
  medium: 'rgba(110, 231, 183, 0.05)',
  strong: 'rgba(110, 231, 183, 0.10)',
}

const HEAT_RANK: Record<string, number> = { neutral: 0, light: 1, medium: 2, strong: 3 }

function maxHeatLevel(metrics: PromptMetrics[]): string {
  let max = 'neutral'
  for (const m of metrics) {
    if ((HEAT_RANK[m.heatmap_level] ?? 0) > (HEAT_RANK[max] ?? 0)) max = m.heatmap_level
  }
  return max
}

function aggregateSparkline(timelines: Map<string, DayActivity[]>): number[] {
  const dayCounts = new Map<string, number>()
  for (const timeline of timelines.values()) {
    for (const d of timeline) {
      dayCounts.set(d.date, (dayCounts.get(d.date) ?? 0) + d.count)
    }
  }
  const sorted = Array.from(dayCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7)
    .map(([, count]) => count)
  // Pad to 7 entries
  while (sorted.length < 7) sorted.unshift(0)
  return sorted
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
  metricsMap: Map<string, PromptMetrics>
  activePromptId?: string | null
  onPromptSelect?: (promptId: string | null) => void
  onEnsureProjectSelected?: (id: string) => void
}

function PromptNode({ prompt, allPrompts, projectId, depth, onReorder, allProjectPrompts, metricsMap, activePromptId, onPromptSelect, onEnsureProjectSelected }: PromptNodeProps) {
  const [collapsed, setCollapsed] = useState(false)
  const dragOverRef = useRef(false)

  const children = allPrompts.filter(p => p.parent_prompt_id === prompt.id)
  const hasChildren = children.length > 0
  const metrics = metricsMap.get(prompt.id)
  const stale = metrics?.stale ?? false

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
        onClick={() => {
          const nextPromptId = activePromptId === prompt.id ? null : prompt.id
          if (nextPromptId) onEnsureProjectSelected?.(projectId)
          onPromptSelect?.(nextPromptId)
        }}
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
          style={{ fontSize: '11px', color: activePromptId === prompt.id ? 'var(--color-accent)' : 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', minWidth: 0 }}
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
              metricsMap={metricsMap}
              activePromptId={activePromptId}
              onPromptSelect={onPromptSelect}
              onEnsureProjectSelected={onEnsureProjectSelected}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectEntry({
  project,
  isExpanded,
  isActive,
  promptMap,
  onToggle,
  onSelect,
  onReorder,
  onDelete,
  activePromptId,
  onPromptSelect,
  onEnsureProjectSelected,
}: {
  project: Project
  isExpanded: boolean
  isActive: boolean
  promptMap: Map<string, Prompt[]>
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onReorder: (projectId: string, prompts: Prompt[]) => void
  onDelete: (project: Project) => void
  activePromptId?: string | null
  onPromptSelect?: (promptId: string | null) => void
  onEnsureProjectSelected?: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { metricsMap, timelineMap } = useTreeMetrics(isExpanded ? project.id : null)

  const projectPrompts = promptMap.get(project.id) ?? []
  const allMetrics = Array.from(metricsMap.values())
  const heat = maxHeatLevel(allMetrics)
  const sparkData = aggregateSparkline(timelineMap)
  const rootPrompts = projectPrompts.filter(p => !p.parent_prompt_id)

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen])

  return (
    <div>
      {/* Project row */}
      <div
        className="flex items-center gap-1.5 px-3 cursor-pointer group"
        style={{
          height: '30px',
          borderLeft: `3px solid ${HEAT_BORDER[heat] ?? 'transparent'}`,
          background: HEAT_BG[heat] ?? 'transparent',
          transition: 'border-color 0.2s, background 0.2s',
          position: 'relative',
        }}
        onClick={() => { onToggle(project.id); onSelect(project.id) }}
      >
        {/* Expand chevron */}
        <span
          style={{
            fontSize: '8px',
            color: 'var(--color-text-muted)',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
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
          {isExpanded ? '📂' : '📁'}
        </span>

        <span
          className="truncate group-hover:text-text-primary transition-colors flex-1"
          style={{
            fontSize: '12px',
            color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            fontFamily: 'var(--font-mono)',
            minWidth: 0,
          }}
        >
          {project.name}
        </span>

        {/* Sparkline — only shown when expanded and prompts loaded */}
        {isExpanded && projectPrompts.length > 0 && (
          <Sparkline data={sparkData} />
        )}

        {/* Three-dot menu button */}
        <span
          ref={menuRef as React.RefObject<HTMLSpanElement>}
          style={{ position: 'relative', flexShrink: 0 }}
        >
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
            className="group-hover:opacity-100 transition-opacity"
            style={{
              opacity: menuOpen ? 1 : 0,
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 2px',
              lineHeight: 1,
              fontFamily: 'var(--font-mono)',
            }}
            title="Project actions"
          >
            &#x22EF;
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div
              ref={menuRef}
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                zIndex: 40,
                minWidth: '140px',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border-bright)',
                borderRadius: '6px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                padding: '4px 0',
              }}
            >
              <button
                onClick={e => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onDelete(project)
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-danger)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                Delete Project
              </button>
            </div>
          )}
        </span>
      </div>

      {/* Prompt children */}
      {isExpanded && (
        <div className="tree-children" style={{ marginLeft: '16px', paddingLeft: '12px' }}>
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
                  onReorder={onReorder}
                  allProjectPrompts={projectPrompts}
                  metricsMap={metricsMap}
                  activePromptId={activePromptId}
                  onPromptSelect={onPromptSelect}
                  onEnsureProjectSelected={onEnsureProjectSelected}
                />
              ))
          )}
        </div>
      )}
    </div>
  )
}

export default function NavPanel({ onProjectSelect, activePromptId, onPromptSelect, activeSnippetId, onSnippetSelect, onOpenSnippetManager, promptRefreshKey, snippetRefreshKey }: Props) {
  const navigate = useNavigate()

  const [projectList, setProjectList] = useState<Project[]>([])
  const [promptMap, setPromptMap] = useState<Map<string, Prompt[]>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [activeProject, setActiveProject] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [snippetList, setSnippetList] = useState<Snippet[]>([])
  const [collectionList, setCollectionList] = useState<SnippetCollection[]>([])
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  useEffect(() => {
    projectsApi.list().then(setProjectList).catch(() => {})
    snippetsApi.list().then(setSnippetList).catch(() => {})
    collectionsApi.list().then(setCollectionList).catch(() => {})
  }, [])

  function loadPrompts(id: string) {
    if (!promptMap.has(id)) {
      promptsApi.list(id).then(ps => {
        setPromptMap(m => new Map(m).set(id, ps))
      }).catch(() => {})
    }
  }

  // Re-fetch prompts for expanded projects when prompted
  useEffect(() => {
    if (!promptRefreshKey) return
    expanded.forEach(id => {
      promptsApi.list(id).then(ps => {
        setPromptMap(m => new Map(m).set(id, ps))
      }).catch(() => {})
    })
  }, [promptRefreshKey])

  // Re-fetch snippets when prompted
  useEffect(() => {
    if (!snippetRefreshKey) return
    snippetsApi.list().then(setSnippetList).catch(() => {})
  }, [snippetRefreshKey])

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

  function ensureProjectSelected(id: string) {
    setActiveProject(id)
    onProjectSelect(id)
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

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    const deletedId = deleteTarget.id
    setDeleteTarget(null)

    // Remove from list
    setProjectList(prev => prev.filter(p => p.id !== deletedId))

    // If deleted project was active, select next or null
    if (activeProject === deletedId) {
      const remaining = projectList.filter(p => p.id !== deletedId)
      const next = remaining.length > 0 ? remaining[0].id : null
      setActiveProject(next)
      onProjectSelect(next)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-0">

      {/* ── PROJECTS section ─────────────────────── */}
      <SectionLabel>
        <span>Projects</span>
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
          projectList.map(project => (
            <ProjectEntry
              key={project.id}
              project={project}
              isExpanded={expanded.has(project.id)}
              isActive={activeProject === project.id}
              promptMap={promptMap}
              onToggle={toggleProject}
              onSelect={selectProject}
              onReorder={handleReorder}
              onDelete={setDeleteTarget}
              activePromptId={activePromptId}
              onPromptSelect={onPromptSelect}
              onEnsureProjectSelected={ensureProjectSelected}
            />
          ))
        )}

        {/* ── SNIPPETS section ─────────────────────── */}
        <SectionLabel>
          <span>Snippets</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onOpenSnippetManager?.()}
              className="text-text-muted hover:text-accent transition-colors"
              style={{ fontSize: '11px', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontFamily: 'var(--font-mono)' }}
              title="Manage snippets"
            >
              &#x22EF;
            </button>
            <button
              onClick={async () => {
                try {
                  const snippet = await snippetsApi.create({ name: '', content: '' })
                  setSnippetList(prev => [snippet, ...prev])
                  onSnippetSelect?.(snippet.id)
                } catch { /* ignore */ }
              }}
              className="text-text-muted hover:text-accent transition-colors"
              style={{ fontSize: '14px', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
              title="New snippet"
            >
              +
            </button>
          </div>
        </SectionLabel>

        {snippetList.length === 0 ? (
          <div className="px-3 py-2" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            No snippets yet
          </div>
        ) : (
          snippetList.map(snippet => (
            <div
              key={snippet.id}
              className="flex items-center gap-2 px-3 cursor-pointer group"
              style={{ height: '26px' }}
              onClick={() => onSnippetSelect?.(activeSnippetId === snippet.id ? null : snippet.id)}
            >
              <span style={{ fontSize: '10px', color: activeSnippetId === snippet.id ? 'var(--color-accent)' : 'var(--color-text-muted)', flexShrink: 0, transition: 'color 0.15s' }}>
                ◇
              </span>
              <span
                className="truncate group-hover:text-text-primary transition-colors"
                style={{ fontSize: '11px', color: activeSnippetId === snippet.id ? 'var(--color-accent)' : 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', flex: 1, minWidth: 0 }}
              >
                {snippet.name}
              </span>
            </div>
          ))
        )}

        {/* ── COLLECTIONS subsection ─────────────────────── */}
        {collectionList.length > 0 && (
          <>
            <SectionLabel>
              <span>Collections</span>
            </SectionLabel>
            {collectionList.map(col => {
              const isColExpanded = expandedCollections.has(col.id)
              const snippetMap = new Map(snippetList.map(s => [s.id, s]))
              return (
                <div key={col.id}>
                  <div
                    className="flex items-center gap-2 px-3 cursor-pointer group"
                    style={{ height: '26px' }}
                    onClick={() => setExpandedCollections(prev => {
                      const next = new Set(prev)
                      if (next.has(col.id)) next.delete(col.id)
                      else next.add(col.id)
                      return next
                    })}
                  >
                    <span
                      style={{
                        fontSize: '7px', color: 'var(--color-text-muted)',
                        transform: isColExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s ease',
                        display: 'inline-block', width: '8px', flexShrink: 0,
                      }}
                    >
                      ▶
                    </span>
                    <span
                      className="truncate group-hover:text-text-primary transition-colors"
                      style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', flex: 1, minWidth: 0 }}
                    >
                      {col.name}
                    </span>
                    <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                      {col.snippet_ids.length}
                    </span>
                  </div>
                  {isColExpanded && (
                    <div style={{ marginLeft: '20px', paddingLeft: '8px', borderLeft: '1px solid var(--color-border)' }}>
                      {col.snippet_ids.length === 0 ? (
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', padding: '2px 0' }}>
                          empty
                        </div>
                      ) : (
                        col.snippet_ids.map(sid => {
                          const s = snippetMap.get(sid)
                          if (!s) return null
                          return (
                            <div
                              key={sid}
                              className="flex items-center gap-2 cursor-pointer group"
                              style={{ height: '24px' }}
                              onClick={() => onSnippetSelect?.(activeSnippetId === sid ? null : sid)}
                            >
                              <span style={{ fontSize: '10px', color: activeSnippetId === sid ? 'var(--color-accent)' : 'var(--color-text-muted)', flexShrink: 0, transition: 'color 0.15s' }}>
                                ◇
                              </span>
                              <span
                                className="truncate group-hover:text-text-primary transition-colors"
                                style={{ fontSize: '10px', color: activeSnippetId === sid ? 'var(--color-accent)' : 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', flex: 1, minWidth: 0 }}
                              >
                                {s.name}
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteProjectModal
          projectId={deleteTarget.id}
          projectName={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
