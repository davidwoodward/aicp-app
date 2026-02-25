import { Outlet, Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import ModelSelector from './ModelSelector'

interface Props {
  provider: string;
  model: string;
  onModelChange: (provider: string, model: string) => void;
}

export default function ChatLayout({ provider, model, onModelChange }: Props) {
  return (
    <div className="h-screen flex flex-col bg-surface-0">
      {/* Compact header */}
      <header className="border-b border-border bg-surface-1/80 backdrop-blur-sm shrink-0 z-50">
        <div className="px-4 h-11 flex items-center gap-3">
          <Link to="/" className="font-mono font-bold text-accent tracking-tight text-sm hover:opacity-80 transition-opacity">
            AICP
          </Link>
          <div className="h-4 w-px bg-border" />
          <Link
            to="/projects"
            className="text-text-muted text-xs font-mono uppercase tracking-widest hover:text-text-secondary transition-colors"
          >
            Projects
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ModelSelector
              provider={provider}
              model={model}
              onModelChange={onModelChange}
            />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
