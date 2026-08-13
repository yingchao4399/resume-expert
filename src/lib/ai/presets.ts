export type StructuredOutputStrategy = "json-schema" | "json-object" | "prompt-json";

export interface ProviderCapabilityPolicy {
  structuredOutput: StructuredOutputStrategy;
  supportsModelCatalog: boolean;
  maxTokenParameter: "max_tokens" | "max_completion_tokens" | "model-dependent";
  samplingParameters: "standard" | "model-dependent";
}

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  recommendedModel: string;
  /** Kept for existing callers. */
  model: string;
  models: string[];
  legacyModels: string[];
  keyHint: string;
  keyPlaceholder: string;
  docsUrl: string;
  modelDocsUrl: string;
  catalogUpdatedAt: string;
  capability: ProviderCapabilityPolicy;
}

const updatedAt = "2026-08-14";
const jsonObjectPolicy: ProviderCapabilityPolicy = {
  structuredOutput: "json-object",
  supportsModelCatalog: true,
  maxTokenParameter: "max_tokens",
  samplingParameters: "standard",
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek（深度求索）",
    baseUrl: "https://api.deepseek.com/v1",
    recommendedModel: "deepseek-v4-flash",
    model: "deepseek-v4-flash",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"],
    legacyModels: ["deepseek-chat", "deepseek-reasoner"],
    keyHint: "格式 sk-xxxxxxxx",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
    modelDocsUrl: "https://api-docs.deepseek.com/quick_start/pricing/",
    catalogUpdatedAt: updatedAt,
    capability: jsonObjectPolicy,
  },
  {
    id: "moonshot",
    label: "Kimi（Moonshot AI）",
    baseUrl: "https://api.moonshot.cn/v1",
    recommendedModel: "kimi-k3",
    model: "kimi-k3",
    models: ["kimi-k3", "kimi-k2.6", "kimi-k2.5"],
    legacyModels: ["kimi-k3-0905-preview", "kimi-k3-turbo-preview", "kimi-k2-0905-preview", "kimi-k2-turbo-preview", "moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    keyHint: "格式 sk-xxxxxxxx",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.moonshot.cn/console/api-keys",
    modelDocsUrl: "https://platform.kimi.ai/docs/models",
    catalogUpdatedAt: updatedAt,
    capability: jsonObjectPolicy,
  },
  {
    id: "qwen",
    label: "通义千问（阿里云百炼）",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    recommendedModel: "qwen3.7-plus",
    model: "qwen3.7-plus",
    models: ["qwen3.7-plus", "qwen3.8-max", "qwen3.7-flash", "qwen-long"],
    legacyModels: ["qwen-turbo", "qwen-plus", "qwen-max", "qwen2.5-72b-instruct", "qwen3-235b-a22b", "qwen3-32b"],
    keyHint: "格式 sk-xxxxxxxx",
    keyPlaceholder: "sk-...",
    docsUrl: "https://bailian.console.aliyun.com/?apiKey=1#/api-key",
    modelDocsUrl: "https://help.aliyun.com/zh/model-studio/text-generation-model/",
    catalogUpdatedAt: updatedAt,
    capability: jsonObjectPolicy,
  },
  {
    id: "zhipu",
    label: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    recommendedModel: "glm-5.2",
    model: "glm-5.2",
    models: ["glm-5.2", "glm-5.1", "glm-5", "glm-5-turbo", "glm-4.7"],
    legacyModels: ["glm-4-flash", "glm-4", "glm-4-plus", "glm-4-air", "glm-4-airx"],
    keyHint: "格式 xxxxxxxx.yyyyyyyy",
    keyPlaceholder: "id.secret",
    docsUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    modelDocsUrl: "https://docs.bigmodel.cn/cn/guide/start/model-overview",
    catalogUpdatedAt: updatedAt,
    capability: jsonObjectPolicy,
  },
  {
    id: "openai",
    label: "OpenAI（GPT）",
    baseUrl: "https://api.openai.com/v1",
    recommendedModel: "gpt-5.6-luna",
    model: "gpt-5.6-luna",
    models: ["gpt-5.6-luna", "gpt-5.6", "gpt-5.6-terra", "gpt-5.4-mini", "gpt-4.1-mini"],
    legacyModels: ["gpt-4o-mini", "gpt-4o", "gpt-4.1"],
    keyHint: "格式 sk-xxxxxxxx",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
    modelDocsUrl: "https://developers.openai.com/api/docs/models/all",
    catalogUpdatedAt: updatedAt,
    capability: {
      structuredOutput: "json-schema",
      supportsModelCatalog: true,
      maxTokenParameter: "model-dependent",
      samplingParameters: "model-dependent",
    },
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    recommendedModel: "gemini-3.6-flash",
    model: "gemini-3.6-flash",
    models: ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro-preview", "gemini-2.5-flash", "gemini-2.5-pro"],
    legacyModels: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"],
    keyHint: "格式 AIzaxxxxxxxx",
    keyPlaceholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    modelDocsUrl: "https://ai.google.dev/gemini-api/docs/models",
    catalogUpdatedAt: updatedAt,
    capability: jsonObjectPolicy,
  },
  {
    id: "custom",
    label: "自定义 OpenAI 兼容",
    baseUrl: "",
    recommendedModel: "",
    model: "",
    models: [],
    legacyModels: [],
    keyHint: "填写兼容服务提供的 API Key",
    keyPlaceholder: "API Key",
    docsUrl: "",
    modelDocsUrl: "",
    catalogUpdatedAt: updatedAt,
    capability: jsonObjectPolicy,
  },
];

export function getProviderPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((preset) => preset.id === id);
}

export function getStructuredOutputStrategy(provider: string): StructuredOutputStrategy {
  return getProviderPreset(provider)?.capability.structuredOutput ?? "json-object";
}
