import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { models as modelsApi } from './api'
import { ErrorProvider } from './hooks/useError'
import { useAuth } from './hooks/useAuth'
import AppShell from './components/AppShell'
import Layout from './components/Layout'
import ProjectList from './pages/ProjectList'
import ProjectDetail from './pages/ProjectDetail'
import Chat from './pages/Chat'
import Login from './pages/Login'

export default function App() {
  const { user, loading } = useAuth()
  const [provider, setProvider] = useState('gemini')
  const [model, setModel] = useState('gemini-2.5-flash')

  useEffect(() => {
    if (!user) return
    modelsApi.list().then(data => {
      // Prefer persisted selection over env default
      if (data.selected_provider && data.selected_model) {
        setProvider(data.selected_provider)
        setModel(data.selected_model)
      } else {
        setProvider(data.default_provider)
        const p = data.providers.find(p => p.name === data.default_provider)
        if (p) setModel(p.model)
      }
    }).catch(() => {})
  }, [user])

  function handleModelChange(p: string, m: string) {
    setProvider(p)
    setModel(m)
    // Persist execution LLM selection server-side
    modelsApi.select(p, m).catch(() => {})
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--color-surface-0)',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--color-text-muted)',
        }}
      >
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <ErrorProvider>
      <Routes>
        {/* Chat routes — 3-panel shell */}
        <Route element={<AppShell provider={provider} model={model} onModelChange={handleModelChange} />}>
          <Route path="/" element={<Chat provider={provider} model={model} onModelChange={handleModelChange} />} />
        </Route>

        {/* Project routes — classic layout */}
        <Route element={<Layout />}>
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/projects/:projectId/*" element={<ProjectDetail />} />
        </Route>
      </Routes>
    </ErrorProvider>
  )
}
