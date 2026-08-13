import type { AIMode } from "@/lib/ai/types";
import {
  isValidAPIKey,
  maskApiKey,
  normalizeAPIKey,
  readUserConfig,
} from "@/lib/ai/user-config";

export interface AIConfig {
  mode: AIMode;
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: string;
  invalidApiKey: boolean;
}

export function getAIConfig(): AIConfig {
  const userConfig = readUserConfig();
  const rawApiKey =
    userConfig?.apiKey || process.env.LLM_API_KEY?.trim() || "";
  const normalizedApiKey = normalizeAPIKey(rawApiKey);
  const invalidApiKey =
    Boolean(normalizedApiKey) && !isValidAPIKey(normalizedApiKey);
  const apiKey = invalidApiKey ? "" : normalizedApiKey;
  const baseUrlRaw =
    userConfig?.baseUrl ||
    process.env.LLM_BASE_URL?.trim() ||
    "https://api.openai.com/v1";
  const model =
    userConfig?.model || process.env.LLM_MODEL?.trim() || "gpt-5.6-luna";
  const provider =
    userConfig?.provider ||
    process.env.LLM_PROVIDER?.trim() ||
    "openai";

  const forceMock =
    userConfig?.useMock === true || process.env.USE_MOCK_AI === "true";
  const mode: AIMode = !forceMock && apiKey ? "llm" : "mock";

  return {
    mode,
    apiKey,
    baseUrl: baseUrlRaw.replace(/\/$/, ""),
    model,
    provider,
    invalidApiKey,
  };
}

export function getPublicAIStatus() {
  const config = getAIConfig();
  const userConfig = readUserConfig();
  const forceMock =
    userConfig?.useMock === true || process.env.USE_MOCK_AI === "true";

  return {
    mode: config.mode,
    model: config.mode === "llm" ? config.model : undefined,
    provider: config.mode === "llm" ? config.provider : undefined,
    reason:
      config.mode === "mock"
        ? forceMock
          ? "forced"
          : config.invalidApiKey
            ? "invalid_api_key"
            : !config.apiKey
              ? "missing_api_key"
              : undefined
        : undefined,
  };
}

export function getPublicAIConfig() {
  const userConfig = readUserConfig();
  const config = getAIConfig();
  const rawApiKey =
    userConfig?.apiKey || process.env.LLM_API_KEY?.trim() || "";
  const apiKeySource = userConfig?.apiKey
    ? "user"
    : process.env.LLM_API_KEY
      ? "env"
      : "none";

  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    mode: config.mode,
    useMock:
      userConfig?.useMock === true || process.env.USE_MOCK_AI === "true",
    hasApiKey: Boolean(config.apiKey),
    invalidApiKey: config.invalidApiKey,
    apiKeyMasked: maskApiKey(rawApiKey),
    apiKeySource,
  };
}
