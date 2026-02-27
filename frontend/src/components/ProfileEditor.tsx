import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { userSettings } from '../api'

interface Props {
  onClose: () => void
}

export default function ProfileEditor({ onClose }: Props) {
  const { user } = useAuth()
  const [localName, setLocalName] = useState(user?.name || '')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoad = useRef(true)

  // Sync on mount
  useEffect(() => {
    setLocalName(user?.name || '')
    initialLoad.current = true
    setTimeout(() => { initialLoad.current = false }, 50)
  }, [user?.name])

  // Debounced save
  const doSave = useCallback(async (name: string) => {
    setSaveStatus('saving')
    try {
      await userSettings.updateProfile({ name })
      setSaveStatus('saved')
    } catch {
      setSaveStatus('idle')
    }
  }, [])

  useEffect(() => {
    if (initialLoad.current) return
    if (localName === user?.name) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(localName), 800)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [localName, user?.name, doSave])

  // Save on close
  const handleClose = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      if (localName !== user?.name) {
        doSave(localName)
      }
    }
    onClose()
  }, [onClose, localName, user?.name, doSave])

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleClose])

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-surface-1)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{ height: '48px', borderBottom: '1px solid var(--color-border)' }}
      >
        <button
          onClick={handleClose}
          style={{
            fontSize: '16px', color: 'var(--color-text-muted)', background: 'none',
            border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 2px',
            flexShrink: 0,
          }}
          title="Close (Esc)"
        >
          &#x2190;
        </button>

        <span
          style={{
            flex: 1, fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}
        >
          Profile
        </span>

        <span
          style={{
            fontSize: '10px', fontFamily: 'var(--font-mono)',
            color: saveStatus === 'saving' ? 'var(--color-accent)' : 'var(--color-text-muted)',
            flexShrink: 0, transition: 'color 0.2s',
          }}
        >
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Section: ACCOUNT */}
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: 700,
              letterSpacing: '0.2em', color: 'var(--color-text-muted)', textTransform: 'uppercase',
              marginBottom: '12px',
            }}
          >
            Account
          </div>

          {/* Avatar display */}
          {user?.picture && (
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={user.picture}
                alt=""
                width="48"
                height="48"
                style={{ borderRadius: '50%', border: '1px solid var(--color-border)' }}
                referrerPolicy="no-referrer"
              />
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                Google profile photo
              </div>
            </div>
          )}

          {/* Email (read-only) */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Email
            </label>
            <div
              style={{
                fontSize: '12px', fontFamily: 'var(--font-mono)',
                background: 'var(--color-surface-2)', color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border)', borderRadius: '6px',
                padding: '8px 12px',
              }}
            >
              {user?.email}
            </div>
          </div>

          {/* Name (editable) */}
          <div>
            <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Display Name
            </label>
            <input
              type="text"
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              style={{
                width: '100%',
                fontSize: '12px', fontFamily: 'var(--font-mono)',
                background: 'var(--color-surface-2)', color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)', borderRadius: '6px',
                padding: '8px 12px', outline: 'none', boxSizing: 'border-box',
                caretColor: 'var(--color-accent)',
              }}
              placeholder="Your name"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
