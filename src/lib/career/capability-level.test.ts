import { describe, expect, it } from "vitest";
import { calculateVerifiedCapabilityLevel, isMetricComplete } from "@/lib/career/capability-level";
import type { CapabilityEvidenceLink, CareerExperience, EvidenceClaim } from "@/types/career-domain";

const now = "2026-01-01";
const experience = (id: string): CareerExperience => ({ id, type: "project", title: id, organization: "", role: "owner", startDate: "", endDate: "", periodText: "", summary: "", order: 0, status: "confirmed", createdAt: now, updatedAt: now });
const claim = (id: string, experienceId: string, patch: Partial<EvidenceClaim> = {}): EvidenceClaim => ({ id, experienceId, kind: "action", text: "fact", contribution: "assisted", complexity: "routine", hasTradeoff: false, hasMethodReuse: false, status: "confirmed", sourceReference: null, sourceQuote: "fact", sourceRunId: null, sourceRound: null, createdAt: now, updatedAt: now, ...patch });
const link = (claimId: string): CapabilityEvidenceLink => ({ id: `l-${claimId}`, capabilityId: "cap", claimId, status: "confirmed", source: "manual", createdAt: now, updatedAt: now });

describe("verified capability level", () => {
  it("calculates deterministic levels from confirmed evidence", () => {
    expect(calculateVerifiedCapabilityLevel("cap", [], [], [], []).level).toBe(0);
    expect(calculateVerifiedCapabilityLevel("cap", [experience("a")], [claim("c1", "a")], [], [link("c1")]).level).toBe(1);
    expect(calculateVerifiedCapabilityLevel("cap", [experience("a")], [claim("c1", "a", { contribution: "independent" })], [], [link("c1")]).level).toBe(2);
    expect(calculateVerifiedCapabilityLevel("cap", [experience("a")], [claim("c1", "a", { contribution: "independent", complexity: "complex", hasTradeoff: true })], [], [link("c1")]).level).toBe(3);
    const claims = [claim("c1", "a", { contribution: "led", hasMethodReuse: true }), claim("c2", "b", { contribution: "led", hasMethodReuse: true })];
    expect(calculateVerifiedCapabilityLevel("cap", [experience("a"), experience("b")], claims, [], claims.map((item) => link(item.id))).level).toBe(4);
  });

  it("requires metric value, method and source before confirmation", () => {
    expect(isMetricComplete({ value: "40", method: "前后流程耗时对比", sourceNote: "项目周报" })).toBe(true);
    expect(isMetricComplete({ value: "40", method: "", sourceNote: "项目周报" })).toBe(false);
  });
});
