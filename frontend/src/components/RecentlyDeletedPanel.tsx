import { useState, useEffect } from 'react'
import { projects as projectsApi } from '../api'
import type { Project } from '../api'

interface Props {
  onClose: () => void
  onRestore: () => void
}

export default function RecentlyDeletedPanel({ onClose, onRestore }: Props) {
  const [deletedProjects, setDeletedProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    projectsApi.listDeleted()
      .then(setDeletedProjects)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleRestore(id: string) {
    setRestoringId(id)
    try {
      await projectsApi.restore(id)
      setDeletedProjects(prev => prev.filter(p => p.id !== id))
      onRestore()
    } catch {
      // stay in list on failure
    } finally {
      setRestoringId(null)
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(4, 5, 8, 0.85)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full overflow-hidden flex flex-col"
        style={{
          maxWidth: '480px',
          maxHeight: '480px',
          background: 'var(--color-surface-1)',
          border: '1px solid rgba(110, 231, 183, 0.20)',
          borderRadius: '10px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <span style={{
            fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}>
            Recently Deleted
          </span>
          <button
            onClick={onClose}
            style={{
              fontSize: '14px', color: 'var(--color-text-muted)', background: 'none',
              border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0,
            }}
          >
            &#x2715;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', padding: '8px 0' }}>
              Loading...
            </div>
          ) : deletedProjects.length === 0 ? (
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', padding: '8px 0' }}>
              No deleted projects
            </div>
          ) : (
            <div className="space-y-2">
              {deletedProjects.map(project => (
                <div
                  key={project.id}
                  className="flex items-center gap-3 rounded px-3 py-2"
                  style={{
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className="truncate"
                      style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}
                    >
                      {project.name}
                    </div>
                    {project.deleted_at && (
                      <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Deleted {formatDate(project.deleted_at)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRestore(project.id)}
                    disabled={restoringId === project.id}
                    style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      padding: '4px 12px',
                      borderRadius: '4px',
                      background: restoringId === project.id ? 'var(--color-surface-3)' : 'var(--color-accent)',
                      color: restoringId === project.id ? 'var(--color-text-muted)' : 'var(--color-surface-0)',
                      border: 'none',
                      cursor: restoringId === project.id ? 'default' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {restoringId === project.id ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
