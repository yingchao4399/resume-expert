export type AppErrorCategory =
  | "authentication"
  | "model"
  | "base_url"
  | "rate_limit"
  | "network"
  | "timeout"
  | "cancelled"
  | "validation"
  | "storage"
  | "unexpected";

export interface AppErrorPayload {
  code: string;
  category: AppErrorCategory;
  userMessage: string;
  retryable: boolean;
  requestId: string;
  diagnostic?: unknown;
}

const SENSITIVE_KEY = /api.?key|authorization|password|credential|config.?path|resume|job.?description|transcript|recording|prompt|input|output/i;

export function redactDiagnosticValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactDiagnosticValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) =>
    SENSITIVE_KEY.test(key) ? [key, "[REDACTED]"] : [key, redactDiagnosticValue(item)]));
}

export function createAppErrorPayload(
  error: unknown,
  options: Partial<AppErrorPayload> & Pick<AppErrorPayload, "userMessage">,
): AppErrorPayload {
  const fallbackRequestId = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `request-${Date.now()}`;
  return {
    code: options.code ?? "UNEXPECTED_ERROR",
    category: options.category ?? "unexpected",
    userMessage: options.userMessage,
    retryable: options.retryable ?? false,
    requestId: options.requestId ?? fallbackRequestId,
    diagnostic: options.diagnostic === undefined
      ? error instanceof Error ? { name: error.name } : undefined
      : redactDiagnosticValue(options.diagnostic),
  };
}

export function isAppErrorPayload(value: unknown): value is AppErrorPayload {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AppErrorPayload>;
  return typeof item.code === "string" && typeof item.userMessage === "string" &&
    typeof item.retryable === "boolean" && typeof item.requestId === "string";
}

export function taskErrorPayload(error: unknown, userMessage: string, requestId?: string): AppErrorPayload {
  const message = error instanceof Error ? error.message : userMessage;
  const lowered = message.toLowerCase();
  const category: AppErrorCategory = /取消|cancel/.test(lowered) ? "cancelled"
    : /超时|timeout/.test(lowered) ? "timeout"
      : /429|限流|额度/.test(lowered) ? "rate_limit"
        : /401|403|api key|鉴权/.test(lowered) ? "authentication"
          : /模型|model|结构|schema/.test(lowered) ? "model"
            : /网络|network|fetch|连接/.test(lowered) ? "network"
              : "unexpected";
  return createAppErrorPayload(error, {
    code: category === "cancelled" ? "TASK_CANCELLED" : category === "timeout" ? "TASK_TIMEOUT" : "TASK_FAILED",
    category,
    userMessage: message || userMessage,
    retryable: !["cancelled", "authentication", "validation"].includes(category),
    requestId,
    diagnostic: { name: error instanceof Error ? error.name : "UnknownError" },
  });
}
