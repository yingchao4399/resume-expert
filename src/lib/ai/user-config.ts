import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = path.join(process.cwd(), ".ai-user-config.json");

export interface UserAIConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  useMock: boolean;
}

const DEFAULT_USER_CONFIG: UserAIConfig = {
  provider: "",
  apiKey: "",
  baseUrl: "",
  model: "",
  useMock: false,
};

let cachedConfig: UserAIConfig | null = null;

export function normalizeAPIKey(value: string): string {
  let normalized = value.trim().replace(/^Bearer\s+/i, "").trim();
  if (
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

export function getAPIKeyValidationError(value: string): string | null {
  const normalized = normalizeAPIKey(value);
  if (!normalized) return "请填写 API Key";
  if (!/^[\x21-\x7E]+$/.test(normalized)) {
    return "API Key 只能包含英文、数字和 ASCII 符号，不能包含中文、全角符号或空格";
  }
  if (normalized.length < 8) {
    return "API Key 长度过短，请粘贴服务商控制台生成的完整 Key";
  }
  if (/^(?:sk-?x+|api[-_ ]?key|your[-_ ]?key)$/i.test(normalized)) {
    return "当前内容是示例占位符，请填写真实 API Key";
  }
  return null;
}

export function isValidAPIKey(value: string): boolean {
  return getAPIKeyValidationError(value) === null;
}

export function readUserConfig(): UserAIConfig | null {
  if (cachedConfig !== null) return cachedConfig;
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      cachedConfig = null;
      return null;
    }
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<UserAIConfig>;
    cachedConfig = {
      provider: parsed.provider?.trim() || "",
      apiKey: normalizeAPIKey(parsed.apiKey || ""),
      baseUrl: parsed.baseUrl?.trim() || "",
      model: parsed.model?.trim() || "",
      useMock: parsed.useMock === true,
    };
    return cachedConfig;
  } catch {
    cachedConfig = null;
    return null;
  }
}

export function saveUserConfig(config: UserAIConfig): UserAIConfig {
  const normalized: UserAIConfig = {
    provider: config.provider?.trim() || "",
    apiKey: normalizeAPIKey(config.apiKey || ""),
    baseUrl: config.baseUrl?.trim() || "",
    model: config.model?.trim() || "",
    useMock: config.useMock === true,
  };
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify(normalized, null, 2),
    "utf-8"
  );
  cachedConfig = normalized;
  return normalized;
}

export function maskApiKey(key: string): string {
  const normalized = normalizeAPIKey(key);
  if (!normalized) return "";
  if (!isValidAPIKey(normalized)) return "格式错误";
  if (normalized.length <= 8) return "****";
  return `${normalized.slice(0, 5)}...${normalized.slice(-4)}`;
}

export { DEFAULT_USER_CONFIG };
