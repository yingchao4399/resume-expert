import { afterEach, describe, expect, it, vi } from "vitest";
import { filterTextModelIds, listAIModels } from "@/lib/ai/model-catalog";
import type { AIConfig } from "@/lib/ai/config";

const config: AIConfig = { mode: "llm", provider: "deepseek", model: "deepseek-v4-flash", baseUrl: "https://example.test/v1", apiKey: "sk-test-key", invalidApiKey: false };

describe("AI model catalog", () => {
  afterEach(() => vi.restoreAllMocks());
  it("deduplicates and removes media, embedding and moderation models", () => {
    expect(filterTextModelIds([{ id: "chat-a" }, { id: "chat-a" }, { id: "text-embedding-3" }, { id: "audio-preview" }, { id: "moderation-latest" }, { name: "models/gemini-3.6-flash" }])).toEqual(["chat-a", "gemini-3.6-flash"]);
  });
  it("merges official and account models with source labels", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "deepseek-v4-flash" }, { id: "account-custom" }] }), { status: 200 }));
    const result = await listAIModels(config);
    expect(result.models).toContainEqual({ id: "deepseek-v4-flash", source: "account" });
    expect(result.models).toContainEqual({ id: "deepseek-v4-pro", source: "official" });
    expect(result.models).toContainEqual({ id: "account-custom", source: "account" });
  });
  it("keeps official presets when refresh fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("unauthorized", { status: 401 }));
    const result = await listAIModels(config);
    expect(result.warning).toContain("401");
    expect(result.models.map((item) => item.id)).toContain("deepseek-v4-flash");
  });
});
