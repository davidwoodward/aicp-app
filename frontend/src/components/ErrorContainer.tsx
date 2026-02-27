import { useErrorState } from '../hooks/useError'

export default function ErrorContainer() {
  const { error, clearError } = useErrorState()

  if (!error) return null

  return (
    <div
      onClick={clearError}
      className="mx-4 mb-1 px-3 py-1.5 rounded text-xs font-mono cursor-pointer"
      style={{
        background: 'rgba(239, 68, 68, 0.06)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        color: 'var(--color-danger)',
      }}
    >
      {error}
    </div>
  )
}
