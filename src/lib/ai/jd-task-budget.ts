import { AnalysisExecutionBudget } from "./analysis-execution";
import { JD_TASK_TIMEOUT_MS } from "@/lib/jd/limits";

export function planJDTaskBudget(expectedRequests: number) {
  if (!Number.isInteger(expectedRequests) || expectedRequests < 1 || expectedRequests + 4 > 28) {
    throw new Error("这份 JD 的预计批次超过安全调用预算，请拆分材料；任务尚未开始，已有数据未改变。");
  }
  return { maxProviderRequests: expectedRequests + 4, timeoutMs: Math.min(JD_TASK_TIMEOUT_MS, Math.max(120_000, (Math.ceil(expectedRequests / 2) + 1) * 60_000)) };
}

export function createJDTaskBudget(expectedRequests: number, signal?: AbortSignal) {
  const plan = planJDTaskBudget(expectedRequests);
  return new AnalysisExecutionBudget({ signal, deadlineAt: Date.now() + plan.timeoutMs, providerTimeoutMs: 60_000, maxProviderRequests: plan.maxProviderRequests });
}
