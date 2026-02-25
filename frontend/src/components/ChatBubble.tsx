interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string;
}

interface ToolResultInfo {
  tool_call_id: string;
  name: string;
  result: string;
}

interface Props {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallInfo[];
  toolResults?: ToolResultInfo[];
  streaming?: boolean;
}

function renderContent(text: string) {
  // Split by code blocks
  const parts = text.split(/(```[\s\S]*?```)/g)
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3)
      const newlineIdx = inner.indexOf('\n')
      const code = newlineIdx >= 0 ? inner.slice(newlineIdx + 1) : inner
      return (
        <pre key={i} className="my-2 p-3 bg-surface-0 border border-border rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">
          <code>{code}</code>
        </pre>
      )
    }
    // Inline code
    const inlineParts = part.split(/(`[^`]+`)/g)
    return (
      <span key={i}>
        {inlineParts.map((ip, j) => {
          if (ip.startsWith('`') && ip.endsWith('`')) {
            return (
              <code key={j} className="px-1 py-0.5 bg-surface-3 rounded text-xs font-mono">
                {ip.slice(1, -1)}
              </code>
            )
          }
          return <span key={j}>{ip}</span>
        })}
      </span>
    )
  })
}

export default function ChatBubble({ role, content, toolCalls, toolResults, streaming }: Props) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[75%] px-4 py-3 rounded-lg text-sm leading-relaxed ${
          isUser
            ? 'bg-surface-2 border border-border'
            : 'bg-surface-1 border-l-2 border-accent/30'
        }`}
      >
        {/* Tool call indicators */}
        {toolCalls && toolCalls.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {toolCalls.map((tc) => (
              <div key={tc.id} className="flex items-center gap-2 px-2 py-1.5 bg-accent/5 border border-accent/15 rounded text-[11px] font-mono">
                <span className="text-accent">fn</span>
                <span className="text-text-secondary">{tc.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tool results */}
        {toolResults && toolResults.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {toolResults.map((tr) => (
              <details key={tr.tool_call_id} className="text-[11px] font-mono">
                <summary className="cursor-pointer text-text-muted hover:text-text-secondary">
                  Result: {tr.name}
                </summary>
                <pre className="mt-1 p-2 bg-surface-0 border border-border rounded overflow-x-auto whitespace-pre-wrap text-text-secondary">
                  {(() => {
                    try { return JSON.stringify(JSON.parse(tr.result), null, 2) }
                    catch { return tr.result }
                  })()}
                </pre>
              </details>
            ))}
          </div>
        )}

        {/* Message content */}
        <div className="whitespace-pre-wrap break-words">
          {renderContent(content)}
          {streaming && (
            <span className="inline-flex ml-1 typing-indicator">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
