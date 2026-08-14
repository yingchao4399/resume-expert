import { describe, expect, it } from "vitest";
import { EXAMPLE_USER_INPUT } from "@/store/resume-store-example";
import { POST } from "@/app/api/analyze/stream/route";

function request(signal?: AbortSignal) {
  return new Request("http://localhost/api/analyze/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Workflow-Provider": "mock" },
    body: JSON.stringify({
      input: EXAMPLE_USER_INPUT,
      jobTargetContext: { companyName: "", notes: "", companySnapshotId: null },
      careerClaims: [],
      optimizeStyle: "ai-product",
    }),
    signal,
  });
}

async function eventsFrom(response: Response) {
  return (await response.text())
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { type: string; result?: { optimizedItems: unknown[] } });
}

describe("streaming analysis route", () => {
  it("streams two bounded quick-analysis stages and leaves interview preparation empty", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");

    const events = await eventsFrom(response);
    expect(events.map((event) => event.type)).toEqual([
      "started",
      "stage-started", "stage-completed",
      "stage-started", "stage-completed",
      "completed",
    ]);
    expect(events.at(-1)?.result?.optimizedItems).toEqual([]);
    expect((events.at(-1)?.result as { interviewPrep?: { likelyQuestions?: unknown[] } })?.interviewPrep?.likelyQuestions).toEqual([]);
  });

  it("emits cancellation instead of a completed result", async () => {
    const controller = new AbortController();
    const response = await POST(request(controller.signal));
    controller.abort();
    const events = await eventsFrom(response);
    expect(events.at(-1)?.type).toBe("cancelled");
    expect(events.some((event) => event.type === "completed")).toBe(false);
  });
});
