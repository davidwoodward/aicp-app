import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'

interface Props {
  onSend: (message: string) => void;
  onSlashExecute?: (command: string) => void;
  disabled?: boolean;
  onSlashTrigger?: (query: string) => void;
  onSlashDismiss?: () => void;
  slashActive?: boolean;
}

export interface ChatInputHandle {
  setValue: (value: string) => void;
}

const ChatInput = forwardRef<ChatInputHandle, Props>(function ChatInput(
  { onSend, onSlashExecute, disabled, onSlashTrigger, onSlashDismiss, slashActive },
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

    if (trimmed.startsWith('/')) {
      if (onSlashExecute) {
        onSlashExecute(trimmed)
        setValue('')
        onSlashDismiss?.()
      }
      return
    }

    onSend(trimmed)
    setValue('')
    textareaRef.current?.focus()
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value
    setValue(v)

    if (v.startsWith('/')) {
      onSlashTrigger?.(v)
    } else if (slashActive) {
      onSlashDismiss?.()
    }
  }

  return (
    <div className="border-t border-border bg-surface-1 p-3">
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-2 bg-surface-2 border border-border rounded-lg px-3 py-2 transition-colors">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="New prompt..."
            disabled={disabled}
            autoFocus
            rows={1}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none resize-none max-h-[200px] leading-relaxed disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
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
            {isSlash ? (
              <>Tab to autocomplete &middot; Esc to dismiss</>
            ) : (
              <>Enter to create prompt &middot; Shift+Enter for newline</>
            )}
          </span>
        </div>
      </div>
    </div>
  )
})

export default ChatInput
