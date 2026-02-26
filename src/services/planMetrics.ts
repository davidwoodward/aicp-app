import { listPromptsByProject, Prompt } from "../firestore/prompts";
import { listActivityLogs, ActivityLog } from "../middleware/activityLogger";

export interface PromptMetrics {
  prompt_id: string;
  execution_count: number;
  last_execution_at: string | null;
  last_updated_at: string | null;
  activity_score: number;
  heatmap_level: "neutral" | "light" | "medium" | "strong";
  stale: boolean;
}

export interface DayActivity {
  date: string;
  count: number;
}

export interface SubtreeTimeline {
  prompt_id: string;
  timeline: DayActivity[];
}

export interface TreeMetricsResponse {
  project_id: string;
  prompts: PromptMetrics[];
  subtree_timelines: SubtreeTimeline[];
  computed_at: string;
}

// ── In-memory cache (30-second TTL, keyed by project_id) ─────────────────

interface CacheEntry {
  data: TreeMetricsResponse;
  expires: number;
}

const metricsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

/** Evict expired entries. Called lazily — no timers needed. */
function evictStale(): void {
  const now = Date.now();
  for (const [key, entry] of metricsCache) {
    if (entry.expires <= now) metricsCache.delete(key);
  }
}

/** Invalidate cache for a project (e.g. after a mutation). */
export function invalidateTreeMetrics(projectId: string): void {
  metricsCache.delete(projectId);
}

// ── Helpers ──────────────────────────────────────────────────────────────

function heatmapLevel(score: number): PromptMetrics["heatmap_level"] {
  if (score === 0) return "neutral";
  if (score <= 2) return "light";
  if (score <= 5) return "medium";
  return "strong";
}

function isStale(lastUpdatedAt: string | null): boolean {
  if (!lastUpdatedAt) return true;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(lastUpdatedAt).getTime() > sevenDaysMs;
}

function getDescendants(
  promptId: string,
  childrenMap: Map<string | null, string[]>,
  visited: Set<string> = new Set(),
): string[] {
  if (visited.has(promptId)) return []; // cycle detected
  visited.add(promptId);
  const children = childrenMap.get(promptId) ?? [];
  const all: string[] = [];
  for (const childId of children) {
    all.push(childId);
    all.push(...getDescendants(childId, childrenMap, visited));
  }
  return all;
}

function buildSubtreeTimeline(
  promptId: string,
  childrenMap: Map<string | null, string[]>,
  activityByPrompt: Map<string, ActivityLog[]>
): DayActivity[] {
  const descendantIds = getDescendants(promptId, childrenMap);
  const allIds = [promptId, ...descendantIds];

  const dayCounts = new Map<string, number>();
  for (const id of allIds) {
    const logs = activityByPrompt.get(id) ?? [];
    for (const log of logs) {
      const day = log.created_at.slice(0, 10);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }
  }

  return Array.from(dayCounts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Main computation ─────────────────────────────────────────────────────

export async function computeTreeMetrics(
  projectId: string
): Promise<TreeMetricsResponse> {
  // Check cache first
  evictStale();
  const cached = metricsCache.get(projectId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  // Fetch data scoped strictly to this project.
  // Use a high limit for the activity query so metrics aren't truncated.
  const [prompts, activityResult] = await Promise.all([
    listPromptsByProject(projectId),
    listActivityLogs({
      project_id: projectId,
      entity_type: "prompt",
      limit: 5000,
    }),
  ]);
  const activityLogs = activityResult.logs;

  // Validate project scope — filter out any log that doesn't belong
  const scopedLogs = activityLogs.filter(
    (log) => log.project_id === projectId
  );

  // Build children map: parent_prompt_id → child ids
  const promptIds = new Set(prompts.map((p) => p.id));
  const childrenMap = new Map<string | null, string[]>();
  for (const prompt of prompts) {
    const parentId = prompt.parent_prompt_id;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(prompt.id);
  }

  // Group activity logs by entity_id (prompt id) — only if the prompt belongs to this project
  const activityByPrompt = new Map<string, ActivityLog[]>();
  for (const log of scopedLogs) {
    if (!promptIds.has(log.entity_id)) continue;
    if (!activityByPrompt.has(log.entity_id)) {
      activityByPrompt.set(log.entity_id, []);
    }
    activityByPrompt.get(log.entity_id)!.push(log);
  }

  // Compute per-node execution counts
  const executionCountMap = new Map<string, number>();
  const lastExecutionMap = new Map<string, string>();
  const lastUpdatedMap = new Map<string, string>();

  for (const log of scopedLogs) {
    if (!promptIds.has(log.entity_id)) continue;

    // Track last_updated_at (any action)
    const currentUpdated = lastUpdatedMap.get(log.entity_id);
    if (!currentUpdated || log.created_at > currentUpdated) {
      lastUpdatedMap.set(log.entity_id, log.created_at);
    }

    // Track executions
    if (log.action_type === "execute") {
      executionCountMap.set(
        log.entity_id,
        (executionCountMap.get(log.entity_id) ?? 0) + 1
      );
      const currentExec = lastExecutionMap.get(log.entity_id);
      if (!currentExec || log.created_at > currentExec) {
        lastExecutionMap.set(log.entity_id, log.created_at);
      }
    }
  }

  // Recursive activity_score computation (with cycle guard)
  function subtreeScore(promptId: string, visited: Set<string> = new Set()): number {
    if (visited.has(promptId)) return 0; // cycle detected
    visited.add(promptId);
    const own = executionCountMap.get(promptId) ?? 0;
    const children = childrenMap.get(promptId) ?? [];
    return own + children.reduce((sum, childId) => sum + subtreeScore(childId, visited), 0);
  }

  // Build prompt metrics
  const promptMetrics: PromptMetrics[] = prompts.map((prompt) => {
    const executionCount = executionCountMap.get(prompt.id) ?? 0;
    const lastExecutionAt = lastExecutionMap.get(prompt.id) ?? null;
    const lastUpdatedAt = lastUpdatedMap.get(prompt.id) ?? null;
    const score = subtreeScore(prompt.id);

    return {
      prompt_id: prompt.id,
      execution_count: executionCount,
      last_execution_at: lastExecutionAt,
      last_updated_at: lastUpdatedAt,
      activity_score: score,
      heatmap_level: heatmapLevel(score),
      stale: isStale(lastUpdatedAt),
    };
  });

  // Build subtree timelines only for prompts that have children
  const subtreeTimelines: SubtreeTimeline[] = [];
  for (const prompt of prompts) {
    const children = childrenMap.get(prompt.id);
    if (children && children.length > 0) {
      subtreeTimelines.push({
        prompt_id: prompt.id,
        timeline: buildSubtreeTimeline(prompt.id, childrenMap, activityByPrompt),
      });
    }
  }

  const result: TreeMetricsResponse = {
    project_id: projectId,
    prompts: promptMetrics,
    subtree_timelines: subtreeTimelines,
    computed_at: new Date().toISOString(),
  };

  // Store in cache
  metricsCache.set(projectId, {
    data: result,
    expires: Date.now() + CACHE_TTL_MS,
  });

  return result;
}
