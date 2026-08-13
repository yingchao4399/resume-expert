import { describe, expect, it } from "vitest";
import { createDeepJDModelResultSchema, createDiagnosisMatchResultSchema, followUpGuidanceResultSchema } from "@/lib/ai/schemas";

describe("deep JD runtime schemas", () => {
  it("requires complete source classification coverage", () => {
    const parsed = createDeepJDModelResultSchema(["jd-source-1", "jd-source-2"]).safeParse({
      sourceClassifications: [{ sourceItemId: "jd-source-1", classification: "requirement" }], requirements: [], responsibilities: [], hardRequirements: [], implicitRequirements: [], keywords: [], idealCandidate: "", coreCompetencies: [], roleInference: { items: [] }, clarificationNeeds: [],
    });
    expect(parsed.success).toBe(false);
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
