import { describe, expect, it } from "vitest";
import { createCompactJDModelResultSchema, createDeepJDModelResultSchema, createDiagnosisMatchResultSchema, followUpGuidanceResultSchema } from "@/lib/ai/schemas";

describe("deep JD runtime schemas", () => {
  it("requires complete source classification coverage", () => {
    const parsed = createDeepJDModelResultSchema(["jd-source-1", "jd-source-2"]).safeParse({
      sourceClassifications: [{ sourceItemId: "jd-source-1", classification: "requirement" }], requirements: [], responsibilities: [], hardRequirements: [], implicitRequirements: [], keywords: [], idealCandidate: "", coreCompetencies: [], roleInference: { items: [] }, clarificationNeeds: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("normalizes common Chinese source classification labels", () => {
    const parsed = createCompactJDModelResultSchema(["jd-source-1"]).parse({
      sourceClassifications: [{ sourceItemId: "jd-source-1", classification: "优先条件" }],
      requirements: [],
    });
    expect(parsed.sourceClassifications[0].classification).toBe("requirement");
  });

  it("does not apply the retired 40-item whole-map limit to a model batch", () => {
    const requirements = Array.from({ length: 56 }, (_, index) => ({
      sourceItemId: "jd-source-1", sourceQuote: "负责平台建设", requirement: `独立要求 ${index + 1}`,
      category: "responsibility" as const, priority: "must" as const, keywords: [], interviewFocus: "",
    }));
    const parsed = createCompactJDModelResultSchema(["jd-source-1"]).safeParse({
      sourceClassifications: [{ sourceItemId: "jd-source-1", classification: "requirement" }], requirements,
    });
    expect(parsed.success).toBe(true);
  });

  it("keeps a bounded set of model-provided inference evidence", () => {
    const parsed = createDeepJDModelResultSchema(["jd-source-1"]).safeParse({
      sourceClassifications: [{ sourceItemId: "jd-source-1", classification: "background" }],
      requirements: [], responsibilities: [], hardRequirements: [], implicitRequirements: [], keywords: [], idealCandidate: "", coreCompetencies: [],
      roleInference: {
        items: [
          { topic: "work-content", level: "explicit", conclusion: "负责需求", evidence: ["1", "2", "3", "4", "5"], confidence: "high", verificationQuestion: "范围是什么？" },
          { topic: "work-focus", level: "unknown", conclusion: "信息不足", evidence: [], confidence: "low", verificationQuestion: "重点是什么？" },
          { topic: "business-line", level: "unknown", conclusion: "信息不足", evidence: [], confidence: "low", verificationQuestion: "业务线是什么？" },
          { topic: "team-state", level: "unknown", conclusion: "信息不足", evidence: [], confidence: "low", verificationQuestion: "团队现状如何？" },
          { topic: "business-scenario", level: "unknown", conclusion: "信息不足", evidence: [], confidence: "low", verificationQuestion: "场景是什么？" },
          { topic: "team-pain", level: "unknown", conclusion: "信息不足", evidence: [], confidence: "low", verificationQuestion: "痛点是什么？" },
          { topic: "implicit-expectation", level: "unknown", conclusion: "信息不足", evidence: [], confidence: "low", verificationQuestion: "隐性期望是什么？" },
          { topic: "reporting-line", level: "unknown", conclusion: "信息不足", evidence: [], confidence: "low", verificationQuestion: "向谁汇报？" },
          { topic: "industry-experience", level: "unknown", conclusion: "信息不足", evidence: [], confidence: "low", verificationQuestion: "行业要求是什么？" },
        ],
      },
      clarificationNeeds: [],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.roleInference.items[0].evidence).toEqual(["1", "2", "3", "4"]);
  });

  it("does not allow firm conclusions for unknown inferences", () => {
    const parsed = createDeepJDModelResultSchema(["jd-source-1"]).safeParse({
      sourceClassifications: [{ sourceItemId: "jd-source-1", classification: "background" }], requirements: [], responsibilities: [], hardRequirements: [], implicitRequirements: [], keywords: [], idealCandidate: "", coreCompetencies: [], roleInference: { items: [{ topic: "team-state", level: "unknown", conclusion: "团队正在高速扩张", evidence: [], confidence: "low", verificationQuestion: "团队多大？" }] }, clarificationNeeds: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects model-created requirement and claim references", () => {
    const schema = createDiagnosisMatchResultSchema(["req-1"], ["claim-1"]);
    const parsed = schema.safeParse({ diagnosis: { overallScore: 0, dimensionScores: [], mainIssues: [], prioritySuggestions: [] }, matchItems: [{ requirementId: "req-fake", jdRequirement: "x", evidenceClaimIds: ["claim-fake"], resumeQuotes: [], resumeEvidence: "", matchRationale: "", evidenceStrength: "none", missingEvidenceTypes: [], needsSupplement: true, optimizationSuggestion: "" }], followUpQuestions: [] });
    expect(parsed.success).toBe(false);
  });

  it("requires unmistakable placeholders in guidance", () => {
    expect(followUpGuidanceResultSchema.safeParse({ example: "我在某公司做项目，提升了 50%。" }).success).toBe(false);
    expect(followUpGuidanceResultSchema.safeParse({ example: "在【你的项目】中采用【具体行动】，按【指标口径】核对【真实结果】。" }).success).toBe(true);
  });
});
