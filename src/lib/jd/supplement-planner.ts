import type { JDRequirementAtom, RequirementAssessment } from "@/types/jd-analysis";
import type { FollowUpQuestion } from "@/types/resume";

const PRIORITY = { critical: 4, high: 3, medium: 2, low: 1 } as const;
const DIMENSION_LABEL = { experience: "相关经历", scope: "场景范围", contribution: "个人贡献", action: "关键行动", result: "实际结果", metric: "指标口径" } as const;

export interface SupplementPlan { primary: FollowUpQuestion[]; optional: FollowUpQuestion[] }

export function planSupplementTasks(requirements: JDRequirementAtom[], assessments: RequirementAssessment[]): SupplementPlan {
  const requirementById = new Map(requirements.map((item) => [item.id, item]));
  const sorted = assessments.filter((item) => item.supplementNeed !== "none").sort((a, b) => {
    const left = requirementById.get(a.requirementId); const right = requirementById.get(b.requirementId);
    return (right ? PRIORITY[right.priority] : 0) - (left ? PRIORITY[left.priority] : 0);
  });
  const questions = sorted.map((item, index): FollowUpQuestion => {
    const requirement = requirementById.get(item.requirementId);
    const missing = item.missingDimensions.map((dimension) => DIMENSION_LABEL[dimension]).join("、");
    const question = item.supplementNeed === "verify-existing"
      ? `请核验原简历中的这段内容是否真实、是否由你本人完成：${item.resumeQuotes[0] ?? requirement?.normalizedText ?? item.requirementId}`
      : item.supplementNeed === "add-detail"
        ? `关于“${requirement?.normalizedText ?? item.requirementId}”，请只补充缺少的${missing || "结果或指标"}。`
        : `你是否有与“${requirement?.normalizedText ?? item.requirementId}”相关的真实经历？没有也可以直接说明。`;
    return {
      id: `supplement-${item.requirementId}-${index + 1}`, requirementId: item.requirementId, question,
      purpose: item.supplementNeed === "verify-existing" ? "核验已有原文" : item.supplementNeed === "add-detail" ? "补充缺失细节" : "确认是否存在相关经历",
      thinkingPrompts: item.supplementNeed === "verify-existing" ? ["这段表述是否准确？", "是你本人完成还是团队完成？"] : item.missingDimensions.map((dimension) => `补充${DIMENSION_LABEL[dimension]}`),
      answerFramework: item.supplementNeed === "new-evidence" ? ["场景", "个人职责", "行动", "结果"] : item.missingDimensions.map((dimension) => DIMENSION_LABEL[dimension]),
      honestNoExperience: "可以明确选择“没有相关经历”，系统不会要求编造。", placeholderExample: "", userAnswer: "", generatedBullet: "",
      supplementNeed: item.supplementNeed, decision: "unreviewed", missingDimensions: item.missingDimensions,
      existingQuote: item.resumeQuotes[0] ?? "", impactLabel: `${requirement?.priority === "critical" ? "关键" : requirement?.priority === "high" ? "高价值" : "可选"}要求 · 影响${item.missingDimensions.map((dimension) => DIMENSION_LABEL[dimension]).join("、") || "证据可信度"}`,
    };
  });
  return { primary: questions.slice(0, 3), optional: questions.slice(3) };
}
