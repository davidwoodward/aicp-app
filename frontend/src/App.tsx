import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { models as modelsApi } from './api'
import { ErrorProvider } from './hooks/useError'
import AppShell from './components/AppShell'
import Layout from './components/Layout'
import ProjectList from './pages/ProjectList'
import ProjectDetail from './pages/ProjectDetail'
import Chat from './pages/Chat'

export default function App() {
  const [provider, setProvider] = useState('gemini')
  const [model, setModel] = useState('gemini-2.5-flash')

  useEffect(() => {
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
  }, [])

  function handleModelChange(p: string, m: string) {
    setProvider(p)
    setModel(m)
    // Persist execution LLM selection server-side
    modelsApi.select(p, m).catch(() => {})
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
