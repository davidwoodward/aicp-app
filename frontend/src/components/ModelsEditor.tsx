import { useState, useEffect, useRef, useCallback } from 'react'
import { userSettings } from '../api'
import type { UserModelsConfig } from '../api'

interface Props {
  onClose: () => void
}

type ProviderKey = 'gemini_api_key' | 'openai_api_key' | 'anthropic_api_key'

const PROVIDERS: { key: ProviderKey; label: string; name: string }[] = [
  { key: 'gemini_api_key', label: 'GEMINI', name: 'Google Gemini' },
  { key: 'openai_api_key', label: 'OPENAI', name: 'OpenAI' },
  { key: 'anthropic_api_key', label: 'ANTHROPIC', name: 'Anthropic' },
]

export default function ModelsEditor({ onClose }: Props) {
  const [maskedKeys, setMaskedKeys] = useState<UserModelsConfig | null>(null)
  const [localKeys, setLocalKeys] = useState<Record<ProviderKey, string>>({
    gemini_api_key: '',
    openai_api_key: '',
    anthropic_api_key: '',
  })
  const [revealed, setRevealed] = useState<Record<ProviderKey, boolean>>({
    gemini_api_key: false,
    openai_api_key: false,
    anthropic_api_key: false,
  })
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoad = useRef(true)
  const pendingKeys = useRef<Partial<Record<ProviderKey, string>>>({})

  // Load current config on mount
  useEffect(() => {
    userSettings.getModels().then(config => {
      setMaskedKeys(config)
      initialLoad.current = true
      setTimeout(() => { initialLoad.current = false }, 50)
    }).catch(() => {})
  }, [])

  // Debounced save — only sends keys that were actually edited
  const doSave = useCallback(async () => {
    const toSave = { ...pendingKeys.current }
    pendingKeys.current = {}
    if (Object.keys(toSave).length === 0) return

    setSaveStatus('saving')
    try {
      const result = await userSettings.updateModels(toSave)
      setMaskedKeys(result)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('idle')
    }
  }, [])

  const scheduleAutoSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(), 800)
  }, [doSave])

  function handleKeyChange(key: ProviderKey, value: string) {
    setLocalKeys(prev => ({ ...prev, [key]: value }))
    pendingKeys.current[key] = value
    if (!initialLoad.current) {
      scheduleAutoSave()
    }
  }

  // Save on close
  const handleClose = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      doSave()
    }
    onClose()
  }, [onClose, doSave])

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleClose])

  function isConfigured(key: ProviderKey): boolean {
    // If user typed something in this session, show as configured
    if (localKeys[key]) return true
    // Otherwise check masked value from server
    return !!maskedKeys?.[key]
  }

  function displayValue(key: ProviderKey): string {
    if (localKeys[key]) return localKeys[key]
    return ''
  }

  function placeholder(key: ProviderKey): string {
    if (maskedKeys?.[key]) return maskedKeys[key]!
    return 'Enter API key...'
  }

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
          Models
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
        {PROVIDERS.map(({ key, label, name }) => (
          <div key={key}>
            <div
              style={{
                fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: 700,
                letterSpacing: '0.2em', color: 'var(--color-text-muted)', textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              {label}
            </div>

            <div
              className="px-3 py-2.5 rounded"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  {name} API Key
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: isConfigured(key) ? 'var(--color-success, #22c55e)' : 'var(--color-text-muted)',
                    fontWeight: 500,
                  }}
                >
                  {isConfigured(key) ? 'Configured' : 'Not set'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type={revealed[key] ? 'text' : 'password'}
                  value={displayValue(key)}
                  onChange={e => handleKeyChange(key, e.target.value)}
                  placeholder={placeholder(key)}
                  style={{
                    flex: 1,
                    fontSize: '12px', fontFamily: 'var(--font-mono)',
                    background: 'var(--color-surface-0)', color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)', borderRadius: '4px',
                    padding: '6px 10px', outline: 'none', boxSizing: 'border-box',
                    caretColor: 'var(--color-accent)',
                  }}
                />
                <button
                  onClick={() => setRevealed(prev => ({ ...prev, [key]: !prev[key] }))}
                  style={{
                    fontSize: '10px', fontFamily: 'var(--font-mono)',
                    color: 'var(--color-accent)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px 8px', flexShrink: 0,
                    textDecoration: 'underline', textUnderlineOffset: '2px',
                  }}
                >
                  {revealed[key] ? 'Hide' : 'Reveal'}
                </button>
              </div>
            </div>
          </div>
        ))}

        <div
          style={{
            fontSize: '10px', fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-muted)', lineHeight: 1.6,
            padding: '8px 0',
          }}
        >
          Your API keys override the server-level defaults. Keys are stored securely in Firestore.
        </div>
      </div>
    </div>
  )
}
