import { useState, useEffect, useRef } from 'react'
import { snippets as snippetsApi, models as modelsApi, type Snippet, type ModelsResponse } from '../api'

interface Props {
  query: string;
  onInsertSnippet: (content: string) => void;
  onSelectModel: (provider: string, model: string) => void;
  onDismiss: () => void;
}

type View = 'commands' | 'snippet-list' | 'snippet-picker' | 'model-picker';

const COMMANDS = [
  { name: '/snippet', description: 'Insert a snippet into your message', action: 'snippet-picker' as View },
  { name: '/snippet list', description: 'View all saved snippets', action: 'snippet-list' as View },
  { name: '/model', description: 'Switch LLM provider/model', action: 'model-picker' as View },
]

export default function SlashCommandMenu({ query, onInsertSnippet, onSelectModel, onDismiss }: Props) {
  const [view, setView] = useState<View>('commands')
  const [snippetList, setSnippetList] = useState<Snippet[]>([])
  const [modelsData, setModelsData] = useState<ModelsResponse | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [page, setPage] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const PAGE_SIZE = 10

  // Filter commands by query
  const q = query.toLowerCase()
  const filteredCommands = COMMANDS.filter((c) => c.name.startsWith(q))

  // Determine if query directly matches a command
  useEffect(() => {
    if (q === '/snippet list') {
      setView('snippet-list')
      snippetsApi.list().then(setSnippetList).catch(() => {})
    } else if (q === '/snippet' || q === '/snippet ') {
      setView('snippet-picker')
      snippetsApi.list().then(setSnippetList).catch(() => {})
    } else if (q === '/model' || q === '/model ') {
      setView('model-picker')
      modelsApi.list().then(setModelsData).catch(() => {})
    } else {
      setView('commands')
    }
    setSelectedIdx(0)
    setPage(0)
  }, [q])

  // Keyboard nav
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onDismiss()
        return
      }
      if (view === 'commands') {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIdx((i) => Math.min(i + 1, filteredCommands.length - 1))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIdx((i) => Math.max(i - 1, 0))
        } else if (e.key === 'Enter' && filteredCommands[selectedIdx]) {
          e.preventDefault()
          setView(filteredCommands[selectedIdx].action)
          if (filteredCommands[selectedIdx].action === 'snippet-picker' || filteredCommands[selectedIdx].action === 'snippet-list') {
            snippetsApi.list().then(setSnippetList).catch(() => {})
          } else if (filteredCommands[selectedIdx].action === 'model-picker') {
            modelsApi.list().then(setModelsData).catch(() => {})
          }
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [view, selectedIdx, filteredCommands, onDismiss])

  // Click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onDismiss])

  const paginatedSnippets = snippetList.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(snippetList.length / PAGE_SIZE)

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 right-0 mb-1 max-w-3xl mx-auto bg-surface-1 border border-border rounded-lg shadow-lg overflow-hidden z-50"
    >
      {view === 'commands' && (
        <div className="py-1">
          {filteredCommands.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-muted">No matching commands</div>
          ) : (
            filteredCommands.map((cmd, i) => (
              <button
                key={cmd.name}
                onClick={() => {
                  setView(cmd.action)
                  if (cmd.action === 'snippet-picker' || cmd.action === 'snippet-list') {
                    snippetsApi.list().then(setSnippetList).catch(() => {})
                  } else if (cmd.action === 'model-picker') {
                    modelsApi.list().then(setModelsData).catch(() => {})
                  }
                }}
                className={`w-full text-left px-3 py-2 flex items-center gap-3 text-xs transition-colors ${
                  i === selectedIdx ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-surface-2'
                }`}
              >
                <span className="font-mono font-medium">{cmd.name}</span>
                <span className="text-text-muted">{cmd.description}</span>
              </button>
            ))
          )}
        </div>
      )}

      {view === 'snippet-list' && (
        <div className="p-3 max-h-64 overflow-y-auto">
          <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2">Snippets</div>
          {snippetList.length === 0 ? (
            <div className="text-xs text-text-muted py-2">No snippets saved yet.</div>
          ) : (
            <div className="space-y-1">
              {snippetList.map((s) => (
                <div key={s.id} className="px-2 py-1.5 bg-surface-2 rounded text-xs">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-text-muted font-mono truncate mt-0.5">{s.content}</div>
                </div>
              ))}
            </div>
          )}
          <button onClick={onDismiss} className="mt-2 text-[10px] font-mono text-text-muted hover:text-text-secondary">
            Close
          </button>
        </div>
      )}

      {view === 'snippet-picker' && (
        <div className="p-3 max-h-64 overflow-y-auto">
          <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2">
            Select a snippet to insert
          </div>
          {paginatedSnippets.length === 0 ? (
            <div className="text-xs text-text-muted py-2">No snippets saved yet.</div>
          ) : (
            <div className="space-y-1">
              {paginatedSnippets.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { onInsertSnippet(s.content); onDismiss() }}
                  className="w-full text-left px-2 py-1.5 bg-surface-2 rounded text-xs hover:bg-surface-3 transition-colors"
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-text-muted font-mono truncate mt-0.5">{s.content}</div>
                </button>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                disabled={page === 0}
                className="text-[10px] font-mono text-text-muted hover:text-text-secondary disabled:opacity-30"
              >
                Prev
              </button>
              <span className="text-[10px] font-mono text-text-muted">
                {page + 1}/{totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                disabled={page >= totalPages - 1}
                className="text-[10px] font-mono text-text-muted hover:text-text-secondary disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {view === 'model-picker' && modelsData && (
        <div className="p-3">
          <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2">
            Select provider
          </div>
          <div className="space-y-1">
            {modelsData.providers.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  if (p.configured) {
                    onSelectModel(p.name, p.model)
                    onDismiss()
                  }
                }}
                disabled={!p.configured}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                  p.configured
                    ? 'hover:bg-surface-2 text-text-primary'
                    : 'text-text-muted opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium capitalize">{p.name}</span>
                  <span className="font-mono text-text-secondary">{p.model}</span>
                  {!p.configured && (
                    <span className="text-[10px] text-text-muted">(not configured)</span>
                  )}
                  {p.name === modelsData.default_provider && p.configured && (
                    <span className="text-[10px] text-accent font-mono">default</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
