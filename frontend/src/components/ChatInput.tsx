import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  provider: string;
  model: string;
  planningMode?: boolean;
  onSlashTrigger?: (query: string) => void;
  onSlashDismiss?: () => void;
  slashActive?: boolean;
  commandValidation?: { valid: boolean; error?: string; domain?: string; action?: string; args?: Record<string, string>; flags?: Record<string, string> };
}

export interface ChatInputHandle {
  setValue: (value: string) => void;
}

const ChatInput = forwardRef<ChatInputHandle, Props>(function ChatInput(
  { onSend, disabled, provider, model, planningMode, onSlashTrigger, onSlashDismiss, slashActive, commandValidation },
  ref,
) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(ref, () => ({
    setValue: (v: string) => {
      setValue(v)
      if (v.startsWith('/')) onSlashTrigger?.(v)
      setTimeout(() => textareaRef.current?.focus(), 0)
    },
  }), [onSlashTrigger])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [value])

  const isSlash = value.trim().startsWith('/')

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

  // Compute border color based on state
  const borderColor = planningMode
    ? 'rgba(110, 231, 183, 0.35)'
    : isSlash && commandValidation?.valid
      ? 'rgba(110, 231, 183, 0.4)'
      : isSlash && commandValidation?.error
        ? 'rgba(239, 68, 68, 0.35)'
        : 'var(--color-border)'

  return (
    <div className="border-t border-border bg-surface-1 p-3">
      <div className="max-w-3xl mx-auto">
        {/* Parsed command preview bar */}
        {isSlash && commandValidation && (commandValidation.valid || commandValidation.error) && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 mb-1.5 rounded-md"
            style={{
              background: commandValidation.valid
                ? 'rgba(110, 231, 183, 0.06)'
                : 'rgba(239, 68, 68, 0.06)',
              border: `1px solid ${commandValidation.valid
                ? 'rgba(110, 231, 183, 0.2)'
                : 'rgba(239, 68, 68, 0.2)'}`,
            }}
          >
            <span style={{
              fontSize: '10px',
              color: commandValidation.valid ? 'var(--color-accent)' : 'var(--color-danger)',
            }}>
              {commandValidation.valid ? '\u2713' : '\u2717'}
            </span>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: commandValidation.valid ? 'var(--color-accent)' : 'var(--color-danger)',
              opacity: 0.85,
            }}>
              {commandValidation.valid
                ? formatPreview(commandValidation)
                : commandValidation.error}
            </span>
          </div>
        )}

        <div
          className="relative flex items-end gap-2 bg-surface-2 border rounded-lg px-3 py-2 transition-colors"
          style={{ borderColor }}
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
            placeholder={planningMode ? 'Describe an action to plan\u2026' : 'Message AICP...'}
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
            ) : isSlash ? (
              <>Tab to autocomplete &middot; Esc to dismiss</>
            ) : (
              <>{provider}/{model.split('/').pop()} &middot; Shift+Enter for newline</>
            )}
          </span>
        </div>
      </div>
    </div>
  )
})

export default ChatInput

function formatPreview(v: { domain?: string; action?: string; args?: Record<string, string>; flags?: Record<string, string> }): string {
  const parts: string[] = []
  if (v.domain) parts.push(`/${v.domain}`)
  if (v.action && v.action !== v.domain) parts.push(v.action)
  if (v.args) {
    for (const [, val] of Object.entries(v.args)) parts.push(val)
  }
  if (v.flags) {
    for (const [key, val] of Object.entries(v.flags)) parts.push(`--${key}=${val}`)
  }
  return parts.join(' ') || 'Ready to execute'
}
