import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useParams, Navigate } from 'react-router-dom'
import { projects, prompts, type Project, type Prompt } from '../api'
import PromptTree from './PromptTree'
import TaskList from './TaskList'
import PromptHistory from './PromptHistory'

const tabs = [
  { path: 'prompts', label: 'Prompts' },
  { path: 'tasks', label: 'Task List' },
  { path: 'history', label: 'History' },
]

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [promptList, setPromptList] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)

  async function reload() {
    if (!projectId) return
    const p = await projects.get(projectId)
    setProject(p)
    const prList = await prompts.list(projectId).catch(() => [])
    setPromptList(prList)
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [projectId])

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
            to={tab.path}
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
        <Route path="prompts" element={<PromptTree projectId={projectId!} prompts={promptList} onUpdate={reload} />} />
        <Route path="tasks" element={<TaskList projectId={projectId!} prompts={promptList} onUpdate={reload} />} />
        <Route path="history" element={<PromptHistory projectId={projectId!} prompts={promptList} />} />
      </Routes>
    </div>
  )
}
