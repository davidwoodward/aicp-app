// Slash command grammar engine — typed args, flags, validation. Parse only, no execution.

// ── Spec types ──────────────────────────────────────────────────────────────

export interface ArgSpec {
  name: string;
  required: boolean;
  description?: string;
}

export type FlagType = "string" | "number" | "boolean" | "duration";

export interface FlagSpec {
  name: string;
  type: FlagType;
  required?: boolean;
  default?: string | number | boolean;
  description?: string;
}

export interface CommandSpec {
  name: string;
  args: ArgSpec[];
  flags?: FlagSpec[];
  requiresContext?: boolean;
  contextKeys?: string[];
  description?: string;
}

// ── Result types ────────────────────────────────────────────────────────────

export type FlagValue = string | number | boolean;

export interface ParsedCommand {
  domain: string;
  action: string;
  args: Record<string, string>;
  flags: Record<string, FlagValue>;
  requiresContext: boolean;
  contextKeys: string[];
  raw: string;
}

export interface ParseError {
  error: string;
  input: string;
  domain?: string;
  action?: string;
  suggestions?: string[];
}

export type ParseResult = ParsedCommand | ParseError;

// ── Token types ─────────────────────────────────────────────────────────────

type TokenKind = "positional" | "flag_name" | "flag_value_attached";

interface Token {
  kind: TokenKind;
  value: string;
}

// ── Grammar definition ──────────────────────────────────────────────────────

// domain -> action -> CommandSpec ("_default" means no sub-action)
const GRAMMAR: Record<string, Record<string, CommandSpec>> = {
  project: {
    new: {
      name: "project new",
      args: [{ name: "name", required: true }],
      description: "Create a new project",
    },
    list: {
      name: "project list",
      args: [],
      flags: [
        { name: "limit", type: "number", default: 20, description: "Max results" },
        { name: "offset", type: "number", default: 0, description: "Skip N results" },
      ],
      description: "List projects",
    },
    switch: {
      name: "project switch",
      args: [{ name: "project_id", required: true }],
      description: "Switch active project",
    },
  },
  prompt: {
    new: {
      name: "prompt new",
      args: [],
      requiresContext: true,
      contextKeys: ["project_id"],
      description: "Create a new prompt",
    },
    ready: {
      name: "prompt ready",
      args: [{ name: "prompt_id", required: true }],
      requiresContext: true,
      contextKeys: ["project_id"],
      description: "Mark prompt as ready",
    },
    done: {
      name: "prompt done",
      args: [{ name: "prompt_id", required: true }],
      requiresContext: true,
      contextKeys: ["project_id"],
      description: "Mark prompt as done",
    },
    move: {
      name: "prompt move",
      args: [{ name: "prompt_id", required: true }],
      flags: [{ name: "parent", type: "string", required: true, description: "New parent ID" }],
      requiresContext: true,
      contextKeys: ["project_id"],
      description: "Move prompt under a new parent",
    },
  },
  snippet: {
    list: {
      name: "snippet list",
      args: [],
      flags: [{ name: "limit", type: "number", default: 20, description: "Max results" }],
      description: "List snippets",
    },
    show: {
      name: "snippet show",
      args: [{ name: "id", required: true }],
      description: "Show snippet details",
    },
    select: {
      name: "snippet select",
      args: [{ name: "id", required: true }],
      description: "Select a snippet",
    },
    create: {
      name: "snippet create",
      args: [{ name: "title", required: true }],
      flags: [{ name: "body", type: "string", required: true, description: "Snippet body text" }],
      description: "Create a snippet",
    },
  },
  model: {
    list: {
      name: "model list",
      args: [],
      description: "List available models",
    },
    use: {
      name: "model use",
      args: [{ name: "provider_model", required: true }],
      description: "Select a model (provider:model)",
    },
    config: {
      name: "model config",
      args: [{ name: "provider", required: true }],
      description: "Configure a model provider",
    },
  },
  agent: {
    list: {
      name: "agent list",
      args: [],
      description: "List available agents",
    },
    use: {
      name: "agent use",
      args: [{ name: "agent_id", required: true }],
      description: "Select an agent",
    },
  },
  logs: {
    project: {
      name: "logs project",
      args: [],
      flags: [
        { name: "since", type: "duration", description: "Time window (e.g. 1h, 7d)" },
        { name: "limit", type: "number", default: 50, description: "Max results" },
      ],
      requiresContext: true,
      contextKeys: ["project_id"],
      description: "View project logs",
    },
    prompt: {
      name: "logs prompt",
      args: [{ name: "id", required: true }],
      flags: [
        { name: "since", type: "duration", description: "Time window (e.g. 1h, 7d)" },
        { name: "limit", type: "number", default: 50, description: "Max results" },
      ],
      description: "View prompt logs",
    },
    snippet: {
      name: "logs snippet",
      args: [],
      flags: [
        { name: "since", type: "duration", description: "Time window (e.g. 1h, 7d)" },
        { name: "limit", type: "number", default: 20, description: "Max results" },
      ],
      description: "View snippet logs",
    },
    diff: {
      name: "logs diff",
      args: [{ name: "event_id", required: true }],
      description: "View event diff",
    },
  },
  restore: {
    _default: {
      name: "restore",
      args: [{ name: "event_id", required: true }],
      description: "Restore from an event",
    },
  },
};

