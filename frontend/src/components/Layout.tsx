import { Outlet, Link, useLocation } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'

export default function Layout() {
  const location = useLocation()
  const isProjectList = location.pathname === '/projects'

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Top bar */}
      <header className="border-b border-border bg-surface-1/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center gap-4">
          <Link to="/" className="font-mono font-bold text-accent tracking-tight text-sm hover:opacity-80 transition-opacity">
            AICP
          </Link>
          <div className="h-4 w-px bg-border" />
          <Link
            to="/"
            className="text-text-muted text-xs font-mono uppercase tracking-widest hover:text-text-secondary transition-colors"
          >
            Chat
          </Link>
          <Link
            to="/projects"
            className={`text-xs font-mono uppercase tracking-widest transition-colors ${
              isProjectList || location.pathname.startsWith('/projects/')
                ? 'text-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Projects
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
