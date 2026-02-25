// Frontend command suggestion hook.
// Embeds a lightweight grammar definition and fetches dynamic data
// (projects, snippets, models, agents) for context-aware autocomplete.

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  projects as projectsApi,
  snippets as snippetsApi,
  models as modelsApi,
  agents as agentsApi,
  type Project,
  type Snippet,
  type ModelInfo,
  type Agent,
} from '../api';

// ── Types ───────────────────────────────────────────────────────────────────

export type SuggestionCategory = 'domain' | 'action' | 'arg' | 'flag' | 'value';
export type StatusBadge = 'configured' | 'not-configured' | 'idle' | 'busy' | 'offline';

export interface SuggestionItem {
  text: string;
  label: string;
  description?: string;
  category: SuggestionCategory;
  status?: StatusBadge;
}

export interface CommandValidation {
  valid: boolean;
  error?: string;
  usage?: string;
  domain?: string;
  action?: string;
  args?: Record<string, string>;
  flags?: Record<string, string>;
}

export interface SuggestionState {
  suggestions: SuggestionItem[];
  validation: CommandValidation;
  loading: boolean;
}

// ── Grammar definition (client-side mirror) ─────────────────────────────────

interface ArgDef { name: string; required: boolean }
interface FlagDef { name: string; type: string; required?: boolean; default?: unknown; description?: string }
interface CmdDef { args: ArgDef[]; flags?: FlagDef[]; description: string; context?: string[] }

const GRAMMAR: Record<string, Record<string, CmdDef>> = {
  project: {
    new:    { args: [{ name: 'name', required: true }], description: 'Create a new project' },
    list:   { args: [], flags: [{ name: 'limit', type: 'number', default: 20 }, { name: 'offset', type: 'number', default: 0 }], description: 'List projects' },
    switch: { args: [{ name: 'project_id', required: true }], description: 'Switch active project' },
  },
  prompt: {
    new:   { args: [], description: 'Create a new prompt', context: ['project_id'] },
    ready: { args: [{ name: 'prompt_id', required: true }], description: 'Mark prompt as ready', context: ['project_id'] },
    done:  { args: [{ name: 'prompt_id', required: true }], description: 'Mark prompt as done', context: ['project_id'] },
    move:  { args: [{ name: 'prompt_id', required: true }], flags: [{ name: 'parent', type: 'string', required: true, description: 'New parent ID' }], description: 'Move prompt under parent', context: ['project_id'] },
  },
  snippet: {
    list:   { args: [], flags: [{ name: 'limit', type: 'number', default: 20 }], description: 'List snippets' },
    show:   { args: [{ name: 'id', required: true }], description: 'Show snippet details' },
    select: { args: [{ name: 'id', required: true }], description: 'Select a snippet' },
    create: { args: [{ name: 'title', required: true }], flags: [{ name: 'body', type: 'string', required: true, description: 'Snippet body text' }], description: 'Create a snippet' },
  },
  model: {
    list:   { args: [], description: 'List available models' },
    use:    { args: [{ name: 'provider_model', required: true }], description: 'Select model (provider:model)' },
    config: { args: [{ name: 'provider', required: true }], description: 'Configure model provider' },
  },
  agent: {
    list: { args: [], description: 'List available agents' },
    use:  { args: [{ name: 'agent_id', required: true }], description: 'Select an agent' },
  },
  logs: {
    project: { args: [], flags: [{ name: 'since', type: 'duration', description: 'Time window (e.g. 1h, 7d)' }, { name: 'limit', type: 'number', default: 50, description: 'Max results' }], description: 'View project logs', context: ['project_id'] },
    prompt:  { args: [{ name: 'id', required: true }], flags: [{ name: 'since', type: 'duration', description: 'Time window' }, { name: 'limit', type: 'number', default: 50, description: 'Max results' }], description: 'View prompt logs' },
    snippet: { args: [], flags: [{ name: 'since', type: 'duration', description: 'Time window (e.g. 1h, 7d)' }, { name: 'limit', type: 'number', default: 20, description: 'Max results' }], description: 'View snippet logs' },
    diff:    { args: [{ name: 'event_id', required: true }], description: 'View event diff' },
  },
  restore: {
    _default: { args: [{ name: 'event_id', required: true }], description: 'Restore from an event' },
  },
};

