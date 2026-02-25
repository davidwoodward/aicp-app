import { useState, useCallback } from 'react'

function storageKey(projectId: string) {
  return `aicp:collapse:${projectId}`
}

function readFromStorage(projectId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch { /* ignore */ }
  return new Set()
}

function writeToStorage(projectId: string, set: Set<string>) {
  localStorage.setItem(storageKey(projectId), JSON.stringify([...set]))
}

export function useCollapseState(projectId: string) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => readFromStorage(projectId))

  const isCollapsed = useCallback((id: string) => collapsed.has(id), [collapsed])

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writeToStorage(projectId, next)
      return next
    })
  }, [projectId])

  return { isCollapsed, toggle }
}
