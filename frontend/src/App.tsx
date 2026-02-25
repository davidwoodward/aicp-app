import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { models as modelsApi } from './api'
import Layout from './components/Layout'
import ChatLayout from './components/ChatLayout'
import ProjectList from './pages/ProjectList'
import ProjectDetail from './pages/ProjectDetail'
import Chat from './pages/Chat'

export default function App() {
  const [provider, setProvider] = useState('gemini')
  const [model, setModel] = useState('gemini-2.5-flash')

  // Load default provider on mount
  useEffect(() => {
    modelsApi.list().then((data) => {
      setProvider(data.default_provider)
      const p = data.providers.find((p) => p.name === data.default_provider)
      if (p) setModel(p.model)
    }).catch(() => {})
  }, [])

  function handleModelChange(p: string, m: string) {
    setProvider(p)
    setModel(m)
  }

  return (
    <Routes>
      {/* Chat routes */}
      <Route element={<ChatLayout provider={provider} model={model} onModelChange={handleModelChange} />}>
        <Route path="/" element={<Chat provider={provider} model={model} onModelChange={handleModelChange} />} />
        <Route path="/c/:conversationId" element={<Chat provider={provider} model={model} onModelChange={handleModelChange} />} />
      </Route>

      {/* Project routes (existing) */}
      <Route element={<Layout />}>
        <Route path="/projects" element={<ProjectList />} />
        <Route path="/projects/:projectId/*" element={<ProjectDetail />} />
      </Route>
    </Routes>
  )
}
