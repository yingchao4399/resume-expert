import { afterEach, describe, expect, it, vi } from "vitest";
import { runResumeAnalysisStreaming, ResumeAnalysisCancelledError } from "@/services/ai/resumeAgent";
import { EXAMPLE_USER_INPUT } from "@/store/resume-store-example";

const context = { companyName: "", notes: "", companySnapshotId: null } as const;

function streamResponse(events: unknown[]) {
  return new Response(events.map((event) => JSON.stringify(event)).join("\n") + "\n", {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("analysis stream client", () => {
  it("reports progress and accepts only a terminal completed result", async () => {
    const document = { schemaVersion: 1, status: "draft" } as never;
    const progress = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => streamResponse([
      { type: "started", requestId: "run-1", elapsedMs: 0, remainingMs: 360_000 },
      { type: "completed", elapsedMs: 10, document, mode: "mock" },
    ])));

    await expect(runResumeAnalysisStreaming(EXAMPLE_USER_INPUT, context, [], "ai-product", { onProgress: progress })).resolves.toStrictEqual(document);
    expect(progress).toHaveBeenCalledTimes(2);
  });

  it("resets on a stream that closes without a terminal event", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamResponse([
      { type: "started", requestId: "run-2", elapsedMs: 0, remainingMs: 360_000 },
    ])));

    await expect(runResumeAnalysisStreaming(EXAMPLE_USER_INPUT, context, [])).rejects.toThrow("未收到完整结果");
  });

  it("propagates caller cancellation", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));
    const controller = new AbortController();
    const pending = runResumeAnalysisStreaming(EXAMPLE_USER_INPUT, context, [], "ai-product", { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(ResumeAnalysisCancelledError);
  });
});
