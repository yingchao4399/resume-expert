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
  it("computes trusted facts separately from candidate original-resume coverage", async () => {
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
    const assessment = output.at(-1).result.jobReadinessV2;
    expect(assessment.version).toBe(2);
    expect(assessment.requirementAssessments.some((item: { trustStatus: string }) => item.trustStatus === "resume-unverified")).toBe(true);
    expect(assessment.requirementAssessments.every((item: { trustStatus: string }) => item.trustStatus !== "confirmed")).toBe(true);
  });
});
