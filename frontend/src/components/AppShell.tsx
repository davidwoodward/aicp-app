import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import NavPanel from './NavPanel'
import TelemetryPanel from './TelemetryPanel'
import CmdKPalette from './CmdKPalette'
import TopBar from './TopBar'
import RecentlyDeletedPanel from './RecentlyDeletedPanel'
import SnippetEditor from './SnippetEditor'
import SnippetManagementPanel from './SnippetManagementPanel'
import SettingsEditor from './SettingsEditor'
import { settings as settingsApi, snippets as snippetsApi } from '../api'
import type { RefineMode } from '../api'

interface Props {
  provider: string
  model: string
  onModelChange: (provider: string, model: string) => void
}

export default function AppShell({ provider, model, onModelChange }: Props) {
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [deletedPanelOpen, setDeletedPanelOpen] = useState(false)
  const [snippetManagerOpen, setSnippetManagerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [navKey, setNavKey] = useState(0)
  const [promptRefreshKey, setPromptRefreshKey] = useState(0)
  const [snippetRefreshKey, setSnippetRefreshKey] = useState(0)
  const [selectedProject, setSelectedProject] = useState<string | null>(() => {
    try { return localStorage.getItem('aicp:last-project') } catch { return null }
  })
  const [activePromptId, setActivePromptId] = useState<string | null>(() => {
    try { return localStorage.getItem('aicp:last-prompt') } catch { return null }
  })
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null)
  const [refineMode, setRefineMode] = useState<RefineMode>('Manual')
  const [refineSystemPrompt, setRefineSystemPrompt] = useState('')

  // Load refine settings from Firestore on mount
  useEffect(() => {
    settingsApi.getRefine().then(s => {
      setRefineMode(s.mode)
      setRefineSystemPrompt(s.system_prompt)
    }).catch(() => {})
  }, [])

  // Persist project selection
  useEffect(() => {
    try {
      if (selectedProject) localStorage.setItem('aicp:last-project', selectedProject)
      else localStorage.removeItem('aicp:last-project')
    } catch {}
  }, [selectedProject])

  // Persist active prompt
  useEffect(() => {
    try {
      if (activePromptId) localStorage.setItem('aicp:last-prompt', activePromptId)
      else localStorage.removeItem('aicp:last-prompt')
    } catch {}
  }, [activePromptId])

  // When selecting a prompt, dismiss snippet editor and settings
  function handlePromptSelect(id: string | null) {
    setActivePromptId(id)
    setEditingSnippetId(null)
    setSettingsOpen(false)
  }

  // When selecting a snippet, dismiss active prompt and settings
  function handleSnippetSelect(id: string | null) {
    setEditingSnippetId(id)
    setActivePromptId(null)
    setSettingsOpen(false)
  }

  function handleOpenSettings() {
    setSettingsOpen(true)
    setEditingSnippetId(null)
    setActivePromptId(null)
  }

  function handleRefineSettingsChange(s: { mode: RefineMode; system_prompt: string }) {
    setRefineMode(s.mode)
    setRefineSystemPrompt(s.system_prompt)
  }

  async function handleCreateSnippetFromManager() {
    try {
      const snippet = await snippetsApi.create({ name: '', content: '' })
      setSnippetManagerOpen(false)
      setEditingSnippetId(snippet.id)
      setActivePromptId(null)
      setSettingsOpen(false)
      setNavKey(k => k + 1)
    } catch { /* ignore */ }
  }

  function handleRefineModeToggle() {
    const prev = refineMode
    const next: RefineMode = prev === 'Manual' ? 'Auto' : 'Manual'
    setRefineMode(next)
    settingsApi.updateRefine({ mode: next })
      .then(result => {
        setRefineMode(result.mode as RefineMode)
        setRefineSystemPrompt(result.system_prompt)
      })
      .catch(() => setRefineMode(prev))
  }

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdkOpen(v => !v)
      }
      if (e.key === 'Escape') setCmdkOpen(false)
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface-0">

      <TopBar
        onCmdK={() => setCmdkOpen(true)}
        onOpenDeleted={() => setDeletedPanelOpen(true)}
        onOpenSettings={handleOpenSettings}
      />

      {/* ── Three-panel body ─────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — Navigation */}
        <div className="shrink-0 border-r border-border overflow-hidden" style={{ width: '240px' }}>
          <NavPanel
            key={navKey}
            onProjectSelect={setSelectedProject}
            activePromptId={activePromptId}
            onPromptSelect={handlePromptSelect}
            activeSnippetId={editingSnippetId}
            onSnippetSelect={handleSnippetSelect}
            onOpenSnippetManager={() => setSnippetManagerOpen(true)}
            promptRefreshKey={promptRefreshKey}
            snippetRefreshKey={snippetRefreshKey}
          />
        </div>

        {/* Center — Settings / Snippet editor / Chat */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {settingsOpen ? (
            <SettingsEditor
              refineMode={refineMode}
              refineSystemPrompt={refineSystemPrompt}
              onRefineSettingsChange={handleRefineSettingsChange}
              onClose={() => setSettingsOpen(false)}
            />
          ) : editingSnippetId ? (
            <SnippetEditor
              snippetId={editingSnippetId}
              onClose={() => { setEditingSnippetId(null); setSnippetRefreshKey(k => k + 1) }}
            />
          ) : (
            <Outlet context={{ selectedProject, setSelectedProject, activePromptId, setActivePromptId: handlePromptSelect, onPromptUpdated: () => setPromptRefreshKey(k => k + 1) }} />
          )}
        </div>

        {/* Right — Telemetry + context bar */}
        <div className="shrink-0 border-l border-border overflow-hidden" style={{ width: '272px' }}>
          <TelemetryPanel
            provider={provider}
            model={model}
            onModelChange={onModelChange}
            selectedProject={selectedProject}
            refineMode={refineMode}
            onRefineModeToggle={handleRefineModeToggle}
          />
        </div>
      </div>

      {/* Cmd+K palette overlay */}
      {cmdkOpen && <CmdKPalette onClose={() => setCmdkOpen(false)} />}

      {/* Recently Deleted panel */}
      {deletedPanelOpen && (
        <RecentlyDeletedPanel
          onClose={() => setDeletedPanelOpen(false)}
          onRestore={() => setNavKey(k => k + 1)}
        />
      )}

      {/* Snippet Management panel */}
      {snippetManagerOpen && (
        <SnippetManagementPanel
          onClose={() => setSnippetManagerOpen(false)}
          onRefresh={() => setNavKey(k => k + 1)}
          onCreateAndEdit={handleCreateSnippetFromManager}
        />
      )}
    </div>
  )
}
