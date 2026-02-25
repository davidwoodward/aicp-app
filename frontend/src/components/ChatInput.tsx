import { useState, useRef, useEffect } from 'react'

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  provider: string;
  model: string;
  planningMode?: boolean;
  onSlashTrigger?: (query: string) => void;
  onSlashDismiss?: () => void;
  slashActive?: boolean;
}

export default function ChatInput({ onSend, disabled, provider, model, planningMode, onSlashTrigger, onSlashDismiss, slashActive }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [value])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape' && slashActive) {
      onSlashDismiss?.()
    }
  }

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return

    // Don't send slash commands to LLM
    if (trimmed.startsWith('/')) return

    onSend(trimmed)
    setValue('')
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value
    setValue(v)

    // Detect slash commands
    if (v.startsWith('/')) {
      onSlashTrigger?.(v)
    } else if (slashActive) {
      onSlashDismiss?.()
    }
  }

  return (
    <div className="border-t border-border bg-surface-1 p-3">
      <div className="max-w-3xl mx-auto">
        <div
          className="relative flex items-end gap-2 bg-surface-2 border rounded-lg px-3 py-2 transition-colors"
          style={{
            borderColor: planningMode
              ? 'rgba(110, 231, 183, 0.35)'
              : 'var(--color-border)',
          }}
        >
          {/* Planning mode badge inside input */}
          {planningMode && (
            <span
              className="shrink-0 self-center"
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                color: 'var(--color-accent)',
                padding: '1px 6px',
                border: '1px solid rgba(110, 231, 183, 0.4)',
                borderRadius: '3px',
                background: 'rgba(110, 231, 183, 0.08)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Plan
            </span>
          )}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={planningMode ? 'Describe an action to plan…' : 'Message AICP...'}
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none resize-none max-h-[200px] leading-relaxed disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={disabled || !value.trim() || value.trim().startsWith('/')}
            className="shrink-0 p-1.5 rounded-md bg-accent text-surface-0 hover:bg-accent/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <span className="text-[10px] font-mono text-text-muted">
            {planningMode ? (
              <>control-plane LLM &middot; actions require confirmation</>
            ) : (
              <>{provider}/{model.split('/').pop()} &middot; Shift+Enter for newline</>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
