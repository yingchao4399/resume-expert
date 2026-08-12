import { parseJSONFromMessage } from "@/lib/ai/parse-json";
import { projectEvidenceDraftSchema, type ProjectEvidenceDraft } from "@/lib/flowise/schemas";

export type FlowiseFailureCategory = "offline" | "authentication" | "timeout" | "schema" | "configuration";

export function classifyFlowiseStatus(status: number): FlowiseFailureCategory {
  if (status === 401 || status === 403) return "authentication";
  return "offline";
}

export function parseFlowisePrediction(body: Record<string, unknown>): ProjectEvidenceDraft {
  const candidate = body.json ?? body.result ?? body.output ?? body.text;
  const parsed = typeof candidate === "string" ? parseJSONFromMessage([candidate]) : candidate;
  return projectEvidenceDraftSchema.parse(parsed);
}

export async function withMockFallback<T>(
  requested: "mock" | "direct" | "flowise",
  allowFallback: boolean,
  run: () => Promise<T>,
  mock: () => T
): Promise<{ value: T; actual: "mock" | "direct" | "flowise"; fallbackUsed: boolean; error?: string }> {
  try {
    return { value: await run(), actual: requested, fallbackUsed: false };
  } catch (error) {
    if (!allowFallback || requested === "mock") throw error;
    return { value: mock(), actual: "mock", fallbackUsed: true, error: error instanceof Error ? error.message : "未知错误" };
  }
}
