import { useState, useEffect, useRef } from 'react'
import { snippets as snippetsApi, models as modelsApi, type Snippet, type ModelsResponse } from '../api'

interface Props {
  query: string;
  currentProvider: string;
  currentModel: string;
  onConfirmSnippets: (snippets: Snippet[]) => void;
  onSelectModel: (provider: string, model: string) => void;
  onDismiss: () => void;
}

type View = 'commands' | 'snippet-list' | 'snippet-show' | 'snippet-select' | 'model-list';

const COMMANDS = [
  { name: '/snippet list',   description: 'Browse and select snippets',       action: 'snippet-list'   as View },
  { name: '/snippet show',   description: 'Browse snippets with full preview', action: 'snippet-show'   as View },
  { name: '/snippet select', description: 'Select a snippet by ID',            action: 'snippet-select' as View },
  { name: '/model list',     description: 'Show configured execution LLMs',    action: 'model-list'     as View },
  { name: '/model use',      description: 'Switch execution LLM',              action: 'model-list'     as View },
]

const PAGE_SIZE = 10

// ── sub-components ────────────────────────────────────────────────────────────

function SnippetChip({ snippet, onRemove }: { snippet: Snippet; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
      style={{
        background: 'rgba(110, 231, 183, 0.1)',
        border: '1px solid rgba(110, 231, 183, 0.35)',
        fontSize: '10px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-accent)',
        whiteSpace: 'nowrap',
      }}
    >
      <span className="max-w-[100px] truncate">{snippet.name}</span>
      <button
        onClick={onRemove}
        style={{ opacity: 0.6, lineHeight: 1, cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', padding: 0 }}
        className="hover:opacity-100 transition-opacity"
      >
        ×
      </button>
    </span>
  )
}

function ChipBar({
  selected,
  onRemove,
  onClear,
  onConfirm,
}: {
  selected: Snippet[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onConfirm: () => void;
}) {
  if (selected.length === 0) return null
  return (
    <div
      className="flex items-center gap-1.5 flex-wrap px-3 py-2"
      style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
    >
      <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-text-muted)', flexShrink: 0 }}>
        Selected
      </span>
      {selected.map(s => (
        <SnippetChip key={s.id} snippet={s} onRemove={() => onRemove(s.id)} />
      ))}
      <button
        onClick={onClear}
        style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', cursor: 'pointer', background: 'none', border: 'none', marginLeft: '2px' }}
        className="hover:text-text-secondary transition-colors"
      >
        clear
      </button>
      <button
        onClick={onConfirm}
        className="ml-auto"
        style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 10px', borderRadius: '4px', background: 'var(--color-accent)', color: 'var(--color-surface-0)', border: 'none', cursor: 'pointer', fontWeight: 600 }}
      >
        Use {selected.length}
      </button>
    </div>
  )
}

function Pagination({
  page, total, pageSize, onPrev, onNext,
}: {
  page: number; total: number; pageSize: number; onPrev: () => void; onNext: () => void;
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between px-3 py-1.5" style={{ borderTop: '1px solid var(--color-border)' }}>
      <button onClick={onPrev} disabled={page === 0}
        style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        className="hover:text-text-secondary transition-colors disabled:opacity-30 disabled:cursor-default">
        ← prev
      </button>
      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
        {page + 1} / {totalPages}
      </span>
      <button onClick={onNext} disabled={page >= totalPages - 1}
        style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        className="hover:text-text-secondary transition-colors disabled:opacity-30 disabled:cursor-default">
        next →
      </button>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function SlashCommandMenu({
  query,
  currentProvider,
  currentModel,
  onConfirmSnippets,
  onSelectModel,
  onDismiss,
}: Props) {
  const [view, setView] = useState<View>('commands')
  const [snippetList, setSnippetList] = useState<Snippet[]>([])
  const [modelsData, setModelsData] = useState<ModelsResponse | null>(null)
  const [selected, setSelected] = useState<Snippet[]>([])
  const [page, setPage] = useState(0)
  const [cmdIdx, setCmdIdx] = useState(0)
  const [selectError, setSelectError] = useState<string | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const q = query.toLowerCase().trim()
  const filteredCommands = COMMANDS.filter(c => c.name.startsWith(q))

  // ── routing ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setModelError(null)

    if (q === '/snippet list') {
      setView('snippet-list')
      snippetsApi.list().then(setSnippetList).catch(() => {})

    } else if (q === '/snippet show') {
      setView('snippet-show')
      snippetsApi.list().then(setSnippetList).catch(() => {})

    } else if (q === '/snippet select') {
      setView('snippet-select')
      setSelectError(null)
      // No ID provided — show the select view with a prompt
      if (snippetList.length === 0) {
        snippetsApi.list().then(setSnippetList).catch(() => {})
      }

    } else if (q.startsWith('/snippet select ') && q.length > '/snippet select '.length) {
      const id = query.slice('/snippet select '.length).trim()
      setView('snippet-select')
      setSelectError(null)
      snippetsApi.get(id)
        .then(s => setSelected(prev => prev.some(x => x.id === s.id) ? prev : [...prev, s]))
        .catch(() => setSelectError(`Snippet "${id}" not found`))

    } else if (q === '/model list' || q.startsWith('/model use')) {
      setView('model-list')
      modelsApi.list().then(setModelsData).catch(() => {})

      // Direct-apply: /model use <provider>:<model>
      if (q.startsWith('/model use ')) {
        const spec = q.slice('/model use '.length).trim()
        const colonIdx = spec.indexOf(':')
        if (colonIdx > 0) {
          const prov = spec.slice(0, colonIdx)
          const mdl = spec.slice(colonIdx + 1)
          if (prov && mdl) {
            modelsApi.list().then(data => {
              const info = data.providers.find(p => p.name === prov)
              if (!info) {
                setModelError(`Unknown provider: ${prov}`)
              } else if (!info.configured) {
                setModelError(`${prov} is not configured`)
              } else {
                onSelectModel(prov, mdl)
                onDismiss()
              }
            }).catch(() => {})
          }
        }
      }

    } else {
      setView('commands')
    }

    setCmdIdx(0)
    setPage(0)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── keyboard nav ───────────────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onDismiss(); return }

      if (view === 'commands') {
        if (e.key === 'ArrowDown') { e.preventDefault(); setCmdIdx(i => Math.min(i + 1, filteredCommands.length - 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCmdIdx(i => Math.max(i - 1, 0)) }
        else if (e.key === 'Enter' && filteredCommands[cmdIdx]) {
          e.preventDefault()
          const cmd = filteredCommands[cmdIdx]
          setView(cmd.action)
          if (cmd.action === 'snippet-list' || cmd.action === 'snippet-show') {
            snippetsApi.list().then(setSnippetList).catch(() => {})
          } else if (cmd.action === 'model-list') {
            modelsApi.list().then(setModelsData).catch(() => {})
          }
        }
      } else if (view === 'snippet-list' || view === 'snippet-show') {
        if (e.key === 'Enter' && selected.length > 0) {
          e.preventDefault()
          onConfirmSnippets(selected)
          onDismiss()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [view, cmdIdx, filteredCommands, selected, onConfirmSnippets, onDismiss])

  // ── click outside ──────────────────────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onDismiss()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onDismiss])

  // ── snippet helpers ────────────────────────────────────────────────────────
  function toggleSnippet(s: Snippet) {
    setSelected(prev => prev.some(x => x.id === s.id) ? prev.filter(x => x.id !== s.id) : [...prev, s])
  }
  function isSelected(id: string) { return selected.some(s => s.id === id) }
  function handleConfirm() { onConfirmSnippets(selected); onDismiss() }

  const paged = snippetList.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 right-0 mb-1 max-w-3xl mx-auto overflow-hidden z-50"
      style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
      }}
    >

      {/* ── COMMANDS ── */}
      {view === 'commands' && (
        <div className="py-1">
          {filteredCommands.length === 0 ? (
            <div className="px-3 py-2" style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              No matching commands
            </div>
          ) : (
            filteredCommands.map((cmd, i) => (
              <button
                key={cmd.name}
                onClick={() => {
                  setView(cmd.action)
                  if (cmd.action === 'snippet-list' || cmd.action === 'snippet-show') {
                    snippetsApi.list().then(setSnippetList).catch(() => {})
                  } else if (cmd.action === 'model-list') {
                    modelsApi.list().then(setModelsData).catch(() => {})
                  }
                }}
                className="w-full text-left flex items-center gap-3 px-3 py-2 transition-colors"
                style={{
                  background: i === cmdIdx ? 'rgba(110, 231, 183, 0.08)' : 'transparent',
                  borderLeft: i === cmdIdx ? '2px solid var(--color-accent)' : '2px solid transparent',
                }}
              >
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: i === cmdIdx ? 'var(--color-accent)' : 'var(--color-text-primary)', fontWeight: 500 }}>
                  {cmd.name}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {cmd.description}
                </span>
              </button>
            ))
          )}

          {/* Selected snippet chips carry over to commands view */}
          {selected.length > 0 && (
            <div className="px-3 py-1.5" style={{ borderTop: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  Selected
                </span>
                {selected.map(s => (
                  <SnippetChip key={s.id} snippet={s} onRemove={() => toggleSnippet(s)} />
                ))}
                <button
                  onClick={handleConfirm}
                  className="ml-auto"
                  style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: '4px', background: 'var(--color-accent)', color: 'var(--color-surface-0)', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  Use {selected.length}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SNIPPET LIST / SHOW ── */}
      {(view === 'snippet-list' || view === 'snippet-show') && (
        <div>
          <ChipBar
            selected={selected}
            onRemove={id => setSelected(prev => prev.filter(s => s.id !== id))}
            onClear={() => setSelected([])}
            onConfirm={handleConfirm}
          />
          <div className="px-3 py-1.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
              {view === 'snippet-list' ? 'Snippets' : 'Snippets — full preview'}
            </span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
              {snippetList.length} total
            </span>
          </div>
          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {snippetList.length === 0 ? (
              <div className="px-3 py-4" style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                No snippets saved yet.
              </div>
            ) : (
              paged.map(s => {
                const active = isSelected(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSnippet(s)}
                    className="w-full text-left px-3 py-2 transition-colors"
                    style={{
                      background: active ? 'rgba(110, 231, 183, 0.08)' : 'transparent',
                      borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{
                        width: '14px', height: '14px', borderRadius: '3px',
                        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        background: active ? 'rgba(110, 231, 183, 0.2)' : 'transparent',
                        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '9px', color: 'var(--color-accent)', transition: 'all 0.1s',
                      }}>
                        {active ? '✓' : ''}
                      </span>
                      <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: active ? 'var(--color-accent)' : 'var(--color-text-primary)', fontWeight: 500, flex: 1, minWidth: 0 }} className="truncate">
                        {s.name}
                      </span>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                        {s.id.slice(0, 8)}
                      </span>
                    </div>
                    {view === 'snippet-show' ? (
                      <pre style={{ marginTop: '6px', marginLeft: '22px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '6px 8px', lineHeight: 1.5, maxHeight: '80px', overflowY: 'auto' }}>
                        {s.content}
                      </pre>
                    ) : (
                      <div style={{ marginTop: '2px', marginLeft: '22px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }} className="truncate">
                        {s.content}
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
          <Pagination
            page={page} total={snippetList.length} pageSize={PAGE_SIZE}
            onPrev={() => setPage(p => Math.max(p - 1, 0))}
            onNext={() => setPage(p => p + 1)}
          />
          {selected.length === 0 && (
            <div className="px-3 py-1.5">
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                Click rows to select · Enter to confirm
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── SNIPPET SELECT <id> ── */}
      {view === 'snippet-select' && (
        <div className="p-3">
          <div style={{ fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
            Select by ID
          </div>
          {selectError ? (
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-status-offline)', padding: '6px 0' }}>
              {selectError}
            </div>
          ) : selected.length > 0 ? (
            <>
              <ChipBar
                selected={selected}
                onRemove={id => setSelected(prev => prev.filter(s => s.id !== id))}
                onClear={() => setSelected([])}
                onConfirm={handleConfirm}
              />
              <div className="mt-2">
                {selected.map(s => (
                  <div key={s.id} className="px-2 py-2 rounded" style={{ background: 'rgba(110, 231, 183, 0.06)', border: '1px solid rgba(110, 231, 183, 0.25)' }}>
                    <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)', fontWeight: 500 }}>{s.name}</div>
                    <pre style={{ marginTop: '4px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                      {s.content}
                    </pre>
                  </div>
                ))}
              </div>
            </>
          ) : snippetList.length > 0 ? (
            /* Bare /snippet select — show browsable list for ID picking */
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {snippetList.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelected(prev => [...prev, s])}
                  className="w-full text-left px-2 py-1.5 transition-colors hover:bg-surface-2 rounded"
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                >
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{s.name}</span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', marginLeft: '8px' }}>{s.id.slice(0, 8)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>Loading…</div>
          )}
        </div>
      )}

      {/* ── MODEL LIST ── */}
      {view === 'model-list' && (
        <div>
          <div
            className="px-3 py-1.5 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
              Execution LLM
            </span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
              not control-plane
            </span>
          </div>

          {modelError && (
            <div className="px-3 py-2" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-status-offline)', borderBottom: '1px solid var(--color-border)' }}>
              {modelError}
            </div>
          )}

          {!modelsData ? (
            <div className="px-3 py-3" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
              Loading…
            </div>
          ) : (
            <div>
              {modelsData.providers.map(p => {
                const isActive = p.name === currentProvider
                return (
                  <button
                    key={p.name}
                    onClick={() => {
                      if (!p.configured) return
                      onSelectModel(p.name, p.model)
                      onDismiss()
                    }}
                    disabled={!p.configured}
                    className="w-full text-left px-3 py-2.5 transition-colors"
                    style={{
                      background: isActive ? 'rgba(110, 231, 183, 0.08)' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
                      borderBottom: '1px solid var(--color-border)',
                      cursor: p.configured ? 'pointer' : 'default',
                      opacity: p.configured ? 1 : 0.45,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {/* Active checkmark */}
                      <span style={{ width: '14px', flexShrink: 0, fontSize: '10px', color: 'var(--color-accent)', textAlign: 'center' }}>
                        {isActive ? '✓' : ''}
                      </span>

                      {/* Provider name */}
                      <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: isActive ? 'var(--color-accent)' : 'var(--color-text-primary)', textTransform: 'capitalize', minWidth: '80px' }}>
                        {p.name}
                      </span>

                      {/* Model name */}
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', flex: 1, minWidth: 0 }} className="truncate">
                        {isActive && currentModel !== p.model ? currentModel : p.model}
                      </span>

                      {/* Status badge */}
                      {!p.configured ? (
                        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', flexShrink: 0, padding: '1px 5px', border: '1px solid var(--color-border)', borderRadius: '3px' }}>
                          not configured
                        </span>
                      ) : isActive ? (
                        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)', flexShrink: 0, padding: '1px 5px', border: '1px solid rgba(110,231,183,0.4)', borderRadius: '3px' }}>
                          active
                        </span>
                      ) : null}
                    </div>

                    {/* Show current custom model if active and different from default */}
                    {isActive && currentModel !== p.model && (
                      <div style={{ marginTop: '2px', marginLeft: '22px', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                        default: {p.model}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          <div className="px-3 py-1.5">
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
              /model use {'<provider>:<model>'} to specify a custom model
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
