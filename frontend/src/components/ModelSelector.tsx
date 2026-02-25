import { useState, useEffect, useRef } from 'react'
import { models as modelsApi, type ModelsResponse } from '../api'

interface Props {
  provider: string;
  model: string;
  onModelChange: (provider: string, model: string) => void;
}

export default function ModelSelector({ provider, model, onModelChange }: Props) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<ModelsResponse | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && !data) {
      modelsApi.list().then(setData).catch(() => {})
    }
  }, [open, data])

  // Click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
      >
        <span className="capitalize">{provider}</span>
        <span className="text-text-muted">/</span>
        <span>{model.split('/').pop()}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && data && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-surface-1 border border-border rounded-lg shadow-lg z-50 py-1">
          {data.providers.map((p) => (
            <button
              key={p.name}
              onClick={() => {
                if (p.configured) {
                  onModelChange(p.name, p.model)
                  setOpen(false)
                }
              }}
              disabled={!p.configured}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                p.name === provider
                  ? 'bg-accent/10 text-accent'
                  : p.configured
                    ? 'text-text-primary hover:bg-surface-2'
                    : 'text-text-muted opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">{p.name}</span>
                {!p.configured && <span className="text-[10px]">(not configured)</span>}
              </div>
              <div className="font-mono text-text-muted text-[10px] mt-0.5">{p.model}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
