import { describe, expect, it } from "vitest";
import { aggregateScores, scoreCase } from "./scorer.mjs";

const caseFixture = {
  id: "case-1",
  facts: { immutableFacts: ["张三"], allowedFacts: ["React"], forbiddenClaims: ["百万用户"] },
  expected: { requiredKeywords: ["React"], supplementRequirements: ["性能优化"], evidenceStrength: { React: "strong", 性能优化: "none" } },
};

describe("evaluation scorer", () => {
  it("scores facts, requirements and evidence deterministically", () => {
    const result = scoreCase(caseFixture, { finalResumeText: "张三使用React", coveredRequirements: ["React"], matchItems: [{ requirement: "React", evidenceStrength: "strong", needsSupplement: false }, { requirement: "性能优化", evidenceStrength: "none", needsSupplement: true }] });
    const run = aggregateScores([result], { mode: "mock" });
    expect(run.metrics.schemaValidityRate).toBe(1);
    expect(run.metrics.immutableFactRetentionRate).toBe(1);
    expect(run.metrics.unsupportedClaimRate).toBe(0);
    expect(run.metrics.needsSupplementF1).toBe(1);
  });

  it("rejects malformed output without throwing", () => {
    const result = scoreCase({ ...caseFixture, category: "malformed-output" }, null);
    expect(result.failures).toEqual([]);
    expect(result.passed).toBe(true);
  });
});
