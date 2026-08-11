import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAIResponse } from "@/lib/ai/client";
import { classifyAIHTTPError, LLMError } from "@/lib/ai/errors";

describe("AI request reliability", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("classifies provider errors for actionable settings feedback", () => {
    expect(classifyAIHTTPError(401).category).toBe("authentication");
    expect(classifyAIHTTPError(404, "model not found").category).toBe("model");
    expect(classifyAIHTTPError(429).category).toBe("rate_limit");
    expect(classifyAIHTTPError(400).category).toBe("base_url");
    expect(classifyAIHTTPError(503).category).toBe("network");
  });

  it("aborts a request at the configured timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    const request = fetchAIResponse("https://example.test", {}, 50);
    const expectation = expect(request).rejects.toMatchObject({ category: "timeout", status: 504 } satisfies Partial<LLMError>);
    await vi.advanceTimersByTimeAsync(50);
    await expectation;
  });
});
