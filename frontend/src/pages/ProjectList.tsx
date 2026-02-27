import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { projects, type Project } from '../api'
import DeleteProjectModal from '../components/DeleteProjectModal'

type ProjectFilter = 'active' | 'all' | 'archived'

export default function ProjectList() {
  const [list, setList] = useState<Project[]>([])
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<ProjectFilter>('active')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Project | null>(null)

  useEffect(() => {
    projects.list()
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Load archived when needed
  useEffect(() => {
    if (filter !== 'active') {
      projects.listDeleted()
        .then(setArchivedProjects)
        .catch(() => setArchivedProjects([]))
    }
  }, [filter])

  const displayProjects = filter === 'active'
    ? list
    : filter === 'archived'
      ? archivedProjects
      : [...list, ...archivedProjects]

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')

    const tempId = `temp-${crypto.randomUUID()}`
    const optimistic: Project = {
      id: tempId,
      name,
      description,
      created_at: new Date().toISOString(),
      deleted_at: null,
    }
    setList(prev => [optimistic, ...prev])
    setName('')
    setDescription('')
    setShowCreate(false)

    try {
      const saved = await projects.create({ name: optimistic.name, description: optimistic.description })
      setList(prev => prev.map(p => p.id === tempId ? saved : p))
    } catch (err: unknown) {
      setList(prev => prev.filter(p => p.id !== tempId))
      setError(err instanceof Error ? err.message : 'Failed to create')
      setName(optimistic.name)
      setDescription(optimistic.description)
      setShowCreate(true)
    } finally {
      setCreating(false)
    }
  }

  async function handleSoftDelete(id: string) {
    const target = list.find(p => p.id === id)
    if (!target) return
    setList(prev => prev.filter(p => p.id !== id))
    setConfirmDeleteId(null)
    try {
      await projects.delete(id)
      setArchivedProjects(prev => [{ ...target, deleted_at: new Date().toISOString() }, ...prev])
    } catch (err: unknown) {
      setList(prev => [...prev, target].sort((a, b) => b.created_at.localeCompare(a.created_at)))
      setError(err instanceof Error ? err.message : 'Failed to archive')
    }
  }

  async function handleRestore(id: string) {
    const target = archivedProjects.find(p => p.id === id)
    if (!target) return
    setArchivedProjects(prev => prev.filter(p => p.id !== id))
    try {
      const restored = await projects.restore(id)
      setList(prev => [restored, ...prev])
    } catch (err: unknown) {
      setArchivedProjects(prev => [target, ...prev])
      setError(err instanceof Error ? err.message : 'Failed to restore')
    }
  }

  async function handlePermanentDelete() {
    if (!permanentDeleteTarget) return
    const id = permanentDeleteTarget.id
    setArchivedProjects(prev => prev.filter(p => p.id !== id))
    setPermanentDeleteTarget(null)
    try {
      await projects.permanentDelete(id)
    } catch (err: unknown) {
      setArchivedProjects(prev => [permanentDeleteTarget, ...prev])
      setError(err instanceof Error ? err.message : 'Failed to permanently delete')
    }
  }

  if (loading) {
    return <div className="text-text-muted font-mono text-sm animate-pulse">Loading projects...</div>
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Projects</h1>
          <div className="flex items-center gap-0.5">
            {(['active', 'all', 'archived'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded transition-colors"
                style={{
                  background: filter === f ? 'rgba(110, 231, 183, 0.12)' : 'transparent',
                  color: filter === f ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  border: filter === f ? '1px solid rgba(110, 231, 183, 0.25)' : '1px solid transparent',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        {filter === 'active' && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 text-xs font-mono font-medium bg-accent/10 text-accent border border-accent/20 rounded hover:bg-accent/20 transition-colors"
          >
            {showCreate ? 'Cancel' : '+ New Project'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 text-xs font-mono bg-danger/10 text-danger border border-danger/20 rounded">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-4 p-4 bg-surface-1 border border-border rounded-lg space-y-3">
          <input
            type="text"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-surface-2 border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
            autoFocus
          />
          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-surface-2 border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
          />
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 text-xs font-mono font-semibold bg-accent text-surface-0 rounded hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      )}

      {/* Project list */}
      {displayProjects.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">
          {filter === 'active' ? 'No projects yet. Create one to get started.'
            : filter === 'archived' ? 'No archived projects.'
            : 'No projects yet.'}
        </div>
      ) : (
        <div className="bg-surface-1 border border-border rounded-lg divide-y divide-border">
          {displayProjects.map((p) => {
            const isArchived = !!p.deleted_at
            return (
              <div
                key={p.id}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                style={{ opacity: isArchived ? 0.8 : 1 }}
              >
                {/* Name + description */}
                <Link
                  to={isArchived ? '#' : `/projects/${p.id}/prompts`}
                  className="flex-1 min-w-0"
                  onClick={isArchived ? (e) => e.preventDefault() : undefined}
                >
                  <div className="text-sm font-medium truncate group-hover:text-accent transition-colors">{p.name}</div>
                  {p.description && (
                    <div className="text-text-secondary text-xs mt-0.5 truncate">{p.description}</div>
                  )}
                </Link>

                {/* Date */}
                <div className="text-text-muted text-[10px] font-mono shrink-0">
                  {new Date(p.created_at).toLocaleDateString()}
                </div>

                {/* Actions */}
                {isArchived ? (
                  <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                    {/* Restore */}
                    <button
                      onClick={() => handleRestore(p.id)}
                      className="p-1 rounded hover:bg-accent/15 transition-colors"
                      title="Restore"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </svg>
                    </button>
                    {/* Permanent delete */}
                    <button
                      onClick={() => setPermanentDeleteTarget(p)}
                      className="p-1 rounded hover:bg-danger/15 transition-colors"
                      title="Permanently delete"
                    >

                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                    {confirmDeleteId === p.id ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded" style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-danger)' }}>Archive?</span>
                        <button
                          onClick={() => handleSoftDelete(p.id)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors"
                          style={{ background: 'rgba(239, 68, 68, 0.8)', color: '#fff' }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono text-text-muted hover:text-text-primary transition-colors"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="p-1 rounded hover:bg-danger/15 transition-colors"
                        title="Archive"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Permanent delete confirmation modal */}
      {permanentDeleteTarget && (
        <DeleteProjectModal
          projectId={permanentDeleteTarget.id}
          projectName={permanentDeleteTarget.name}
          onConfirm={handlePermanentDelete}
          onCancel={() => setPermanentDeleteTarget(null)}
          permanent
        />
      )}
    </div>
  )
}
