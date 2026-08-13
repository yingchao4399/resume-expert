import type { AIConnectionErrorCategory } from "@/lib/ai/types";

export class LLMError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly category?: AIConnectionErrorCategory
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export class LLMStructureError extends LLMError {
  constructor(
    readonly provider: string,
    readonly model: string,
    readonly invalidFields: string[]
  ) {
    const fields = invalidFields.length ? invalidFields.join("；") : "无法解析为 JSON";
    super(`所选 ${provider} / ${model} 连续两次未返回合格结构。不合格字段：${fields}`, 502);
    this.name = "LLMStructureError";
  }
}

export function classifyAIHTTPError(status: number, detail = ""): {
  category: AIConnectionErrorCategory;
  message: string;
} {
  const normalized = detail.toLowerCase();
  if (status === 401 || status === 403) return { category: "authentication", message: "API Key 无效或没有访问权限" };
  if (status === 404 || /model.*(?:not found|does not exist|invalid)|模型.*不存在/.test(normalized)) {
    return { category: "model", message: "模型名称不存在或当前账号无权使用" };
  }
  if (status === 429) return { category: "rate_limit", message: "请求过于频繁或额度不足，请稍后重试" };
  if (status >= 400 && status < 500) return { category: "base_url", message: "接口地址或请求格式不兼容" };
  return { category: "network", message: "模型服务暂时不可用" };
}
