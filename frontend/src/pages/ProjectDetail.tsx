import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useParams, useNavigate, Navigate } from 'react-router-dom'
import { projects, prompts as promptsApi, type Project, type Prompt } from '../api'
import PromptTree from './PromptTree'
import TaskList from './TaskList'
import PromptHistory from './PromptHistory'
import ActivityTab from '../components/ActivityTab'
import DeleteProjectModal from '../components/DeleteProjectModal'

const tabs = [
  { path: 'prompts', label: 'Prompts' },
  { path: 'tasks', label: 'Task List' },
  { path: 'history', label: 'History' },
  { path: 'activity', label: 'Activity' },
]

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [promptList, setPromptList] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

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
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">{project.name}</h1>
          <p className="text-text-secondary text-xs mt-0.5">{project.description}</p>
        </div>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="p-1.5 rounded border border-transparent hover:border-danger/20 hover:bg-danger/10 transition-colors shrink-0"
          title="Delete project"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      {showDeleteModal && (
        <DeleteProjectModal
          projectId={projectId!}
          projectName={project.name}
          onConfirm={() => {
            setShowDeleteModal(false)
            navigate('/projects')
          }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

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
