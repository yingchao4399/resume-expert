import { describe, expect, it } from "vitest";
import { assembleRequirements, rankCareerClaimsByRequirement, rankCareerClaimsForRequirements, splitJDSourceItems, validateMatchReferences } from "@/lib/jd/deep-analysis";
import type { CareerAnalysisClaim } from "@/lib/career/career-context";

describe("deep JD analysis primitives", () => {
  it("splits every source line and preserves exact offsets", () => {
    const jd = "岗位职责：\n- 负责 AI 产品规划与迭代\n福利：五险一金";
    const items = splitJDSourceItems(jd);
    expect(items).toHaveLength(3);
    for (const item of items) expect(jd.slice(item.startOffset, item.endOffset)).toBe(item.text);
    expect(items[2].classification).toBe("benefit");
  });

  it("splits a long single paragraph deterministically", () => {
    const jd = `${"负责产品规划与需求分析，推动产品迭代并复盘。".repeat(8)}需要跨团队协作；提供五险一金。`;
    expect(splitJDSourceItems(jd).length).toBeGreaterThan(1);
  });

  it("marks invalid source quotes for review", () => {
    const source = splitJDSourceItems("- 熟悉 TypeScript 和 React");
    const requirements = assembleRequirements(source, [
      { sourceItemId: source[0].id, sourceQuote: "TypeScript", requirement: "熟悉 TypeScript", category: "skill", priority: "must", keywords: ["TypeScript"], interviewFocus: "项目使用" },
      { sourceItemId: source[0].id, sourceQuote: "Python", requirement: "熟悉 Python", category: "skill", priority: "preferred", keywords: ["Python"], interviewFocus: "项目使用" },
    ]);
    expect(requirements.map((item) => item.anchorStatus)).toEqual(["validated", "needs-review"]);
  });

  it("rejects more than 120 atomic requirements", () => {
    const source = splitJDSourceItems("负责产品规划");
    const draft = { sourceItemId: source[0].id, sourceQuote: source[0].text, requirement: "产品规划", category: "responsibility" as const, priority: "must" as const, keywords: ["产品"], interviewFocus: "案例" };
    expect(() => assembleRequirements(source, Array.from({ length: 121 }, () => draft))).toThrow("超过 120 条");
  });

  it("ranks only related confirmed structured facts and caps at 12", () => {
    const source = splitJDSourceItems("需要 TypeScript 与 React 开发经验");
    const requirements = assembleRequirements(source, [{ sourceItemId: source[0].id, sourceQuote: source[0].text, requirement: "TypeScript 与 React 开发", category: "skill", priority: "must", keywords: ["TypeScript", "React"], interviewFocus: "代码案例" }]);
    const claims: CareerAnalysisClaim[] = Array.from({ length: 15 }, (_, index) => ({ id: `claim-${index}`, experienceId: "exp", experienceTitle: "前端平台", organization: "", role: "工程师", text: `使用 TypeScript 开发 React 模块 ${index}`, kind: "action", contribution: "independent", complexity: "routine", hasTradeoff: false, hasMethodReuse: false, capabilities: [], metrics: [] }));
    claims.push({ ...claims[0], id: "unrelated", text: "负责食堂采购" });
    const selected = rankCareerClaimsForRequirements(claims, requirements, { targetRole: "前端工程师" });
    expect(selected).toHaveLength(12);
    expect(selected.some((item) => item.id === "unrelated")).toBe(false);
  });

  it("recalls up to three facts independently for every requirement", () => {
    const source = splitJDSourceItems("需要 React\n需要 SQL");
    const requirements = assembleRequirements(source, [
      { sourceItemId: source[0].id, sourceQuote: "React", requirement: "React 开发", category: "skill", priority: "must", keywords: ["React"], interviewFocus: "项目" },
      { sourceItemId: source[1].id, sourceQuote: "SQL", requirement: "SQL 分析", category: "skill", priority: "must", keywords: ["SQL"], interviewFocus: "项目" },
    ]);
    const base = { experienceId: "exp", experienceTitle: "项目", organization: "", role: "工程师", kind: "action" as const, contribution: "independent" as const, complexity: "routine" as const, hasTradeoff: false, hasMethodReuse: false, capabilities: [], metrics: [] };
    const claims: CareerAnalysisClaim[] = [
      { ...base, id: "react", text: "使用 React 开发后台" },
      { ...base, id: "sql", text: "使用 SQL 分析转化漏斗" },
    ];
    const selected = rankCareerClaimsByRequirement(claims, requirements, { targetRole: "产品工程师" }, 3);
    expect(selected.get(requirements[0].id)?.map((item) => item.id)).toEqual(["react"]);
    expect(selected.get(requirements[1].id)?.map((item) => item.id)).toEqual(["sql"]);
  });

  it("drops model-created fact IDs and resume quotes", () => {
    const source = splitJDSourceItems("需要 TypeScript");
    const requirements = assembleRequirements(source, [{ sourceItemId: source[0].id, sourceQuote: "TypeScript", requirement: "TypeScript", category: "skill", priority: "must", keywords: ["TypeScript"], interviewFocus: "项目" }]);
    const claims: CareerAnalysisClaim[] = [{ id: "real", experienceId: "exp", experienceTitle: "项目", organization: "", role: "", text: "使用 TypeScript", kind: "action", contribution: "independent", complexity: "routine", hasTradeoff: false, hasMethodReuse: false, capabilities: [], metrics: [] }];
    const [validated] = validateMatchReferences([{ requirementId: requirements[0].id, evidenceClaimIds: ["real", "fake"], resumeQuotes: ["真实引用", "虚构引用"], evidenceStrength: "strong", needsSupplement: false, resumeEvidence: "引用", matchRationale: "模型匹配", missingEvidenceTypes: [] }], requirements, claims, "简历中的真实引用");
    expect(validated.evidenceClaimIds).toEqual(["real"]);
    expect(validated.resumeQuotes).toEqual(["真实引用"]);
  });

  it("downgrades a match when every model reference is invalid", () => {
    const source = splitJDSourceItems("需要 TypeScript");
    const requirements = assembleRequirements(source, [{ sourceItemId: source[0].id, sourceQuote: "TypeScript", requirement: "TypeScript", category: "skill", priority: "must", keywords: ["TypeScript"], interviewFocus: "项目" }]);
    const [validated] = validateMatchReferences([{ requirementId: requirements[0].id, evidenceClaimIds: ["fake"], resumeQuotes: ["虚构引用"], evidenceStrength: "strong", needsSupplement: false, resumeEvidence: "虚构证据", matchRationale: "模型声称匹配", missingEvidenceTypes: [] }], requirements, [], "真实简历");
    expect(validated).toMatchObject({ evidenceStrength: "none", needsSupplement: true, evidenceClaimIds: [], resumeQuotes: [] });
  });
});
