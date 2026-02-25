// Context-aware suggestion engine for slash commands.
// Uses grammarEngine for parsing — provides autocomplete, validation, and preview.

import {
  parse,
  isParseError,
  getDomains,
  getActions,
  getCommandSpec,
  usageString,
  type ParsedCommand,
  type CommandSpec,
  type FlagSpec,
} from './grammarEngine';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SuggestionItem {
  /** Full text to insert when selected */
  text: string;
  /** Display label */
  label: string;
  /** Secondary description */
  description?: string;
  /** What kind of token this completes */
  category: 'domain' | 'action' | 'arg' | 'flag' | 'value';
  /** Status indicator for providers/agents */
  status?: 'configured' | 'not-configured' | 'idle' | 'busy' | 'offline';
}

export interface SuggestionResult {
  /** Whether the current input is a valid, complete command */
  valid: boolean;
  /** The parsed command (when valid) */
  parsed?: ParsedCommand;
  /** Error message (when invalid) */
  error?: string;
  /** Usage string for the matched command */
  usage?: string;
  /** Suggestions for autocompletion */
  suggestions: SuggestionItem[];
}

export interface DataContext {
  projects?: Array<{ id: string; name: string }>;
  snippets?: Array<{ id: string; name: string }>;
  models?: Array<{ name: string; model: string; configured: boolean }>;
  agents?: Array<{ id: string; machine_name: string; status: string }>;
}

// ── Domain descriptions ─────────────────────────────────────────────────────

const DOMAIN_DESC: Record<string, string> = {
  project: 'Manage projects',
  prompt: 'Manage prompts',
  snippet: 'Manage snippets',
  model: 'Configure models',
  agent: 'Manage agents',
  logs: 'View activity logs',
  restore: 'Restore from event',
};

// ── Main suggest function ───────────────────────────────────────────────────

export function suggest(input: string, ctx: DataContext = {}): SuggestionResult {
  const raw = input.trimStart(); // preserve trailing space — it signals cursor position

  if (!raw.startsWith('/')) {
    return { valid: false, suggestions: [] };
  }

  const body = raw.slice(1);

  // Just "/" — suggest all domains
  if (!body || !body.trim()) {
    return {
      valid: false,
      suggestions: domainSuggestions(),
    };
  }

  const tokens = tokenize(body);
  if (tokens.length === 0) {
    return { valid: false, suggestions: [] };
  }

  const domain = tokens[0].toLowerCase();
  const trailingSpace = raw.endsWith(' ');

  // ── Domain completion ─────────────────────────────────────────────────

  if (tokens.length === 1 && !trailingSpace) {
    const matches = getDomains().filter(d => d.startsWith(domain));
    if (matches.length === 0) {
      return {
        valid: false,
        error: `Unknown domain: ${domain}`,
        suggestions: domainSuggestions(),
      };
    }
    return {
      valid: false,
      suggestions: matches.map(d => ({
        text: `/${d} `,
        label: d,
        description: DOMAIN_DESC[d],
        category: 'domain' as const,
      })),
    };
  }

  // Domain must exist from here on
  if (!getDomains().includes(domain)) {
    return {
      valid: false,
      error: `Unknown domain: ${domain}`,
      suggestions: domainSuggestions(),
    };
  }

  // ── _default domain (e.g. /restore) ───────────────────────────────────

  const defaultSpec = getCommandSpec(domain);
  if (defaultSpec) {
    return suggestForSpec(domain, domain, defaultSpec, tokens.slice(1), trailingSpace, raw, ctx);
  }

  // ── Action completion ─────────────────────────────────────────────────

  const actions = getActions(domain);

  if (tokens.length === 1 && trailingSpace) {
    return {
      valid: false,
      suggestions: actionSuggestions(domain, actions),
    };
  }

  if (tokens.length === 2 && !trailingSpace) {
    const partial = tokens[1].toLowerCase();
    const matches = actions.filter(a => a.startsWith(partial));
    if (matches.length === 0) {
      return {
        valid: false,
        error: `Unknown action: ${tokens[1]}`,
        suggestions: actionSuggestions(domain, actions),
      };
    }
    return {
      valid: false,
      suggestions: matches.map(a => {
        const spec = getCommandSpec(domain, a);
        return {
          text: `/${domain} ${a} `,
          label: a,
          description: spec?.description,
          category: 'action' as const,
        };
      }),
    };
  }

  // Action determined
  const action = tokens[1].toLowerCase();
  const spec = getCommandSpec(domain, action);
  if (!spec) {
    return {
      valid: false,
      error: `Unknown action: /${domain} ${action}`,
      suggestions: actionSuggestions(domain, actions),
    };
  }

  return suggestForSpec(domain, action, spec, tokens.slice(2), trailingSpace, raw, ctx);
}

// ── Suggest for a matched command spec ──────────────────────────────────────

