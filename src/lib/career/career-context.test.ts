import { describe, expect, it } from "vitest";
import { selectRelevantClaims } from "@/lib/career/career-context";
import type { CareerDomainSnapshot } from "@/types/career-domain";

const now = "2026-01-01";
function snapshot(): CareerDomainSnapshot {
  return { schemaVersion: 1, experiences: [{ id: "exp", type: "project", title: "库存", organization: "", role: "", startDate: "", endDate: "", periodText: "", summary: "", order: 0, status: "confirmed", createdAt: now, updatedAt: now }], claims: [
    { id: "relevant", experienceId: "exp", kind: "action", text: "负责库存盘点流程", contribution: "independent", complexity: "routine", hasTradeoff: false, hasMethodReuse: false, status: "confirmed", sourceReference: null, sourceQuote: "", sourceRunId: null, sourceRound: null, createdAt: now, updatedAt: now },
    { id: "unrelated", experienceId: "exp", kind: "action", text: "完成人像摄影", contribution: "independent", complexity: "routine", hasTradeoff: false, hasMethodReuse: false, status: "confirmed", sourceReference: null, sourceQuote: "", sourceRunId: null, sourceRound: null, createdAt: now, updatedAt: now },
  ], metrics: [], capabilities: [], capabilityLinks: [], interviewSessions: [], quarantined: [] };
}

describe("career claim relevance", () => {
  it("does not fall back to the entire fact library", () => {
    expect(selectRelevantClaims(snapshot(), "产品经理", "负责库存盘点").map((item) => item.id)).toEqual(["relevant"]);
    expect(selectRelevantClaims(snapshot(), "法务", "合同诉讼")).toEqual([]);
  });
});
