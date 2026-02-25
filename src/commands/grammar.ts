// Slash command parser. Returns structured objects only — no execution.

export interface ParsedCommand {
  domain: string;
  action: string;
  args: Record<string, string>;
}

export interface ParseError {
  error: string;
  input: string;
}

export type ParseResult = ParsedCommand | ParseError;

export function isParseError(result: ParseResult): result is ParseError {
  return "error" in result;
}

// domain -> action -> arg names (ordered positional args)
const GRAMMAR: Record<string, Record<string, string[]>> = {
  project: {
    new: ["name"],
    list: [],
  },
  prompt: {
    new: [],
    ready: [],
    done: [],
  },
  snippet: {
    list: [],
    show: [],
    select: ["id"],
  },
  model: {
    list: [],
    use: ["provider_model"],  // "provider:model"
  },
  agent: {
    list: [],
    use: ["agent_id"],
  },
  logs: {
    project: [],
    prompt: ["id"],
    snippet: [],
    agent: [],
    diff: ["event_id"],
  },
  restore: {
    _default: ["event_id"],  // /restore <event_id> (no sub-action)
  },
};

export function parse(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return { error: "Command must start with /", input: trimmed };
  }

  const tokens = tokenize(trimmed.slice(1)); // drop leading /
  if (tokens.length === 0) {
    return { error: "Empty command", input: trimmed };
  }

  const domain = tokens[0].toLowerCase();
  const actions = GRAMMAR[domain];
  if (!actions) {
    return { error: `Unknown command domain: ${domain}`, input: trimmed };
  }

  // Handle domains with _default (no sub-action, e.g. /restore <event_id>)
  if ("_default" in actions) {
    const argNames = actions._default;
    const argTokens = tokens.slice(1);
    const args = buildArgs(argNames, argTokens);
    if (typeof args === "string") {
      return { error: args, input: trimmed };
    }
    return { domain, action: domain, args };
  }

  if (tokens.length < 2) {
    const available = Object.keys(actions).join(", ");
    return { error: `Missing action for /${domain}. Available: ${available}`, input: trimmed };
  }

  const action = tokens[1].toLowerCase();
  const argNames = actions[action];
  if (!argNames) {
    const available = Object.keys(actions).join(", ");
    return { error: `Unknown action: /${domain} ${action}. Available: ${available}`, input: trimmed };
  }

  const argTokens = tokens.slice(2);
  const args = buildArgs(argNames, argTokens);
  if (typeof args === "string") {
    return { error: args, input: trimmed };
  }

  return { domain, action, args };
}

function buildArgs(
  names: string[],
  tokens: string[]
): Record<string, string> | string {
  const args: Record<string, string> = {};

  for (let i = 0; i < names.length; i++) {
    if (i >= tokens.length) {
      return `Missing required argument: <${names[i]}>`;
    }
    // Last named arg consumes all remaining tokens (for names with spaces)
    if (i === names.length - 1 && tokens.length > names.length) {
      args[names[i]] = tokens.slice(i).join(" ");
    } else {
      args[names[i]] = tokens[i];
    }
  }

  return args;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

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
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current) tokens.push(current);
  return tokens;
}
