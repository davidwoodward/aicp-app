import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useParams, Navigate } from 'react-router-dom'
import { projects, prompts as promptsApi, type Project, type Prompt } from '../api'
import PromptTree from './PromptTree'
import TaskList from './TaskList'
import PromptHistory from './PromptHistory'
import ActivityTab from '../components/ActivityTab'

const tabs = [
  { path: 'prompts', label: 'Prompts' },
  { path: 'tasks', label: 'Task List' },
  { path: 'history', label: 'History' },
  { path: 'activity', label: 'Activity' },
]

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [promptList, setPromptList] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)

  // Initial load only — children never trigger this
  useEffect(() => {
    if (!projectId) return
    Promise.all([
      projects.get(projectId),
      promptsApi.list(projectId).catch(() => []),
    ]).then(([p, prList]) => {
      setProject(p)
      setPromptList(prList)
    }).finally(() => setLoading(false))
  }, [projectId])

  // Full reload — only used by ActivityTab after a restore (infrequent, user-initiated)
  async function reloadAfterRestore() {
    if (!projectId) return
    const [p, prList] = await Promise.all([
      projects.get(projectId),
      promptsApi.list(projectId).catch(() => []),
    ])
    setProject(p)
    setPromptList(prList)
  }

  if (loading) {
    return <div className="text-text-muted font-mono text-sm animate-pulse">Loading...</div>
  }

  if (!project) {
    return <div className="text-danger font-mono text-sm">Project not found</div>
  }

  return (
    <div>
      {/* Project header */}
      <div className="mb-5">
        <h1 className="text-lg font-semibold">{project.name}</h1>
        <p className="text-text-secondary text-xs mt-0.5">{project.description}</p>
      </div>

      {/* Tab nav */}
      <nav className="flex gap-0 border-b border-border mb-5">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={`/projects/${projectId}/${tab.path}`}
            className={({ isActive }) =>
              `px-4 py-2 text-xs font-mono font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {/* Tab content */}
      <Routes>
        <Route index element={<Navigate to="prompts" replace />} />
        <Route path="prompts" element={<PromptTree projectId={projectId!} prompts={promptList} setPrompts={setPromptList} />} />
        <Route path="tasks" element={<TaskList projectId={projectId!} prompts={promptList} setPrompts={setPromptList} />} />
        <Route path="history" element={<PromptHistory projectId={projectId!} prompts={promptList} />} />
        <Route path="activity" element={<ActivityTab entityType="project" projectId={projectId!} onRestored={reloadAfterRestore} />} />
      </Routes>
    </div>
  )
}
