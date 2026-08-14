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

export type AnalysisStage = "JD 需求解析" | "要求—事实匹配" | "面试策略" | "简历优化";

export class LLMTruncationError extends LLMError {
  constructor(readonly stage: AnalysisStage) {
    super(`${stage}阶段的大模型输出被截断，系统已停止写入。请缩短材料、切换上下文更长的模型或重试。`, 502, "model");
    this.name = "LLMTruncationError";
  }
}

export class AnalysisCancelledError extends LLMError {
  constructor() {
    super("分析已取消，当前材料和已有结果均未改变。", 499, "cancelled");
    this.name = "AnalysisCancelledError";
  }
}

export class AnalysisDeadlineError extends LLMError {
  constructor() {
    super("快速分析已达到 3 分钟上限，系统已停止后续调用且未写入半成品。请缩短 JD、测试当前模型或切换更快的模型后重试。", 504, "timeout");
    this.name = "AnalysisDeadlineError";
  }
}

export class AnalysisRetryBudgetError extends LLMError {
  constructor(readonly maxRequests: number) {
    super(`模型连续截断或结构修复，已达到 ${maxRequests} 次调用上限。系统已停止且未写入半成品。`, 502, "model");
    this.name = "AnalysisRetryBudgetError";
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
