import { describe, expect, it } from "vitest";
import { remapCareerDomainForMerge, remapDocumentsClaimIds } from "@/lib/backup/resume-backup";
import { createEmptyDocument } from "@/store/resume-store-document";
import type { CareerDomainSnapshot } from "@/types/career-domain";
import type { AnalysisResult } from "@/types/resume";

const now = "2026-01-01";
const domain: CareerDomainSnapshot = {
  schemaVersion: 1, experiences: [{ id: "exp", type: "project", title: "Project", organization: "", role: "", startDate: "", endDate: "", periodText: "", summary: "", order: 0, status: "confirmed", createdAt: now, updatedAt: now }],
  claims: [{ id: "claim", experienceId: "exp", kind: "action", text: "fact", contribution: "independent", complexity: "routine", hasTradeoff: false, hasMethodReuse: false, status: "confirmed", sourceReference: null, sourceQuote: "fact", sourceRunId: null, sourceRound: null, createdAt: now, updatedAt: now }],
  metrics: [{ id: "metric", claimId: "claim", value: "40", unit: "%", baseline: "", method: "before/after", period: "", sourceNote: "report", status: "confirmed", createdAt: now, updatedAt: now }],
  capabilities: [{ id: "cap", name: "Product", category: "product", aliases: [], selfLevel: 2, createdAt: now, updatedAt: now }],
  capabilityLinks: [{ id: "link", capabilityId: "cap", claimId: "claim", status: "confirmed", source: "manual", createdAt: now, updatedAt: now }], interviewSessions: [], quarantined: [],
};

describe("career backup merge", () => {
  it("remaps all domain foreign keys and resume bullet claim ids", () => {
    const result = remapCareerDomainForMerge(domain);
    const mappedClaim = result.claimIdMap.get("claim")!;
    expect(result.domain.claims[0]).toMatchObject({ id: mappedClaim, experienceId: result.domain.experiences[0].id });
    expect(result.domain.metrics[0].claimId).toBe(mappedClaim);
    expect(result.domain.capabilityLinks[0]).toMatchObject({ claimId: mappedClaim, capabilityId: result.domain.capabilities[0].id });

    const document = createEmptyDocument("doc");
    document.analysisResult = { finalResume: { personalInfo: { name: "", email: "", phone: "", location: "" }, jobIntent: "", summary: "", coreSkills: [], workExperience: [{ company: "", role: "", period: "", bullets: [{ id: "b", text: "fact", sourceType: "manual", evidenceIds: ["claim"], evidenceLinks: [{ evidenceId: "claim", status: "confirmed", method: "manual", sourceReference: null }], originalText: "", aiText: "", manualText: "fact" }] }], projectExperience: [], skillsAndTools: [], education: { school: "", degree: "", period: "" } } } as unknown as AnalysisResult;
    const bullet = remapDocumentsClaimIds([document], result.claimIdMap)[0].analysisResult!.finalResume.workExperience[0].bullets[0];
    expect(typeof bullet === "string" ? null : bullet.evidenceLinks[0].evidenceId).toBe(mappedClaim);
  });
});
