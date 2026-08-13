import { describe, expect, it } from "vitest";
import { migrateLegacyEvidence } from "@/lib/career/migration";
import type { CareerEvidence } from "@/types/resume";

function legacy(id: string, patch: Partial<CareerEvidence> = {}): CareerEvidence {
  return { id, type: "work", title: "库存改造", organization: "示例公司", role: "产品经理", period: "2024", description: "独立重构库存流程", metrics: [], skills: [], status: "confirmed", sourceType: "manual", sourceDocumentId: null, sourceReference: null, createdAt: "2026-01-01", updatedAt: "2026-01-01", ...patch };
}

describe("legacy career migration", () => {
  it("groups reliable records and preserves claim ids", () => {
    const result = migrateLegacyEvidence([legacy("e-1"), legacy("e-2", { description: "完成验收" })]);
    expect(result.experiences).toHaveLength(1);
    expect(result.experiences[0].status).toBe("candidate");
    expect(result.claims.map((item) => item.id)).toEqual(["e-1", "e-2"]);
    expect(result.claims.every((item) => item.status === "needs-review")).toBe(true);
  });

  it("places ungroupable skills and achievements in the inbox", () => {
    const result = migrateLegacyEvidence([legacy("skill-1", { type: "skill", organization: "", description: "TypeScript", skills: ["TypeScript"] })]);
    expect(result.experiences[0]).toMatchObject({ id: "experience-inbox", type: "inbox", status: "needs-review" });
    expect(result.claims[0].experienceId).toBe("experience-inbox");
  });
});
