import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { projects, type Project } from '../api'

export default function ProjectList() {
  const [list, setList] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    projects.list()
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      const p = await projects.create({ name, description })
      setList((prev) => [p, ...prev])
      setName('')
      setDescription('')
      setShowCreate(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <div className="text-text-muted font-mono text-sm animate-pulse">Loading projects...</div>
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">Projects</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 text-xs font-mono font-medium bg-accent/10 text-accent border border-accent/20 rounded hover:bg-accent/20 transition-colors"
        >
          {showCreate ? 'Cancel' : '+ New Project'}
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 text-xs font-mono bg-danger/10 text-danger border border-danger/20 rounded">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-surface-1 border border-border rounded-lg space-y-3">
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

      {/* Project grid */}
      {list.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">
          No projects yet. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}/prompts`}
              className="group block p-4 bg-surface-1 border border-border rounded-lg hover:border-accent/30 hover:bg-surface-2 transition-all"
            >
              <div className="font-medium text-sm group-hover:text-accent transition-colors">{p.name}</div>
              <div className="text-text-secondary text-xs mt-1 line-clamp-2">{p.description}</div>
              <div className="text-text-muted text-[10px] font-mono mt-3">
                {new Date(p.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