// ── Tokenizer ───────────────────────────────────────────────────────────────

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  const flush = () => {
    if (!current) return;
    if (current.startsWith("--")) {
      const eqIdx = current.indexOf("=");
      if (eqIdx !== -1) {
        // --flag=value
        tokens.push({ kind: "flag_name", value: current.slice(2, eqIdx) });
        tokens.push({ kind: "flag_value_attached", value: current.slice(eqIdx + 1) });
      } else {
        tokens.push({ kind: "flag_name", value: current.slice(2) });
      }
    } else {
      tokens.push({ kind: "positional", value: current });
    }
    current = "";
  };

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
    } else if (ch === " " || ch === "\t") {
      flush();
    } else {
      current += ch;
    }
  }
  flush();

  return tokens;
}

// ── Duration parser ─────────────────────────────────────────────────────────

const DURATION_RE = /^\d+(m|h|d|w)$/;

const DURATION_MULTIPLIERS: Record<string, number> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

const MAX_DURATION_MS = 365 * 86_400_000; // 365 days

/** Parse a duration string like "1h", "7d" into milliseconds. Returns null on invalid input. */
export function parseDuration(value: string): number | null {
  if (!DURATION_RE.test(value)) return null;
  const unit = value[value.length - 1];
  const amount = parseInt(value.slice(0, -1), 10);
  if (amount <= 0) return null;
  const ms = amount * DURATION_MULTIPLIERS[unit];
  if (ms > MAX_DURATION_MS) return null;
  return ms;
}

// ── Flag coercion ───────────────────────────────────────────────────────────

function coerceFlag(
  spec: FlagSpec,
  raw: string | undefined,
  flagName: string
): { value: FlagValue } | { error: string } {
  // Boolean flags: bare --flag means true, or explicit true/false
  if (spec.type === "boolean") {
    if (raw === undefined) return { value: true };
    if (raw === "true") return { value: true };
    if (raw === "false") return { value: false };
    return { error: `Flag --${flagName} expects a boolean (true/false)` };
  }

  // Non-boolean flags require a value
  if (raw === undefined) {
    return { error: `Flag --${flagName} requires a value` };
  }

  if (spec.type === "number") {
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 0 || String(n) !== raw) {
      return { error: `Flag --${flagName} expects a non-negative integer, got "${raw}"` };
    }
    return { value: n };
  }

  if (spec.type === "duration") {
    if (!DURATION_RE.test(raw)) {
      return { error: `Flag --${flagName} expects a duration (e.g. 1h, 7d), got "${raw}"` };
    }
    return { value: raw };
  }

  // string
  return { value: raw };
}

// ── Main parser ─────────────────────────────────────────────────────────────

export function parse(input: string): ParseResult {
  const raw = input.trim();
  if (!raw.startsWith("/")) {
    return { error: "Command must start with /", input: raw };
  }

  const tokens = tokenize(raw.slice(1));
  if (tokens.length === 0) {
    return { error: "Empty command", input: raw };
  }

  // First positional = domain
  const domainToken = tokens.find((t) => t.kind === "positional");
  if (!domainToken) {
    return { error: "Empty command", input: raw };
  }
  const domain = domainToken.value.toLowerCase();
  const domainActions = GRAMMAR[domain];
  if (!domainActions) {
    return {
      error: `Unknown command domain: ${domain}`,
      input: raw,
      suggestions: getDomains(),
    };
  }

  // Remaining tokens after domain
  const rest = tokens.slice(1);

  // _default domains (no sub-action, e.g. /restore <event_id>)
  if ("_default" in domainActions) {
    return parseCommand(domain, domain, domainActions._default, rest, raw);
  }

  // Second positional = action
  const actionToken = rest.find((t) => t.kind === "positional");
  if (!actionToken) {
    return {
      error: `Missing action for /${domain}. Available: ${Object.keys(domainActions).join(", ")}`,
      input: raw,
      domain,
      suggestions: Object.keys(domainActions).map((a) => `/${domain} ${a}`),
    };
  }
  const action = actionToken.value.toLowerCase();
  const spec = domainActions[action];
  if (!spec) {
    return {
      error: `Unknown action: /${domain} ${action}. Available: ${Object.keys(domainActions).join(", ")}`,
      input: raw,
      domain,
      action,
      suggestions: Object.keys(domainActions).map((a) => `/${domain} ${a}`),
    };
  }

  // Remaining tokens after action
  const afterAction = rest.slice(rest.indexOf(actionToken) + 1);
  return parseCommand(domain, action, spec, afterAction, raw);
}

