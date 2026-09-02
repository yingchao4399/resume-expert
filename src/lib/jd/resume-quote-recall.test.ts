import { expect, it } from "vitest";
import { findResumeQuotes } from "@/lib/jd/resume-quote-recall";
import type { JDRequirementAtom } from "@/types/jd-analysis";

it("recalls explicit ERP/WMS and ToB SaaS evidence from the original resume", () => {
  const requirement = { normalizedText: "具备 ERP/WMS ToB SaaS 产品经验", sourceQuote: "熟悉 ERP、WMS 和 ToB SaaS", keywords: ["ERP", "WMS", "ToB SaaS"] } as JDRequirementAtom;
  const resume = "产品经理\n负责 ERP 与 WMS 产品规划，交付 ToB SaaS 解决方案。\n推动跨部门协作。";
  expect(findResumeQuotes(resume, requirement)).toEqual(["负责 ERP 与 WMS 产品规划，交付 ToB SaaS 解决方案。"]);
});
