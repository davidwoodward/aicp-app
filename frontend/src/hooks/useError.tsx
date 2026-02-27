import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

interface ErrorContextValue {
  error: string | null
  showError: (message: string) => void
  clearError: () => void
}

const ErrorContext = createContext<ErrorContextValue | null>(null)

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const showError = useCallback((message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setError(message)
  }, [])

  // Auto-dismiss: 4s after next user activity (mousemove/keydown/scroll)
  useEffect(() => {
    if (!error) return
    let started = false
    const start = () => {
      if (started) return
      started = true
      timerRef.current = setTimeout(() => {
        setError(null)
        timerRef.current = null
      }, 4000)
    }
    window.addEventListener('mousemove', start)
    window.addEventListener('keydown', start)
    window.addEventListener('scroll', start, true)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      window.removeEventListener('mousemove', start)
      window.removeEventListener('keydown', start)
      window.removeEventListener('scroll', start, true)
    }
  }, [error])

  return (
    <ErrorContext.Provider value={{ error, showError, clearError }}>
      {children}
    </ErrorContext.Provider>
  )
}

export function useError(): Pick<ErrorContextValue, 'showError' | 'clearError'> {
  const ctx = useContext(ErrorContext)
  if (!ctx) throw new Error('useError must be used within ErrorProvider')
  return { showError: ctx.showError, clearError: ctx.clearError }
}

// Internal: only for ErrorContainer
export function useErrorState(): ErrorContextValue {
  const ctx = useContext(ErrorContext)
  if (!ctx) throw new Error('useErrorState must be used within ErrorProvider')
  return ctx
}
