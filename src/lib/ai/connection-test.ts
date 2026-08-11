import type { AIConnectionTestResult } from "@/lib/ai/types";
import type { AIConfig } from "@/lib/ai/config";
import { fetchAIResponse } from "@/lib/ai/client";
import { classifyAIHTTPError, LLMError } from "@/lib/ai/errors";

export const CONNECTION_TEST_TIMEOUT_MS = 15_000;

export async function testAIConnection(
  config: AIConfig
): Promise<AIConnectionTestResult> {
  const startedAt = Date.now();
  try {
    const response = await fetchAIResponse(
      `${config.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0,
          max_tokens: 1,
          messages: [{ role: "user", content: "Reply OK." }],
        }),
      },
      CONNECTION_TEST_TIMEOUT_MS
    );
    const detail = await response.text().catch(() => "");
    if (!response.ok) {
      const classified = classifyAIHTTPError(response.status, detail);
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        provider: config.provider,
        model: config.model,
        category: classified.category,
        message: `${classified.message} (${response.status})`,
      };
    }
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
      provider: config.provider,
      model: config.model,
      message: "连接成功，模型已返回响应",
    };
  } catch (error) {
    const llmError = error instanceof LLMError ? error : new LLMError("无法连接模型服务", 503, "network");
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      provider: config.provider,
      model: config.model,
      category: llmError.category ?? "network",
      message: llmError.message,
    };
  }
}
