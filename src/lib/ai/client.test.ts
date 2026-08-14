import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { buildCompletionRequestBody, chatCompletionJSON, LLMStructureError, LLMTruncationError } from "@/lib/ai/client";
import type { AIConfig } from "@/lib/ai/config";
import type { PromptCaptureContext } from "@/lib/studio/prompt-types";
import { AnalysisExecutionBudget } from "@/lib/ai/analysis-execution";

const schema = z.object({ items: z.array(z.string()), ok: z.boolean() });
const config = (provider: string, model: string): AIConfig => ({ mode: "llm", provider, model, baseUrl: "https://example.test/v1", apiKey: "sk-test-key", invalidApiKey: false });
const options = { promptId: "resume.optimize-items" as const, schema, schemaName: "test_output", system: "system", user: "user", maxTokens: 200 };

describe("multi-provider structured output", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(["deepseek", "moonshot", "qwen", "zhipu", "gemini", "custom"])("uses JSON Object and embeds the schema for %s", (provider) => {
    const body = buildCompletionRequestBody(config(provider, "model"), options);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(JSON.stringify(body.messages)).toContain("完整 JSON Schema");
  });

  it("disables thinking for DeepSeek V4 structured tasks only", () => {
    expect(buildCompletionRequestBody(config("deepseek", "deepseek-v4-pro"), options)).toMatchObject({ thinking: { type: "disabled" } });
    expect(buildCompletionRequestBody(config("deepseek", "deepseek-v4-flash"), options)).toMatchObject({ thinking: { type: "disabled" } });
    expect(buildCompletionRequestBody(config("deepseek", "deepseek-chat"), options)).not.toHaveProperty("thinking");
    expect(buildCompletionRequestBody(config("qwen", "qwen3.7-plus"), options)).not.toHaveProperty("thinking");
  });

  it("uses strict JSON Schema and OpenAI completion-token parameters", () => {
    const body = buildCompletionRequestBody(config("openai", "gpt-5.6-luna"), options);
    expect(body.response_format).toMatchObject({ type: "json_schema" });
    expect(body.max_completion_tokens).toBe(200);
    expect(body).not.toHaveProperty("temperature");
  });

  it("repairs once with the full schema and then stops with field details", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"items":"wrong"}' } }] }), { status: 200 }));
    await expect(chatCompletionJSON({ ...options, configOverride: config("deepseek", "deepseek-v4-flash") })).rejects.toBeInstanceOf(LLMStructureError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repairBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairBody.messages[0].content).toContain("完整 JSON Schema");
    expect(repairBody.messages[0].content).toContain("禁止补造");
  });

  it("falls back once without response_format for a custom endpoint that explicitly rejects it", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("response_format is unsupported", { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"items":[],"ok":true}' } }] }), { status: 200 }));
    await expect(chatCompletionJSON({ ...options, configOverride: config("custom", "private-model") })).resolves.toEqual({ items: [], ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).not.toHaveProperty("response_format");
  });

  it("reports the exact analysis stage when output is truncated", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: '{"items":[],"ok":true}' } }] }), { status: 200 }));
    await expect(chatCompletionJSON({ ...options, analysisStage: "JD 需求解析", configOverride: config("deepseek", "deepseek-v4-flash") }))
      .rejects.toEqual(expect.objectContaining<Partial<LLMTruncationError>>({ name: "LLMTruncationError", stage: "JD 需求解析" }));
  });

  it("captures the provider-adapted prompt without credentials", async () => {
    const capture: PromptCaptureContext = { traceId: "trace-1", snapshots: [] };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: '{"items":[],"ok":true}' } }], usage: { prompt_tokens: 11, completion_tokens: 7, completion_tokens_details: { reasoning_tokens: 0 } } }), { status: 200 }));
    await chatCompletionJSON({ ...options, capture, configOverride: config("deepseek", "deepseek-v4-flash") });
    expect(capture.snapshots).toHaveLength(1);
    expect(capture.snapshots[0]).toMatchObject({ promptId: "resume.optimize-items", attemptKind: "primary", status: "success", traceId: "trace-1", provider: "deepseek" });
    expect(capture.snapshots[0].sentSystemPrompt).toContain("JSON Schema");
    expect(capture.snapshots[0]).toMatchObject({ reasoningMode: "disabled", finishReason: "stop", promptTokens: 11, completionTokens: 7, reasoningTokens: 0 });
    expect(capture.snapshots[0].requestParameters).toMatchObject({ thinking: { type: "disabled" } });
    expect(JSON.stringify(capture.snapshots[0])).not.toContain("sk-test-key");
  });

  it("records the primary validation failure and the single repair attempt", async () => {
    const capture: PromptCaptureContext = { snapshots: [] };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"items":[],"ok":true}' } }] }), { status: 200 }));
    await chatCompletionJSON({ ...options, capture, configOverride: config("qwen", "qwen3.7-plus") });
    expect(capture.snapshots.map((snapshot) => snapshot.attemptKind)).toEqual(["primary", "schema-repair"]);
    expect(capture.snapshots[0].status).toBe("validation-error");
    expect(capture.snapshots[0].validationIssues.length).toBeGreaterThan(0);
    expect(capture.snapshots[1].status).toBe("success");
  });

  it("counts schema repair against the shared analysis request budget", async () => {
    const budget = new AnalysisExecutionBudget({ maxProviderRequests: 1 });
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }));
    await expect(chatCompletionJSON({ ...options, analysisBudget: budget, configOverride: config("deepseek", "deepseek-v4-flash") }))
      .rejects.toThrow(/1 次调用上限/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
