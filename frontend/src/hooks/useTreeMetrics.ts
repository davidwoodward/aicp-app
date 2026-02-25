import { useState, useEffect, useCallback } from 'react'
import { projects, type PromptMetrics, type DayActivity } from '../api'

interface UseTreeMetricsResult {
  metricsMap: Map<string, PromptMetrics>
  timelineMap: Map<string, DayActivity[]>
  loading: boolean
  refresh: () => void
}

export function useTreeMetrics(projectId: string | null): UseTreeMetricsResult {
  const [metricsMap, setMetricsMap] = useState<Map<string, PromptMetrics>>(new Map())
  const [timelineMap, setTimelineMap] = useState<Map<string, DayActivity[]>>(new Map())
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(() => {
    if (!projectId) return
    setLoading(true)
    projects.treeMetrics(projectId)
      .then((res) => {
        const mMap = new Map<string, PromptMetrics>()
        for (const m of res.prompts) mMap.set(m.prompt_id, m)
        setMetricsMap(mMap)

        const tMap = new Map<string, DayActivity[]>()
        for (const bt of res.branch_timelines) tMap.set(bt.prompt_id, bt.timeline)
        setTimelineMap(tMap)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { fetch() }, [fetch])

  return { metricsMap, timelineMap, loading, refresh: fetch }
}
