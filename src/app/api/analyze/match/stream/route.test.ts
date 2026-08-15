import { describe, expect, it } from "vitest";
import { POST as parseJD } from "@/app/api/analyze/stream/route";
import { POST as matchJD } from "@/app/api/analyze/match/stream/route";
import { confirmJDAnalysisDocument, confirmRequirement } from "@/lib/jd/decision-map";
import { EXAMPLE_USER_INPUT } from "@/store/resume-store-example";
import type { JDAnalysisDocument } from "@/types/jd-analysis";

const context = { companyName: "", notes: "", companySnapshotId: null } as const;

async function events(response: Response) {
  return (await response.text()).split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

describe("confirmed JD matching stream", () => {
  it("refuses drafts and computes readiness only after the map is confirmed", async () => {
    const parsed = await parseJD(new Request("http://localhost/api/analyze/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Workflow-Provider": "mock" },
      body: JSON.stringify({ input: EXAMPLE_USER_INPUT, jobTargetContext: context, careerClaims: [], materialRevision: 4 }),
    }));
    let document = (await events(parsed)).find((event) => event.type === "completed").document as JDAnalysisDocument;
    for (const requirement of document.requirements) document = confirmRequirement(document, requirement.id);
    document = confirmJDAnalysisDocument(document);

    const response = await matchJD(new Request("http://localhost/api/analyze/match/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Workflow-Provider": "mock" },
      body: JSON.stringify({ input: EXAMPLE_USER_INPUT, jobTargetContext: context, careerClaims: [], jdAnalysisDocument: document, materialRevision: 4 }),
    }));
    const output = await events(response);
    expect(output.at(-1).type).toBe("completed");
    expect(output.at(-1).result.jobReadiness.overallScore).toBe(0);
    expect(output.at(-1).result.diagnosis.overallScore).toBe(0);
    expect(output.at(-1).result.matchItems.every((item: { evidenceStrength: string }) => item.evidenceStrength === "none")).toBe(true);
  });
});
