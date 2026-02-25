import { LLMProvider } from "./provider";
import { ProviderConfig, ProviderName } from "./config";
import { GeminiProvider } from "./providers/gemini";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";

export function createProvider(name: ProviderName, config: ProviderConfig): LLMProvider {
  if (!config.configured) {
    throw new Error(`Provider "${name}" is not configured — missing API key`);
  }

  switch (name) {
    case "gemini":
      return new GeminiProvider(config.apiKey, config.model);
    case "openai":
      return new OpenAIProvider(config.apiKey, config.model);
    case "anthropic":
      return new AnthropicProvider(config.apiKey, config.model);
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}
