import { useEffect, useState } from 'react'
import { conversations as api, type Conversation } from '../api'

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  refreshKey: number;
}

export default function ConversationSidebar({ activeId, onSelect, onNew, refreshKey }: Props) {
  const [list, setList] = useState<Conversation[]>([])
  const [hoverId, setHoverId] = useState<string | null>(null)

  useEffect(() => {
    api.list().then(setList).catch(() => {})
  }, [refreshKey])

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await api.delete(id).catch(() => {})
    setList((prev) => prev.filter((c) => c.id !== id))
    if (activeId === id) onNew()
  }

  return (
    <div className="w-56 shrink-0 border-r border-border bg-surface-1 flex flex-col overflow-hidden">
      {/* New chat button */}
      <div className="p-2">
        <button
          onClick={onNew}
          className="w-full px-3 py-2 text-xs font-mono font-medium bg-accent/10 text-accent border border-accent/20 rounded hover:bg-accent/20 transition-colors"
        >
          + New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {list.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            onMouseEnter={() => setHoverId(c.id)}
            onMouseLeave={() => setHoverId(null)}
            className={`w-full text-left px-3 py-2 rounded text-xs transition-colors relative group ${
              activeId === c.id
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:bg-surface-2'
            }`}
          >
            <div className="truncate pr-5 font-medium">{c.title}</div>
            <div className="text-text-muted text-[10px] font-mono mt-0.5">
              {c.provider}/{c.model.split('/').pop()}
            </div>
            {hoverId === c.id && (
              <button
                onClick={(e) => handleDelete(e, c.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-danger text-[10px] font-mono transition-colors"
              >
                x
              </button>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
