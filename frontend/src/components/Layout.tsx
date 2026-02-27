import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import ErrorContainer from './ErrorContainer'

export default function Layout() {
  return (
    <div className="min-h-screen bg-surface-0">
      <TopBar />

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Outlet />
      </main>

      <ErrorContainer />
    </div>
  )
}
