import { z } from "zod";
import type { AIConfig } from "@/lib/ai/config";
import { buildCompletionRequestBody, fetchAIResponse } from "@/lib/ai/client";
import { classifyAIHTTPError, LLMError } from "@/lib/ai/errors";
import { parseJSONFromMessage } from "@/lib/ai/parse-json";
import { getStructuredTaskReasoningMode } from "@/lib/ai/presets";
import type { AIConnectionCheckResult, AIConnectionTestResult } from "@/lib/ai/types";

export const CONNECTION_TEST_TIMEOUT_MS = 15_000;

const structuredProbeSchema = z.object({ ok: z.literal(true) });

export async function testAIConnection(config: AIConfig): Promise<AIConnectionTestResult> {
  const startedAt = Date.now();
  const deadlineAt = startedAt + CONNECTION_TEST_TIMEOUT_MS;
  const basic = await runBasicCheck(config, deadlineAt);
  const reasoningMode = getStructuredTaskReasoningMode(config.provider, config.model);

  if (!basic.ok) {
    const structured: AIConnectionCheckResult = {
      ok: false,
      latencyMs: 0,
      category: basic.category,
      message: "未执行：基础连接失败",
    };
    return buildResult(config, startedAt, reasoningMode, basic, structured);
  }

  const structured = await runStructuredCheck(config, deadlineAt);
  return buildResult(config, startedAt, reasoningMode, basic, structured);
}

async function runBasicCheck(config: AIConfig, deadlineAt: number): Promise<AIConnectionCheckResult> {
  const startedAt = Date.now();
  try {
    const response = await post(config, {
      model: config.model,
      temperature: 0,
      max_tokens: 1,
      messages: [{ role: "user", content: "Reply OK." }],
    }, remainingMs(deadlineAt));
    return response.ok ? success(startedAt, "基础连接成功") : failureFromResponse(startedAt, response);
  } catch (error) {
    return failureFromError(startedAt, error);
  }
}

async function runStructuredCheck(config: AIConfig, deadlineAt: number): Promise<AIConnectionCheckResult> {
  const startedAt = Date.now();
  try {
    const body = buildCompletionRequestBody(config, {
      promptId: "resume.deep-jd",
      schema: structuredProbeSchema,
      schemaName: "connection_test_json",
      system: "你是 JSON 结构化连接测试。只能输出 JSON。",
      user: '只返回 {"ok":true}。',
      temperature: 0,
      maxTokens: 64,
    });
    const response = await post(config, body, remainingMs(deadlineAt));
    if (!response.ok) return failureFromResponse(startedAt, response);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = parseJSONFromMessage<unknown>([content]);
    if (!structuredProbeSchema.safeParse(parsed).success) {
      return { ok: false, latencyMs: Date.now() - startedAt, category: "base_url", message: "模型未返回符合要求的 JSON 结构" };
    }
    return success(startedAt, "JSON 结构化输出成功");
  } catch (error) {
    return failureFromError(startedAt, error);
  }
}

async function post(config: AIConfig, body: Record<string, unknown>, timeoutMs: number): Promise<Response> {
  return fetchAIResponse(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify(body),
  }, timeoutMs);
}

async function failureFromResponse(startedAt: number, response: Response): Promise<AIConnectionCheckResult> {
  const detail = await response.text().catch(() => "");
  const classified = classifyAIHTTPError(response.status, detail);
  return { ok: false, latencyMs: Date.now() - startedAt, category: classified.category, message: `${classified.message} (${response.status})` };
}

function failureFromError(startedAt: number, error: unknown): AIConnectionCheckResult {
  const llmError = error instanceof LLMError ? error : new LLMError("无法连接模型服务", 503, "network");
  return { ok: false, latencyMs: Date.now() - startedAt, category: llmError.category ?? "network", message: llmError.message };
}

function success(startedAt: number, message: string): AIConnectionCheckResult {
  return { ok: true, latencyMs: Date.now() - startedAt, message };
}

function remainingMs(deadlineAt: number): number {
  return Math.max(1, deadlineAt - Date.now());
}

function buildResult(
  config: AIConfig,
  startedAt: number,
  reasoningMode: AIConnectionTestResult["reasoningMode"],
  basic: AIConnectionCheckResult,
  structured: AIConnectionCheckResult,
): AIConnectionTestResult {
  const ok = basic.ok && structured.ok;
  const failed = !basic.ok ? basic : structured;
  return {
    ok,
    latencyMs: Date.now() - startedAt,
    provider: config.provider,
    model: config.model,
    category: ok ? undefined : failed.category,
    reasoningMode,
    checks: { basic, structured },
    message: ok
      ? "基础连接与 JSON 结构化输出均成功"
      : basic.ok
        ? `基础连接成功，但结构化输出失败：${structured.message}`
        : `基础连接失败：${basic.message}`,
  };
}
