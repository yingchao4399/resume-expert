import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { POST as match } from "@/app/api/analyze/match/stream/route";
import { decisionStream } from "@/lib/ai/decision-stream.server";
import { buildJDAnalysisDocument, confirmJDAnalysisDocument, confirmSafeRequirements, parseJDSourceSpans } from "@/lib/jd/decision-map";
import { EXAMPLE_USER_INPUT } from "@/store/resume-store-example";
import { applyConsolidation } from "@/lib/jd/consolidation";
import { jdConsolidationProposalSchema } from "@/lib/jd/schemas";

const headers = { "Content-Type": "application/json", "X-Workflow-Provider": "mock" };
const events = async (response: Response) => (await response.text()).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
function document56() {
  const sourceText = Array.from({ length: 56 }, (_, index) => `必须完成任务${Math.floor(index / 2) + 1}`).join("\n");
  const spans = parseJDSourceSpans(sourceText);
  return confirmJDAnalysisDocument(confirmSafeRequirements(buildJDAnalysisDocument({ sourceText, materialRevision: 1, spans,
    drafts: spans.map(span => ({ sourceSpanId: span.id, sourceQuote: span.text, normalizedText: span.text, kind: "task", modality: "required", priority: "high", priorityBasis: ["测试原文"] })) })));
}
describe("JD streaming integration", () => {
  afterEach(() => vi.useRealTimers());
  it("accepts the legacy 56-item map, proposes 28 merges without modifying it", async () => {
    const map = document56();
    const response = await POST(new Request("http://localhost/api/analyze/consolidate/stream", { method: "POST", headers, body: JSON.stringify({ jdAnalysisDocument: { ...map, schemaVersion: 1 } }) }));
    expect(response.status).toBe(200);
    const output = await events(response);
    expect(output.at(-1).type).toBe("completed");
    const proposal = jdConsolidationProposalSchema.parse(output.at(-1).proposal);
    expect(applyConsolidation(map, proposal).requirements).toHaveLength(28);
    expect(map.requirements).toHaveLength(56);
    const matched = await match(new Request("http://localhost/api/analyze/match/stream", { method: "POST", headers, body: JSON.stringify({ input: { ...EXAMPLE_USER_INPUT, jobDescription: map.sourceText }, jdAnalysisDocument: map, materialRevision: 1 }) }));
    const matchEvents = await events(matched);
    expect(matchEvents.at(-1).type).toBe("completed");
    expect(matchEvents.at(-1).result.matchItems).toHaveLength(56);
  });
  it("does not publish completed data after abort even if a task resolves late", async () => {
    const controller = new AbortController();
    let resolve!: (value: Record<string, unknown>) => void;
    const response = decisionStream(new Request("http://localhost", { signal: controller.signal }), () => new Promise(done => { resolve = done; }));
    await Promise.resolve(); controller.abort(); resolve({ document: document56() });
    expect((await events(response)).at(-1).type).toBe("cancelled");
  });
  it("emits heartbeats and terminates hung tasks at the hard deadline", async () => {
    vi.useFakeTimers();
    const response = decisionStream(new Request("http://localhost"), () => new Promise(() => {}));
    const output = events(response);
    await vi.advanceTimersByTimeAsync(360_001);
    const records = await output;
    expect(records.some(record => record.type === "heartbeat")).toBe(true);
    expect(records.at(-1).type).toBe("failed");
    expect(records.at(-1).error).toContain("360");
    expect(records.some(record => record.type === "completed")).toBe(false);
  });
});
