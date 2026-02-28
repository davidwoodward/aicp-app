import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function Login() {
  const { loginWithCredential } = useAuth()
  const buttonRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const handleCredentialResponse = useCallback(async (response: { credential: string }) => {
    setError(null)
    try {
      await loginWithCredential(response.credential)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }, [loginWithCredential])

  useEffect(() => {
    if (initialized.current || !GOOGLE_CLIENT_ID || !buttonRef.current) return

    function tryInit() {
      if (!window.google || !buttonRef.current) return false

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: true,
      })

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        shape: 'rectangular',
        text: 'signin_with',
        width: 280,
      })

      initialized.current = true
      return true
    }

    // GSI script loads async — poll until ready
    if (tryInit()) return

    const interval = setInterval(() => {
      if (tryInit()) clearInterval(interval)
    }, 100)

    return () => clearInterval(interval)
  }, [handleCredentialResponse])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-surface-0)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '32px',
          padding: '48px',
          borderRadius: '12px',
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          minWidth: '360px',
        }}
      >
        {/* Branding */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <img src="/aicp-icon.svg" alt="AICP" width="48" height="48" />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '20px',
              fontWeight: 800,
              letterSpacing: '0.15em',
              color: 'var(--color-accent)',
            }}
          >
            AICP
          </span>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              letterSpacing: '0.05em',
            }}
          >
            AI Coding Platform
          </span>
        </div>

        {/* Google Sign-In button rendered by GSI */}
        <div ref={buttonRef} />

        {/* Error display */}
        {error && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--color-danger)',
              textAlign: 'center',
              maxWidth: '280px',
              lineHeight: 1.5,
            }}
          >
            {error}
          </span>
        )}

        <span
          style={{
            fontSize: '10px',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            maxWidth: '240px',
            lineHeight: 1.5,
          }}
        >
          Access restricted to authorized accounts
        </span>
      </div>
    </div>
  )
}
