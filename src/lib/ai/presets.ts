// 大模型 Provider 预设表
// 所有 provider 均通过 OpenAI 兼容接口调用（/chat/completions + Bearer token）

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  models: string[];
  keyHint: string;
  keyPlaceholder: string;
  docsUrl: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek (深度求索)",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyHint: "格式 sk-xxxxxxxx",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "moonshot",
    label: "Kimi (Moonshot AI)",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "kimi-k3-0905-preview",
    models: [
      "kimi-k3-0905-preview",
      "kimi-k3-turbo-preview",
      "kimi-k2-0905-preview",
      "kimi-k2-turbo-preview",
      "moonshot-v1-8k",
      "moonshot-v1-32k",
      "moonshot-v1-128k",
    ],
    keyHint: "格式 sk-xxxxxxxx",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.moonshot.cn/console/api-keys",
  },
  {
    id: "qwen",
    label: "通义千问 (阿里云)",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    models: [
      "qwen-turbo",
      "qwen-plus",
      "qwen-max",
      "qwen-long",
      "qwen2.5-72b-instruct",
      "qwen3-235b-a22b",
      "qwen3-32b",
    ],
    keyHint: "格式 sk-xxxxxxxx",
    keyPlaceholder: "sk-...",
    docsUrl: "https://bailian.console.aliyun.com/?apiKey=1#/api-key",
  },
  {
    id: "zhipu",
    label: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-flash",
    models: ["glm-4-flash", "glm-4", "glm-4-plus", "glm-4-air", "glm-4-airx"],
    keyHint: "格式 xxxxxxxx.yyyyyyyy",
    keyPlaceholder: "id.secret",
    docsUrl: "https://open.bigmodel.cn/usercenter/apikeys",
  },
  {
    id: "openai",
    label: "OpenAI (GPT)",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
    keyHint: "格式 sk-xxxxxxxx",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-1.5-flash",
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash", "gemini-2.5-flash"],
    keyHint: "格式 AIzaxxxxxxxx",
    keyPlaceholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
];

export function getProviderPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}
