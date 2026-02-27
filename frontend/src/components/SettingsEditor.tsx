import { useState, useEffect, useRef, useCallback } from 'react'
import { settings as settingsApi } from '../api'
import type { RefineMode } from '../api'

const DEFAULT_REFINE_SYSTEM_PROMPT =
  'You are a prompt refinement assistant. Analyze the given prompt and return a well-structured, clearly-worded markdown version. Improve clarity, structure, and precision while preserving the original intent. Return ONLY the refined prompt in markdown format. No explanations, no preamble.'

interface Props {
  refineMode: RefineMode
  refineSystemPrompt: string
  onRefineSettingsChange: (settings: { mode: RefineMode; system_prompt: string }) => void
  onClose: () => void
}

export default function SettingsEditor({ refineMode, refineSystemPrompt, onRefineSettingsChange, onClose }: Props) {
  const [localPrompt, setLocalPrompt] = useState(refineSystemPrompt)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoad = useRef(true)

  // Sync when prop changes externally
  useEffect(() => {
    setLocalPrompt(refineSystemPrompt)
    initialLoad.current = true
    setTimeout(() => { initialLoad.current = false }, 50)
  }, [refineSystemPrompt])

  // Debounced save for system prompt
  const doSave = useCallback(async (prompt: string) => {
    setSaveStatus('saving')
    try {
      const result = await settingsApi.updateRefine({ system_prompt: prompt })
      onRefineSettingsChange(result)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('idle')
    }
  }, [onRefineSettingsChange])

  useEffect(() => {
    if (initialLoad.current) return
    if (localPrompt === refineSystemPrompt) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(localPrompt), 800)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [localPrompt, refineSystemPrompt, doSave])

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleModeToggle() {
    const next: RefineMode = refineMode === 'Manual' ? 'Auto' : 'Manual'
    setSaveStatus('saving')
    settingsApi.updateRefine({ mode: next })
      .then(result => {
        onRefineSettingsChange(result)
        setSaveStatus('saved')
      })
      .catch(() => setSaveStatus('idle'))
  }

  function handleResetPrompt() {
    setLocalPrompt(DEFAULT_REFINE_SYSTEM_PROMPT)
    // Save immediately on reset
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    settingsApi.updateRefine({ system_prompt: DEFAULT_REFINE_SYSTEM_PROMPT })
      .then(result => {
        onRefineSettingsChange(result)
        setSaveStatus('saved')
      })
      .catch(() => setSaveStatus('idle'))
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-surface-1)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{ height: '48px', borderBottom: '1px solid var(--color-border)' }}
      >
        <button
          onClick={onClose}
          style={{
            fontSize: '16px', color: 'var(--color-text-muted)', background: 'none',
            border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 2px',
            flexShrink: 0,
          }}
          title="Close settings (Esc)"
        >
          &#x2190;
        </button>

        <span
          style={{
            flex: 1, fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}
        >
          Settings
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

        {/* Section: REFINEMENT */}
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: 700,
              letterSpacing: '0.2em', color: 'var(--color-text-muted)', textTransform: 'uppercase',
              marginBottom: '12px',
            }}
          >
            Refinement
          </div>

          {/* Mode toggle */}
          <div
            className="flex items-center justify-between px-3 py-2.5 rounded"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
          >
            <div>
              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                Refine Mode
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                Manual requires clicking Refine; Auto refines on save
              </div>
            </div>
            <button
              onClick={handleModeToggle}
              className="hover:opacity-80 transition-opacity"
              style={{
                fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600,
                padding: '4px 12px', borderRadius: '4px',
                background: 'var(--color-surface-0)', color: 'var(--color-accent)',
                border: '1px solid var(--color-border)', cursor: 'pointer',
                flexShrink: 0, marginLeft: '12px',
              }}
            >
              {refineMode}
            </button>
          </div>

          {/* System prompt textarea */}
          <div style={{ marginTop: '12px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
              <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                Refinement System Prompt
              </label>
              <button
                onClick={handleResetPrompt}
                style={{
                  fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  textDecoration: 'underline', textUnderlineOffset: '2px',
                }}
              >
                Reset to default
              </button>
            </div>
            <textarea
              value={localPrompt}
              onChange={e => setLocalPrompt(e.target.value)}
              style={{
                width: '100%', minHeight: '160px', resize: 'vertical',
                fontSize: '12px', fontFamily: 'var(--font-mono)', lineHeight: 1.7,
                background: 'var(--color-surface-2)', color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)', borderRadius: '6px',
                padding: '12px 14px', outline: 'none', boxSizing: 'border-box',
                caretColor: 'var(--color-accent)',
              }}
              placeholder="System prompt for refinement..."
            />
          </div>
        </div>

      </div>
    </div>
  )
}
