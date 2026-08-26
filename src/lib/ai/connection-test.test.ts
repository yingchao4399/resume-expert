import { afterEach, describe, expect, it, vi } from "vitest";
import { testAIConnection } from "@/lib/ai/connection-test";
import type { AIConfig } from "@/lib/ai/config";

const config: AIConfig = {
  mode: "llm",
  provider: "qwen",
  model: "qwen3.7-flash",
  baseUrl: "https://example.test/v1",
  apiKey: "sk-test-key",
  invalidApiKey: false,
};

describe("AI connection test", () => {
  afterEach(() => vi.restoreAllMocks());

  it("checks both basic connectivity and a small structured response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 }));

    const result = await testAIConnection(config);

    expect(result.ok).toBe(true);
    expect(result.checks.basic.ok).toBe(true);
    expect(result.checks.structured.ok).toBe(true);
    expect(result.checks.structured.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.reasoningMode).toBe("disabled");
    const structuredBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(structuredBody).toMatchObject({ enable_thinking: false, response_format: { type: "json_object" } });
  });

  it("reports when basic connectivity succeeds but structured JSON fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), { status: 200 }));

    const result = await testAIConnection(config);

    expect(result.ok).toBe(false);
    expect(result.checks.basic.ok).toBe(true);
    expect(result.checks.structured.ok).toBe(false);
    expect(result.message).toContain("基础连接成功");
    expect(result.message).toContain("结构化");
  });
});
