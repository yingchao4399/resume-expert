import { describe, expect, it } from "vitest";
import { buildJDAnalysisDocument, confirmRequirement, confirmSafeRequirements, parseJDSourceSpans } from "./decision-map";
import { applyConsolidation, defaultRequirementGroups, mockConsolidation, prepareConsolidation, restorePreviousMap } from "./consolidation";
import { planJDTaskBudget } from "@/lib/ai/jd-task-budget";
import type { JDRequirementKind } from "@/types/jd-analysis";
import { jdAnalysisDocumentSchema, jdConsolidationProposalSchema } from "./schemas";

function fixture(texts: string[], kind: JDRequirementKind = "skill") {
  const sourceText = texts.join("\n");
  const spans = parseJDSourceSpans(sourceText);
  return confirmSafeRequirements(buildJDAnalysisDocument({ sourceText, materialRevision: 2, spans,
    drafts: spans.map(span => ({ sourceSpanId: span.id, sourceQuote: span.text, normalizedText: span.text, kind, modality: "required", priority: "high", priorityBasis: ["原文"] })) }));
}
function candidate(document: ReturnType<typeof fixture>, text = document.requirements[0].normalizedText) {
  return { merges: [{ memberIds: document.requirements.slice(0, 2).map(item => item.id), text, reason: "相同职责的不同表述" }],
    groups: [{ title: "跨团队交付", meaning: "协调不同职能共同交付", outcome: "信息不足", proof: "准备真实协作案例", memberIds: document.requirements.map(item => item.id) }] };
}

describe("semantic consolidation shared write gate", () => {
  it("applies server-validated proposals despite JSON property ordering", () => {
    const document = fixture(["必须沟通", "必须沟通"]);
    const proposal = jdConsolidationProposalSchema.parse(mockConsolidation(jdAnalysisDocumentSchema.parse(document)));
    expect(applyConsolidation(document, proposal).requirements).toHaveLength(1);
  });
  it("merges equivalent wording with every source, review and restore", () => {
    const document = fixture(["必须跨部门协作推进交付", "必须协调多个部门推进交付", "必须进行用户研究"]);
    const proposal = prepareConsolidation(document, candidate(document), "llm");
    expect(proposal.merges).toHaveLength(1);
    const result = applyConsolidation(document, proposal);
    expect(result.requirements).toHaveLength(2);
    expect(result.requirements[0].sourceReferences).toHaveLength(2);
    expect(result.requirements[0].reviewStatus).toBe("needs-review");
    expect(result.requirements[1]).toEqual(document.requirements[2]);
    expect(result.groups?.[0].requirementIds).toHaveLength(2);
    expect(confirmSafeRequirements(result).requirements[0].reviewStatus).toBe("needs-review");
    expect(confirmRequirement(result, result.requirements[0].id).requirements[0].reviewStatus).toBe("confirmed");
    expect(restorePreviousMap(result).requirements).toEqual(document.requirements);
    expect(document.requirements).toHaveLength(3);
  });
  it.each([
    ["必须具备3年以上经验", "必须具备5年以上经验"], ["必须会SQL", "必须会Python"],
    ["本科以上", "硕士以上"], ["必须跨部门沟通", "跨部门沟通优先"], ["必须有管理经验", "不要求有管理经验"],
  ])("preserves independent conditions: %s / %s", (a, b) => {
    const document = fixture([a, b]);
    const proposal = prepareConsolidation(document, candidate(document), "llm");
    expect(proposal.merges).toHaveLength(0);
    expect(proposal.warnings.length).toBeGreaterThan(0);
    expect(applyConsolidation(document, proposal).requirements).toEqual(document.requirements);
  });
  it("rejects new metrics and keeps unmappable anchors", () => {
    const document = fixture(["必须协调交付", "必须协调交付"]);
    expect(prepareConsolidation(document, candidate(document, "必须协调交付并提升50%"), "llm").merges).toHaveLength(0);
    document.requirements[0].sourceQuote = "不在原文";
    expect(prepareConsolidation(document, candidate(document), "llm").merges).toHaveLength(0);
  });
  it("does not promote group-level invented outcomes or proficiency changes", () => {
    const document = fixture(["熟悉 SQL", "精通 SQL"], "tool");
    const output = candidate(document);
    output.groups[0].outcome = "提升效率50%";
    const proposal = prepareConsolidation(document, output, "llm");
    expect(proposal.merges).toHaveLength(0);
    expect(applyConsolidation(document, proposal).groups?.[0].outcome).toContain("信息不足");
  });
  it("refuses omitted, duplicate and fabricated member IDs", () => {
    const document = fixture(["必须沟通", "必须沟通"]);
    const output = candidate(document);
    output.groups[0].memberIds = [document.requirements[0].id];
    expect(() => prepareConsolidation(document, output, "llm")).toThrow("完整");
    output.merges[0].memberIds[0] = "fabricated";
    expect(() => prepareConsolidation(document, output, "llm")).toThrow("引用");
  });
  it("supports opting out of a merge without losing originals", () => {
    const document = fixture(["必须跨团队协作", "必须跨团队协作"]);
    const proposal = mockConsolidation(document);
    expect(proposal.merges).toHaveLength(1);
    expect(applyConsolidation(document, proposal, []).requirements).toEqual(document.requirements);
    expect(() => applyConsolidation({ ...document, revision: document.revision + 1 }, proposal)).toThrow("变化");
  });
  it("is deterministic and does not merge merely related tasks in Mock", () => {
    const document = fixture(["用户研究", "需求优先级排序", "需求优先级排序"]);
    const first = mockConsolidation(document);
    expect(first.merges).toEqual(mockConsolidation(document).merges);
    expect(applyConsolidation(document, first).requirements).toHaveLength(2);
    expect(defaultRequirementGroups(document.requirements).flatMap(group => group.requirementIds)).toHaveLength(3);
  });
  it("plans up to 120-item interviews with repair reserve and refuses impossible jobs", () => {
    expect(planJDTaskBudget(24)).toEqual({ maxProviderRequests: 28, timeoutMs: 360000 });
    expect(planJDTaskBudget(5).maxProviderRequests).toBe(9);
    expect(() => planJDTaskBudget(25)).toThrow("预算");
  });
});
