import { useState, useEffect } from 'react'
import { projects as projectsApi } from '../api'
import type { ProjectStats } from '../api'

interface Props {
  projectId: string
  projectName: string
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteProjectModal({ projectId, projectName, onConfirm, onCancel }: Props) {
  const [confirmText, setConfirmText] = useState('')
  const [stats, setStats] = useState<ProjectStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const nameMatches = confirmText === projectName

  useEffect(() => {
    projectsApi.stats(projectId)
      .then(setStats)
      .catch(() => setStats({ prompts: 0, sessions: 0 }))
      .finally(() => setLoading(false))
  }, [projectId])

  async function handleDelete() {
    setDeleting(true)
    try {
      await projectsApi.delete(projectId)
      onConfirm()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(4, 5, 8, 0.85)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="w-full overflow-hidden flex flex-col"
        style={{
          maxWidth: '440px',
          background: 'var(--color-surface-1)',
          border: '1px solid rgba(239, 68, 68, 0.30)',
          borderRadius: '10px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <span style={{
            fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'rgba(239, 68, 68, 0.8)',
          }}>
            Delete Project
          </span>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-4">
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
            You are about to delete{' '}
            <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{projectName}</span>
          </div>

          {/* Stats */}
          {loading ? (
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
              Loading project data...
            </div>
          ) : stats && (stats.prompts > 0 || stats.sessions > 0) ? (
            <div
              className="rounded px-3 py-2"
              style={{
                fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)',
                background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)',
                lineHeight: 1.6,
              }}
            >
              This will remove:{' '}
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{stats.prompts}</span> prompt{stats.prompts !== 1 ? 's' : ''},{' '}
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{stats.sessions}</span> session{stats.sessions !== 1 ? 's' : ''}
            </div>
          ) : null}

          {/* Confirmation input */}
          <div>
            <label
              style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}
            >
              Type <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{projectName}</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              autoFocus
              spellCheck={false}
              placeholder={projectName}
              style={{
                width: '100%',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                padding: '6px 10px',
                borderRadius: '4px',
                border: `1px solid ${nameMatches ? 'rgba(239, 68, 68, 0.5)' : 'var(--color-border)'}`,
                background: 'var(--color-surface-2)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && nameMatches && !deleting) handleDelete()
                if (e.key === 'Escape') onCancel()
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-4 py-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button
            onClick={onCancel}
            disabled={deleting}
            style={{
              fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '5px 16px',
              borderRadius: '4px', background: 'transparent', color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!nameMatches || deleting}
            style={{
              fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '5px 16px',
              borderRadius: '4px',
              background: nameMatches && !deleting ? 'rgba(239, 68, 68, 0.8)' : 'var(--color-surface-2)',
              color: nameMatches && !deleting ? '#fff' : 'var(--color-text-muted)',
              border: 'none',
              cursor: nameMatches && !deleting ? 'pointer' : 'default',
              fontWeight: 600,
              opacity: nameMatches ? 1 : 0.5,
              transition: 'background 0.15s, opacity 0.15s',
            }}
          >
            {deleting ? 'Deleting...' : 'Delete Project'}
          </button>
        </div>
      </div>
    </div>
  )
}
