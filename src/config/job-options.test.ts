import { describe, expect, it } from "vitest";
import { COMPANY_TYPES, isCompanyType, isJobStage, JOB_STAGES } from "@/config/job-options";

describe("job input options", () => {
  it("keeps the five supported company types", () => {
    expect(COMPANY_TYPES).toEqual(["大厂", "中型公司", "创业公司", "外企", "国企"]);
    expect(isCompanyType("中型公司")).toBe(true);
    expect(isCompanyType("未知类型")).toBe(false);
  });

  it("rejects unknown job stages", () => {
    expect(JOB_STAGES).toHaveLength(5);
    expect(isJobStage("社招-中级")).toBe(true);
    expect(isJobStage("自由职业")).toBe(false);
  });
});