const DOMAIN_DESC: Record<string, string> = {
  project: 'Manage projects',
  prompt: 'Manage prompts',
  snippet: 'Manage snippets',
  model: 'Configure models',
  agent: 'Manage agents',
  logs: 'View activity logs',
  restore: 'Restore from event',
};

// ── Tokenizer ───────────────────────────────────────────────────────────────

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const ch of input) {
    if (inQuote) {
      if (ch === quoteChar) inQuote = false;
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) { tokens.push(current); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

// ── Usage string builder ────────────────────────────────────────────────────

function buildUsage(name: string, spec: CmdDef): string {
  const parts = [`/${name}`];
  for (const a of spec.args) parts.push(a.required ? `<${a.name}>` : `[${a.name}]`);
  for (const f of spec.flags ?? []) {
    const hint = f.type === 'boolean' ? '' : `=<${f.type}>`;
    parts.push(f.required ? `--${f.name}${hint}` : `[--${f.name}${hint}]`);
  }
  return parts.join(' ');
}

// ── Suggestion engine ───────────────────────────────────────────────────────

interface DataCache {
  projects: Project[];
  snippets: Snippet[];
  models: ModelInfo[];
  agents: Agent[];
}

function computeSuggestions(
  input: string,
  data: DataCache,
  currentProjectId?: string,
): { suggestions: SuggestionItem[]; validation: CommandValidation } {
  const raw = input.trimStart(); // preserve trailing space — it signals cursor position

  if (!raw.startsWith('/')) {
    return { suggestions: [], validation: { valid: false } };
  }

  const body = raw.slice(1);
  const domains = Object.keys(GRAMMAR);

  // Just "/" or "/ "
  if (!body || !body.trim()) {
    return {
      suggestions: domains.map(d => ({
        text: `/${d} `,
        label: d,
        description: DOMAIN_DESC[d],
        category: 'domain' as const,
      })),
      validation: { valid: false },
    };
  }

  const tokens = tokenize(body);
  if (tokens.length === 0) return { suggestions: [], validation: { valid: false } };

  const domain = tokens[0].toLowerCase();
  const trailing = raw.endsWith(' ');

  // ── Domain completion ───────────────────────────────────────────────

  if (tokens.length === 1 && !trailing) {
    const matches = domains.filter(d => d.startsWith(domain));
    if (matches.length === 0) {
      return {
        suggestions: domains.map(d => ({ text: `/${d} `, label: d, description: DOMAIN_DESC[d], category: 'domain' as const })),
        validation: { valid: false, error: `Unknown domain: ${domain}` },
      };
    }
    return {
      suggestions: matches.map(d => ({ text: `/${d} `, label: d, description: DOMAIN_DESC[d], category: 'domain' as const })),
      validation: { valid: false, domain: matches.length === 1 ? matches[0] : undefined },
    };
  }

  if (!GRAMMAR[domain]) {
    return {
      suggestions: domains.map(d => ({ text: `/${d} `, label: d, description: DOMAIN_DESC[d], category: 'domain' as const })),
      validation: { valid: false, error: `Unknown domain: ${domain}` },
    };
  }

  const domainActions = GRAMMAR[domain];

  // ── _default domain (e.g. /restore) ─────────────────────────────────

  if ('_default' in domainActions) {
    const spec = domainActions._default;
    return buildArgSuggestions(domain, domain, spec, tokens.slice(1), trailing, data, currentProjectId);
  }

  // ── Action completion ───────────────────────────────────────────────

  const actionNames = Object.keys(domainActions);

  if (tokens.length === 1 && trailing) {
    return {
      suggestions: actionNames.map(a => ({
        text: `/${domain} ${a} `,
        label: a,
        description: domainActions[a].description,
        category: 'action' as const,
      })),
      validation: { valid: false, domain },
    };
  }

  if (tokens.length === 2 && !trailing) {
    const partial = tokens[1].toLowerCase();
    const matches = actionNames.filter(a => a.startsWith(partial));
    if (matches.length === 0) {
      return {
        suggestions: actionNames.map(a => ({ text: `/${domain} ${a} `, label: a, description: domainActions[a].description, category: 'action' as const })),
        validation: { valid: false, error: `Unknown action: ${tokens[1]}`, domain },
      };
    }
    return {
      suggestions: matches.map(a => ({ text: `/${domain} ${a} `, label: a, description: domainActions[a].description, category: 'action' as const })),
      validation: { valid: false, domain },
    };
  }

  const action = tokens[1].toLowerCase();
  const spec = domainActions[action];
  if (!spec) {
    return {
      suggestions: actionNames.map(a => ({ text: `/${domain} ${a} `, label: a, description: domainActions[a].description, category: 'action' as const })),
      validation: { valid: false, error: `Unknown action: /${domain} ${action}`, domain },
    };
  }

  return buildArgSuggestions(domain, action, spec, tokens.slice(2), trailing, data, currentProjectId);
}

function buildArgSuggestions(
  domain: string,
  action: string,
  spec: CmdDef,
  argTokens: string[],
  trailing: boolean,
  data: DataCache,
  currentProjectId?: string,
): { suggestions: SuggestionItem[]; validation: CommandValidation } {
  const usage = buildUsage(domain === action ? domain : `${domain} ${action}`, spec);
  const suggestions: SuggestionItem[] = [];

  // Separate positionals and flags
  const positionals: string[] = [];
  const flagTokens: string[] = [];
  for (const t of argTokens) {
    if (t.startsWith('--')) flagTokens.push(t);
    else positionals.push(t);
  }

  // Check if all required args are filled
  const requiredArgs = spec.args.filter(a => a.required);
  const allArgsFilled = positionals.length >= requiredArgs.length;

  // Check flags
  const parsedFlags: Record<string, string> = {};
  const usedFlagNames = new Set<string>();
  for (const ft of flagTokens) {
    const eqIdx = ft.indexOf('=');
    if (eqIdx > 2) {
      const name = ft.slice(2, eqIdx);
      parsedFlags[name] = ft.slice(eqIdx + 1);
      usedFlagNames.add(name);
    } else {
      usedFlagNames.add(ft.slice(2));
    }
  }

  const requiredFlags = (spec.flags ?? []).filter(f => f.required);
  const allRequiredFlags = requiredFlags.every(f => usedFlagNames.has(f.name));

  // Build args record
  const args: Record<string, string> = {};
  for (let i = 0; i < spec.args.length && i < positionals.length; i++) {
    if (i === spec.args.length - 1 && positionals.length > spec.args.length) {
      args[spec.args[i].name] = positionals.slice(i).join(' ');
    } else {
      args[spec.args[i].name] = positionals[i];
    }
  }

  // Valid if all required args + flags present
  const valid = allArgsFilled && allRequiredFlags;

  // Generate error message
  let error: string | undefined;
  if (!allArgsFilled) {
    const missing = requiredArgs[positionals.length];
    if (missing) error = `Missing required argument: <${missing.name}>`;
  } else if (!allRequiredFlags) {
    const missing = requiredFlags.find(f => !usedFlagNames.has(f.name));
    if (missing) error = `Missing required flag: --${missing.name}`;
  }

  // Context warning
  if (spec.context && spec.context.includes('project_id') && !currentProjectId) {
    error = error || 'Requires active project context';
  }

  // ── Arg value suggestions ───────────────────────────────────────────

  const argIdx = trailing ? positionals.length : Math.max(positionals.length - 1, 0);
  const partial = (!trailing && positionals.length > 0) ? positionals[positionals.length - 1].toLowerCase() : '';

  if (argIdx < spec.args.length) {
    const argDef = spec.args[argIdx];
    suggestions.push(...getValueSuggestions(domain, action, argDef.name, partial, data));
  }

  // ── Flag suggestions ────────────────────────────────────────────────

  for (const f of spec.flags ?? []) {
    if (usedFlagNames.has(f.name)) continue;
    const desc = [f.description, f.type, f.required ? 'required' : null, f.default !== undefined ? `default: ${f.default}` : null]
      .filter(Boolean).join(' · ');
    suggestions.push({
      text: `--${f.name}=`,
      label: `--${f.name}`,
      description: desc,
      category: 'flag',
    });
  }

  return {
    suggestions,
    validation: {
      valid,
      error,
      usage,
      domain,
      action,
      args: Object.keys(args).length > 0 ? args : undefined,
      flags: Object.keys(parsedFlags).length > 0 ? parsedFlags : undefined,
    },
  };
}

function getValueSuggestions(
  domain: string,
  action: string,
  argName: string,
  partial: string,
  data: DataCache,
): SuggestionItem[] {
  if (argName === 'project_id') {
    return data.projects
      .filter(p => !partial || p.id.toLowerCase().includes(partial) || p.name.toLowerCase().includes(partial))
      .slice(0, 8)
      .map(p => ({ text: `/${domain} ${action} ${p.id}`, label: p.name, description: p.id.slice(0, 12), category: 'value' as const }));
  }

  if (argName === 'id' && domain === 'snippet') {
    return data.snippets
      .filter(s => !partial || s.id.toLowerCase().includes(partial) || s.name.toLowerCase().includes(partial))
      .slice(0, 8)
      .map(s => ({ text: `/${domain} ${action} ${s.id}`, label: s.name, description: s.id.slice(0, 12), category: 'value' as const }));
  }

  if (argName === 'provider_model') {
    return data.models
      .filter(m => !partial || `${m.name}:${m.model}`.toLowerCase().includes(partial))
      .slice(0, 8)
      .map(m => ({
        text: `/${domain} ${action} ${m.name}:${m.model}`,
        label: `${m.name}:${m.model}`,
        description: m.configured ? 'configured' : 'not configured',
        category: 'value' as const,
        status: (m.configured ? 'configured' : 'not-configured') as StatusBadge,
      }));
  }

  if (argName === 'provider') {
    return data.models
      .filter(m => !partial || m.name.toLowerCase().includes(partial))
      .slice(0, 8)
      .map(m => ({
        text: `/${domain} ${action} ${m.name}`,
        label: m.name,
        description: m.configured ? 'configured' : 'not configured',
        category: 'value' as const,
        status: (m.configured ? 'configured' : 'not-configured') as StatusBadge,
      }));
  }

  if (argName === 'agent_id') {
    return data.agents
      .filter(a => !partial || a.id.toLowerCase().includes(partial) || a.machine_name.toLowerCase().includes(partial))
      .slice(0, 8)
      .map(a => ({
        text: `/${domain} ${action} ${a.id}`,
        label: a.machine_name,
        description: a.id.slice(0, 12),
        category: 'value' as const,
        status: a.status as StatusBadge,
      }));
  }

  return [];
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useCommandSuggestions(
  input: string,
  currentProjectId?: string,
): SuggestionState {
  const [data, setData] = useState<DataCache>({
    projects: [],
    snippets: [],
    models: [],
    agents: [],
  });
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  // Fetch data on first slash command
  useEffect(() => {
    if (!input.startsWith('/') || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);

    Promise.all([
      projectsApi.list().catch(() => [] as Project[]),
      snippetsApi.list().catch(() => [] as Snippet[]),
      modelsApi.list().catch(() => ({ providers: [] as ModelInfo[] })),
      currentProjectId
        ? agentsApi.listByProject(currentProjectId).catch(() => [] as Agent[])
        : Promise.resolve([] as Agent[]),
    ]).then(([projects, snippets, modelsResp, agents]) => {
      setData({
        projects,
        snippets,
        models: 'providers' in modelsResp ? modelsResp.providers : [],
        agents,
      });
      setLoading(false);
    });
  }, [input, currentProjectId]);

  const result = useMemo(() => {
    if (!input.startsWith('/')) {
      return {
        suggestions: [],
        validation: { valid: false } as CommandValidation,
      };
    }
    return computeSuggestions(input, data, currentProjectId);
  }, [input, data, currentProjectId]);

  return {
    suggestions: result.suggestions,
    validation: result.validation,
    loading,
  };
}
