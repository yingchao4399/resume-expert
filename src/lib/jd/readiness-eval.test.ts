import { describe, expect, it } from "vitest";
import { READINESS_GOLD_CASES } from "../../../evals/readiness-cases";
import { assessRequirements } from "@/lib/jd/readiness-v2";
import { findResumeQuotes } from "@/lib/jd/resume-quote-recall";
import { planSupplementTasks } from "@/lib/jd/supplement-planner";
import type { JDRequirementAtom } from "@/types/jd-analysis";
import type { MatchItem } from "@/types/resume";

describe("60-case trusted readiness evaluation", () => {
  it("meets quote, trust and supplement calibration gates through production scorers", () => {
    expect(READINESS_GOLD_CASES).toHaveLength(60);
    let wrongSupplement = 0; let unsupportedUpgrade = 0; const primaryCounts: number[] = [];
    for (const item of READINESS_GOLD_CASES) {
      const requirement = { id: item.id, sourceSpanId: `span-${item.id}`, sourceSpanIds: [`span-${item.id}`], sourceQuote: item.requirement,
        normalizedText: item.requirement, kind: "task", modality: "required", priority: item.level === "负责人" ? "critical" : "high", priorityBasis: ["Gold"],
        expectedOutcome: null, keywords: item.requirement.match(/[A-Za-z][A-Za-z0-9/ ]+|[\u4e00-\u9fff]{2,6}/g) ?? [], anchorStatus: "validated", reviewStatus: "confirmed", isHardGate: false, userEdited: false } as JDRequirementAtom;
      const quotes = findResumeQuotes(item.resume, requirement);
      const match: MatchItem = { requirementId: item.id, jdRequirement: item.requirement,
        evidenceClaimIds: item.scenario === "confirmed-fact" ? [`claim-${item.id}`] : [], resumeQuotes: item.scenario === "resume-quote" ? quotes : [], resumeEvidence: "",
        evidenceStrength: item.scenario === "confirmed-fact" ? "medium" : item.scenario === "resume-quote" ? "weak" : "none", missingEvidenceTypes: [], needsSupplement: true, optimizationSuggestion: "" };
      const assessment = assessRequirements([requirement], [match])[0];
      if (assessment.supplementNeed !== item.expectedNeed) wrongSupplement += 1;
      if (item.scenario !== "confirmed-fact" && assessment.trustStatus === "confirmed") unsupportedUpgrade += 1;
      primaryCounts.push(planSupplementTasks([requirement], [assessment]).primary.length);
    }
    expect(wrongSupplement / READINESS_GOLD_CASES.length).toBeLessThanOrEqual(0.1);
    expect(unsupportedUpgrade).toBe(0);
    expect(primaryCounts.sort((a, b) => a - b)[Math.floor(primaryCounts.length / 2)]).toBeLessThanOrEqual(3);
  });
});
