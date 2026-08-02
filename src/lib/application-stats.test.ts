import { describe, expect, it } from "vitest";
import { calculateApplicationStats } from "@/lib/application-stats";
import type { JobApplication, JobApplicationStatus } from "@/types/resume";

function application(id: string, status: JobApplicationStatus): JobApplication {
  return { id, company: "示例", role: "产品经理", jdUrl: "", jdText: "", status, appliedAt: "", nextStepAt: "", notes: "", resumeDocumentId: null, createdAt: "", updatedAt: "" };
}

describe("application stats", () => {
  it("calculates deterministic funnel rates without treating preparation as submitted", () => {
    const result = calculateApplicationStats([
      application("1", "准备中"), application("2", "已投递"), application("3", "面试"), application("4", "Offer"),
    ]);
    expect(result.counts["准备中"]).toBe(1);
    expect(result.interviewRate).toBe(67);
    expect(result.offerRate).toBe(33);
  });
});
