import type { JDRequirementAtomDraft } from "@/types/jd-analysis";

export type CareerSeniority = "campus" | "regular" | "senior" | "lead";

export function inferRequirementDraft(source: string, seniority: CareerSeniority): Pick<JDRequirementAtomDraft, "normalizedText" | "kind" | "modality" | "priority"> {
  const negated = /不要求|无需|不限/.test(source);
  const preferred = /优先|加分项|更佳/.test(source);
  const modality = negated ? "negated" as const : preferred ? "preferred" as const : "required" as const;
  const normalizedText = negated ? source.trim() : source.trim()
    .replace(/^必须(?:能够)?/, "")
    .replace(/者优先$|优先$|为加分项$|更佳$/, "")
    .trim();
  let kind: JDRequirementAtomDraft["kind"] = "task";
  if (/学历|专业背景/.test(source)) kind = "education";
  else if (/证书|认证|职业资格/.test(source)) kind = "credential";
  else if (/行业背景|海外业务/.test(source)) kind = "industry";
  else if (/客户资源/.test(source)) kind = "constraint";
  else if (/跨团队|协同|达成共识/.test(source)) kind = "collaboration";
  else if (/经验|经历|有.+(?:项目|实践|贡献).*(?:优先|加分)/.test(source)) kind = "experience";
  else if (/^负责/.test(source)) kind = "task";
  else if (/能力|熟悉|掌握/.test(source)) kind = "skill";
  else if (/对.+目标负责|建立.+(?:体系|机制)/.test(source)) kind = "deliverable";

  let priority: JDRequirementAtomDraft["priority"] = "high";
  if (negated) priority = "low";
  else if (preferred) priority = seniority === "senior" ? "high" : "medium";
  else if (seniority === "campus") priority = "medium";
  else if ((seniority === "senior" && /主导|设计|制定/.test(source)) || (seniority === "lead" && /^必须/.test(source))) priority = "critical";
  return { normalizedText, kind, modality, priority };
}