function parseCommand(
  domain: string,
  action: string,
  spec: CommandSpec,
  tokens: Token[],
  raw: string
): ParseResult {
  // Separate positionals and flags from the token stream
  const positionals: string[] = [];
  const flagPairs: Map<string, string | undefined> = new Map();

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === "positional") {
      positionals.push(t.value);
    } else if (t.kind === "flag_name") {
      // Check if next token is an attached value
      const next = tokens[i + 1];
      if (next && next.kind === "flag_value_attached") {
        flagPairs.set(t.value, next.value);
        i++; // skip attached value
      } else {
        // Lookahead: if the flag is not boolean type and next token is positional, consume it
        const flagSpec = (spec.flags ?? []).find((f) => f.name === t.value);
        if (flagSpec && flagSpec.type !== "boolean" && next && next.kind === "positional") {
          flagPairs.set(t.value, next.value);
          i++; // skip consumed positional
        } else {
          flagPairs.set(t.value, undefined); // bare flag (boolean)
        }
      }
    } else if (t.kind === "flag_value_attached") {
      // Orphaned attached value — shouldn't happen with correct tokenization
      positionals.push(t.value);
    }
  }

  // Match positionals to ArgSpec[]
  const args: Record<string, string> = {};
  const requiredArgs = spec.args.filter((a) => a.required);

  for (let i = 0; i < spec.args.length; i++) {
    const argSpec = spec.args[i];
    if (i >= positionals.length) {
      if (argSpec.required) {
        return {
          error: `Missing required argument: <${argSpec.name}>`,
          input: raw,
          domain,
          action,
          suggestions: [usageString(spec)],
        };
      }
      continue;
    }
    // Last arg consumes remainder
    if (i === spec.args.length - 1 && positionals.length > spec.args.length) {
      args[argSpec.name] = positionals.slice(i).join(" ");
    } else {
      args[argSpec.name] = positionals[i];
    }
  }

  // Coerce and validate flags
  const flags: Record<string, FlagValue> = {};
  const specFlags = spec.flags ?? [];
  const knownFlagNames = new Set(specFlags.map((f) => f.name));

  // Check for unknown flags
  for (const [name] of flagPairs) {
    if (!knownFlagNames.has(name)) {
      return {
        error: `Unknown flag: --${name}`,
        input: raw,
        domain,
        action,
        suggestions: specFlags.length > 0
          ? specFlags.map((f) => `--${f.name}`)
          : undefined,
      };
    }
  }

  for (const flagSpec of specFlags) {
    const provided = flagPairs.has(flagSpec.name);
    const rawValue = flagPairs.get(flagSpec.name);

    if (!provided) {
      if (flagSpec.required) {
        return {
          error: `Missing required flag: --${flagSpec.name}`,
          input: raw,
          domain,
          action,
          suggestions: [usageString(spec)],
        };
      }
      if (flagSpec.default !== undefined) {
        flags[flagSpec.name] = flagSpec.default;
      }
      continue;
    }

    const result = coerceFlag(flagSpec, rawValue, flagSpec.name);
    if ("error" in result) {
      return { error: result.error, input: raw, domain, action };
    }
    flags[flagSpec.name] = result.value;
  }

  return {
    domain,
    action,
    args,
    flags,
    requiresContext: spec.requiresContext ?? false,
    contextKeys: spec.contextKeys ?? [],
    raw,
  };
}

// ── Type guard ──────────────────────────────────────────────────────────────

export function isParseError(result: ParseResult): result is ParseError {
  return "error" in result;
}

// ── Autocomplete helpers ────────────────────────────────────────────────────

/** Returns all registered domain names. */
export function getDomains(): string[] {
  return Object.keys(GRAMMAR);
}

/** Returns action names for a given domain, or empty array if domain is unknown. */
export function getActions(domain: string): string[] {
  const actions = GRAMMAR[domain.toLowerCase()];
  if (!actions) return [];
  return Object.keys(actions).filter((k) => k !== "_default");
}

/** Returns the CommandSpec for a domain/action, or undefined if not found. */
export function getCommandSpec(
  domain: string,
  action?: string
): CommandSpec | undefined {
  const domainActions = GRAMMAR[domain.toLowerCase()];
  if (!domainActions) return undefined;
  if (action) return domainActions[action.toLowerCase()];
  return domainActions._default;
}

/** Generate a usage string like `/project new <name> [--limit=N]`. */
export function usageString(spec: CommandSpec): string {
  const parts = [`/${spec.name}`];
  for (const arg of spec.args) {
    parts.push(arg.required ? `<${arg.name}>` : `[${arg.name}]`);
  }
  for (const flag of spec.flags ?? []) {
    const valHint = flag.type === "boolean" ? "" : `=<${flag.type}>`;
    if (flag.required) {
      parts.push(`--${flag.name}${valHint}`);
    } else {
      parts.push(`[--${flag.name}${valHint}]`);
    }
  }
  return parts.join(" ");
}
