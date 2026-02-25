// Per-tenant model registry.
// Tracks provider configuration, available models, and tenant overrides.
// Backed by environment variables (global config) + Firestore (per-tenant overrides).

import {
  loadLLMConfig,
  isValidProvider,
  type ProviderName,
  type ProviderConfig,
} from "./config";
import { getSetting, upsertSetting } from "../firestore/settings";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ModelEntry {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface ProviderStatus {
  provider: ProviderName;
  configured: boolean;
  models: ModelEntry[];
}

export interface RegistrySnapshot {
  defaultProvider: ProviderName;
  selectedProvider: ProviderName | null;
  selectedModel: string | null;
  providers: ProviderStatus[];
}

export interface TenantOverride {
  provider: ProviderName;
  model: string;
  updated_at: number;
}

// ── Well-known models per provider ──────────────────────────────────────────

const KNOWN_MODELS: Record<ProviderName, string[]> = {
  gemini: [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
  ],
  openai: [
    "gpt-4.1-mini",
    "gpt-4.1",
    "gpt-4o",
    "gpt-4o-mini",
    "o3-mini",
  ],
  anthropic: [
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
    "claude-opus-4-6",
  ],
};

// ── Settings key helpers ────────────────────────────────────────────────────

function tenantSettingsKey(tenantId?: string): string {
  return tenantId ? `execution_llm:${tenantId}` : "execution_llm";
}

// ── Registry functions ──────────────────────────────────────────────────────

/**
 * Build a full snapshot of provider status and available models.
 * Includes tenant-specific overrides if a tenantId is provided.
 */
export async function getRegistrySnapshot(
  tenantId?: string,
): Promise<RegistrySnapshot> {
  const config = loadLLMConfig();
  const setting = await getSetting(tenantSettingsKey(tenantId)).catch(
    () => null,
  );

  const selectedProvider =
    setting && typeof setting.provider === "string" && isValidProvider(setting.provider)
      ? (setting.provider as ProviderName)
      : null;
  const selectedModel =
    setting && typeof setting.model === "string" ? (setting.model as string) : null;

  const providers: ProviderStatus[] = (
    Object.entries(config.providers) as [ProviderName, ProviderConfig][]
  ).map(([name, pc]) => {
    const knownIds = KNOWN_MODELS[name] ?? [];
    // Ensure the configured model appears in the list
    const allIds = knownIds.includes(pc.model)
      ? knownIds
      : [pc.model, ...knownIds];

    const models: ModelEntry[] = allIds.map((id) => ({
      id,
      name: id,
      isDefault: id === pc.model,
    }));

    return { provider: name, configured: pc.configured, models };
  });

  return {
    defaultProvider: config.defaultProvider as ProviderName,
    selectedProvider,
    selectedModel,
    providers,
  };
}

/**
 * Get the status summary for all providers (lightweight, no tenant overrides).
 */
export function getProviderStatuses(): ProviderStatus[] {
  const config = loadLLMConfig();
  return (
    Object.entries(config.providers) as [ProviderName, ProviderConfig][]
  ).map(([name, pc]) => {
    const knownIds = KNOWN_MODELS[name] ?? [];
    const allIds = knownIds.includes(pc.model)
      ? knownIds
      : [pc.model, ...knownIds];

    return {
      provider: name,
      configured: pc.configured,
      models: allIds.map((id) => ({
        id,
        name: id,
        isDefault: id === pc.model,
      })),
    };
  });
}

/**
 * Save a tenant-specific provider/model override.
 * Throws if the provider is unknown or not configured.
 */
export async function setTenantOverride(
  provider: string,
  model: string,
  tenantId?: string,
): Promise<TenantOverride> {
  if (!isValidProvider(provider)) {
    throw new RegistryError(`Unknown provider: ${provider}`);
  }

  const config = loadLLMConfig();
  if (!config.providers[provider].configured) {
    throw new RegistryError(
      `Provider "${provider}" is not configured — missing API key`,
    );
  }

  const override: TenantOverride = {
    provider,
    model,
    updated_at: Date.now(),
  };

  await upsertSetting(tenantSettingsKey(tenantId), override as unknown as Record<string, unknown>);
  return override;
}

/**
 * Resolve the effective provider name and config for execution.
 * Checks tenant override first, falls back to global default.
 * Throws if the resolved provider is not configured.
 */
export async function resolveProvider(
  requestProvider?: string,
  requestModel?: string,
  tenantId?: string,
): Promise<{ providerName: ProviderName; model: string; config: ProviderConfig }> {
  const llmConfig = loadLLMConfig();

  // 1. Explicit request override
  if (requestProvider && isValidProvider(requestProvider)) {
    const pc = llmConfig.providers[requestProvider];
    if (!pc.configured) {
      throw new RegistryError(
        `Provider "${requestProvider}" is not configured — missing API key`,
      );
    }
    return {
      providerName: requestProvider,
      model: requestModel || pc.model,
      config: requestModel ? { ...pc, model: requestModel } : pc,
    };
  }

  // 2. Tenant override from Firestore
  const setting = await getSetting(tenantSettingsKey(tenantId)).catch(
    () => null,
  );
  if (
    setting &&
    typeof setting.provider === "string" &&
    isValidProvider(setting.provider)
  ) {
    const pc = llmConfig.providers[setting.provider];
    if (pc.configured) {
      const model =
        requestModel || (typeof setting.model === "string" ? setting.model : pc.model);
      return {
        providerName: setting.provider,
        model,
        config: { ...pc, model },
      };
    }
    // Tenant override points to an unconfigured provider — fall through
  }

  // 3. Global default
  const defaultName = llmConfig.defaultProvider as ProviderName;
  const pc = llmConfig.providers[defaultName];
  if (!pc.configured) {
    throw new RegistryError("No LLM provider is configured — set at least one API key");
  }
  return {
    providerName: defaultName,
    model: requestModel || pc.model,
    config: requestModel ? { ...pc, model: requestModel } : pc,
  };
}

/**
 * Check whether a specific provider is configured and ready for execution.
 */
export function isProviderReady(provider: string): boolean {
  if (!isValidProvider(provider)) return false;
  const config = loadLLMConfig();
  return config.providers[provider].configured;
}

/**
 * Guard that throws if no provider is available for execution.
 * Call before any LLM operation to get a clear error early.
 */
export function requireConfiguredProvider(provider: string): void {
  if (!isValidProvider(provider)) {
    throw new RegistryError(`Unknown provider: ${provider}`);
  }
  const config = loadLLMConfig();
  if (!config.providers[provider].configured) {
    throw new RegistryError(
      `Cannot execute: provider "${provider}" is not configured. ` +
        `Set the ${provider.toUpperCase()}_API_KEY environment variable.`,
    );
  }
}

// ── Error type ──────────────────────────────────────────────────────────────

export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryError";
  }
}