function suggestForSpec(
  domain: string,
  action: string,
  spec: CommandSpec,
  argTokens: string[],
  trailingSpace: boolean,
  raw: string,
  ctx: DataContext,
): SuggestionResult {
  const usage = usageString(spec);

  // Extract explicitly provided flag names (not defaults from parse)
  const explicitFlagNames = new Set(
    argTokens
      .filter(t => t.startsWith('--'))
      .map(t => { const eq = t.indexOf('='); return eq > 0 ? t.slice(2, eq) : t.slice(2); })
  );
  const explicitFlags = Object.fromEntries([...explicitFlagNames].map(n => [n, true]));

  // Count positionals (non-flag tokens)
  const positionals = argTokens.filter(t => !t.startsWith('--'));
  const argIdx = trailingSpace ? positionals.length : Math.max(positionals.length - 1, 0);
  const partial = (!trailingSpace && positionals.length > 0) ? positionals[positionals.length - 1] : '';

  // Try parsing the full input
  const result = parse(raw);

  if (!isParseError(result)) {
    const suggestions: SuggestionItem[] = [];

    // If last token is a positional without trailing space, show value suggestions
    if (!trailingSpace && positionals.length > 0) {
      const lastArgIdx = positionals.length - 1;
      if (lastArgIdx < spec.args.length) {
        suggestions.push(
          ...argValueSuggestions(domain, action, spec.args[lastArgIdx].name, partial, ctx)
        );
      }
    }

    // Show flags not explicitly typed (defaults don't count as "used")
    suggestions.push(...unusedFlags(spec, explicitFlags));

    return {
      valid: true,
      parsed: result,
      usage,
      suggestions,
    };
  }

  // Parse error — contextual suggestions
  const suggestions: SuggestionItem[] = [];

  // Suggest arg values if we still need positional args
  if (argIdx < spec.args.length) {
    const argSpec = spec.args[argIdx];
    suggestions.push(...argValueSuggestions(domain, action, argSpec.name, partial, ctx));
  }

  // Suggest flags not explicitly typed
  suggestions.push(...unusedFlags(spec, explicitFlags));

  return {
    valid: false,
    error: result.error,
    usage,
    suggestions,
  };
}

// ── Arg value suggestions ───────────────────────────────────────────────────

function argValueSuggestions(
  domain: string,
  action: string,
  argName: string,
  partial: string,
  ctx: DataContext,
): SuggestionItem[] {
  const lower = partial.toLowerCase();

  if (argName === 'project_id' && ctx.projects) {
    return ctx.projects
      .filter(p => !lower || p.id.toLowerCase().includes(lower) || p.name.toLowerCase().includes(lower))
      .slice(0, 8)
      .map(p => ({
        text: `/${domain} ${action} ${p.id}`,
        label: p.name,
        description: p.id.slice(0, 12),
        category: 'value' as const,
      }));
  }

  if (argName === 'id' && domain === 'snippet' && ctx.snippets) {
    return ctx.snippets
      .filter(s => !lower || s.id.toLowerCase().includes(lower) || s.name.toLowerCase().includes(lower))
      .slice(0, 8)
      .map(s => ({
        text: `/${domain} ${action} ${s.id}`,
        label: s.name,
        description: s.id.slice(0, 12),
        category: 'value' as const,
      }));
  }

  if (argName === 'provider_model' && ctx.models) {
    return ctx.models
      .filter(m => !lower || `${m.name}:${m.model}`.toLowerCase().includes(lower))
      .slice(0, 8)
      .map(m => ({
        text: `/${domain} ${action} ${m.name}:${m.model}`,
        label: `${m.name}:${m.model}`,
        description: m.configured ? 'configured' : 'not configured',
        category: 'value' as const,
        status: (m.configured ? 'configured' : 'not-configured') as SuggestionItem['status'],
      }));
  }

  if (argName === 'provider' && ctx.models) {
    return ctx.models
      .filter(m => !lower || m.name.toLowerCase().includes(lower))
      .slice(0, 8)
      .map(m => ({
        text: `/${domain} ${action} ${m.name}`,
        label: m.name,
        description: m.configured ? 'configured' : 'not configured',
        category: 'value' as const,
        status: (m.configured ? 'configured' : 'not-configured') as SuggestionItem['status'],
      }));
  }

  if (argName === 'agent_id' && ctx.agents) {
    return ctx.agents
      .filter(a => !lower || a.id.toLowerCase().includes(lower) || a.machine_name.toLowerCase().includes(lower))
      .slice(0, 8)
      .map(a => ({
        text: `/${domain} ${action} ${a.id}`,
        label: a.machine_name,
        description: a.id.slice(0, 12),
        category: 'value' as const,
        status: a.status as SuggestionItem['status'],
      }));
  }

  return [];
}

// ── Unused flags ────────────────────────────────────────────────────────────

function unusedFlags(spec: CommandSpec, used: Record<string, unknown>): SuggestionItem[] {
  if (!spec.flags) return [];
  return spec.flags
    .filter(f => !(f.name in used))
    .map(f => ({
      text: `--${f.name}=`,
      label: `--${f.name}`,
      description: flagDescription(f),
      category: 'flag' as const,
    }));
}

function flagDescription(f: FlagSpec): string {
  const parts: string[] = [];
  if (f.description) parts.push(f.description);
  parts.push(f.type);
  if (f.required) parts.push('required');
  if (f.default !== undefined) parts.push(`default: ${f.default}`);
  return parts.join(' · ');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function domainSuggestions(): SuggestionItem[] {
  return getDomains().map(d => ({
    text: `/${d} `,
    label: d,
    description: DOMAIN_DESC[d],
    category: 'domain' as const,
  }));
}

function actionSuggestions(domain: string, actions: string[]): SuggestionItem[] {
  return actions.map(a => {
    const spec = getCommandSpec(domain, a);
    return {
      text: `/${domain} ${a} `,
      label: a,
      description: spec?.description,
      category: 'action' as const,
    };
  });
}

// ── Tokenizer (simple, for suggestion positioning) ──────────────────────────

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const ch of input) {
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}
