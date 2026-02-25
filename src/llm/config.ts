// LLM provider configuration from environment variables

export interface ProviderConfig {
  apiKey: string;
  model: string;
  configured: boolean;
}

export interface LLMConfig {
  defaultProvider: string;
  providers: {
    gemini: ProviderConfig;
    openai: ProviderConfig;
    anthropic: ProviderConfig;
  };
}

export type ProviderName = "gemini" | "openai" | "anthropic";

const PROVIDER_NAMES: ProviderName[] = ["gemini", "openai", "anthropic"];

export function isValidProvider(name: string): name is ProviderName {
  return PROVIDER_NAMES.includes(name as ProviderName);
}

function isRealKey(key: string): boolean {
  return !!key && key !== "not-set" && key !== "placeholder";
}

export function loadLLMConfig(): LLMConfig {
  const geminiKey = process.env.GEMINI_API_KEY || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";
  const anthropicKey = process.env.ANTHROPIC_API_KEY || "";

  const providers = {
    gemini: {
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      configured: isRealKey(geminiKey),
    },
    openai: {
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      configured: isRealKey(openaiKey),
    },
    anthropic: {
      apiKey: anthropicKey,
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      configured: isRealKey(anthropicKey),
    },
  };

  let defaultProvider = process.env.DEFAULT_LLM_PROVIDER || "";
  if (!defaultProvider || !isValidProvider(defaultProvider) || !providers[defaultProvider].configured) {
    // Pick first configured provider
    const first = PROVIDER_NAMES.find((n) => providers[n].configured);
    defaultProvider = first || "gemini";
  }

  return { defaultProvider, providers };
}
