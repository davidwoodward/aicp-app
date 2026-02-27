import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'

interface Props {
  onOpenProfile: () => void
  onOpenModels: () => void
}

export default function AvatarDropdown({ onOpenProfile, onOpenModels }: Props) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (!user) return null

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
          padding: 0,
          cursor: 'pointer',
          background: 'var(--color-surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        title={user.email}
      >
        {user.picture ? (
          <img
            src={user.picture}
            alt=""
            width="22"
            height="22"
            style={{ display: 'block', borderRadius: '50%' }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
            {user.name?.charAt(0)?.toUpperCase() || '?'}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '6px',
            minWidth: '160px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          {/* User info */}
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--color-border)',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.email}
          </div>

          <button
            onClick={() => { setOpen(false); onOpenProfile() }}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-primary)',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            Profile
          </button>

          <button
            onClick={() => { setOpen(false); onOpenModels() }}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-primary)',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            Models
          </button>

          <div style={{ borderTop: '1px solid var(--color-border)' }} />

          <button
            onClick={() => { setOpen(false); logout() }}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-muted)',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
