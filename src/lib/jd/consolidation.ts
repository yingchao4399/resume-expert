import { z } from "zod";
import type { JDAnalysisDocument, JDConsolidationProposal, JDRequirementAtom, JDRequirementGroup, JDSourceReference } from "@/types/jd-analysis";
import { JD_MAX_CANDIDATES, JD_MAX_REQUIREMENTS, JD_CAPACITY_MESSAGE, JD_CANDIDATE_MESSAGE } from "./limits";

export const consolidationModelSchema = z.object({
  merges: z.array(z.object({ memberIds: z.array(z.string()).min(2).max(JD_MAX_CANDIDATES), text: z.string().min(1).max(500), reason: z.string().min(1).max(300) })).max(120),
  groups: z.array(z.object({ title: z.string().min(1).max(80), meaning: z.string().max(400), outcome: z.string().max(300), proof: z.string().max(300), memberIds: z.array(z.string()).min(1).max(JD_MAX_CANDIDATES) })).min(1).max(12),
});
export type ConsolidationModelOutput = z.infer<typeof consolidationModelSchema>;

export function jdHash(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}
export function mapFingerprint(document: JDAnalysisDocument): string {
  // Zod reconstructs object key order on the server; identity must ignore that order.
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)])) : value;
  return jdHash(JSON.stringify(canonical([document.sourceText, document.materialRevision, document.revision, document.requirements])));
}
const normalized = (text: string) => text.toLocaleLowerCase().replace(/[\s，。；：、,.!?！？;:（）()“”"'·•-]/g, "");
const unique = <T>(values: T[]) => [...new Set(values)];

export function sourceReferences(document: JDAnalysisDocument, atom: JDRequirementAtom): JDSourceReference[] {
  if (atom.sourceReferences?.length) return atom.sourceReferences;
  const span = document.sourceSpans.find(item => item.id === atom.sourceSpanId);
  if (!span || !atom.sourceQuote || !span.text.includes(atom.sourceQuote)) return [];
  const startOffset = span.startOffset + span.text.indexOf(atom.sourceQuote);
  return [{ sourceSpanId: span.id, quote: atom.sourceQuote, startOffset, endOffset: startOffset + atom.sourceQuote.length }];
}

export function validReferences(document: JDAnalysisDocument, atom: JDRequirementAtom): boolean {
  const refs = sourceReferences(document, atom);
  return refs.length > 0 && atom.sourceSpanIds.every(id => refs.some(ref => ref.sourceSpanId === id)) && refs.every(ref => {
    const span = document.sourceSpans.find(item => item.id === ref.sourceSpanId);
    return span && ref.quote.trim() && ref.startOffset >= span.startOffset && ref.endOffset <= span.endOffset
      && document.sourceText.slice(ref.startOffset, ref.endOffset) === ref.quote;
  });
}

// These protected tokens are an additional rejection gate, not a semantic oracle.
function constraints(text: string): string[] {
  const proficiency = text.match(/精通|熟练|熟悉|独立|主导|协助|^了解(?=.+方法)/g) ?? [];
  return unique([...(text.match(/\d+(?:\.\d+)?(?:\s*[-~至]\s*\d+)?\s*(?:年以上|年以下|年|个月|%|人|万|岁)?|本科|硕士|博士|大专|学士|至少|以上|以下|不低于|不超过|必须|无需|不要求|不限|优先|加分|[a-zA-Z][a-zA-Z0-9+#.\/-]*/g) ?? []), ...proficiency].map(normalized)).sort();
}
function mergeFailure(document: JDAnalysisDocument, members: JDRequirementAtom[], text: string): string | null {
  if (members.some(item => item.reviewStatus === "rejected" || item.anchorStatus !== "validated" || !validReferences(document, item))) return "存在被拒绝项或无效原文引用";
  const signatures = members.map(item => JSON.stringify([item.kind, item.modality, item.isHardGate, item.priority, item.proficiencySignal ?? "unknown", constraints(item.normalizedText)]));
  if (new Set(signatures).size !== 1) return "类别、门槛、优先级、熟练程度或数字／工具条件不同，不自动合并";
  const originalTokens = unique(members.flatMap(item => constraints(item.normalizedText)));
  const changedTokens = constraints(text);
  if (originalTokens.some(token => !changedTokens.includes(token)) || changedTokens.some(token => !originalTokens.includes(token))) return "改写增加或遗漏了受保护的条件";
  return null;
}

const GROUPS: Record<JDRequirementAtom["kind"], [string, string]> = {
  task: ["task", "核心任务"], deliverable: ["deliverable", "交付成果"], knowledge: ["knowledge", "专业知识"],
  skill: ["skill", "专业能力"], tool: ["tool", "工具与技术"], experience: ["experience", "经历要求"],
  education: ["education", "学历条件"], credential: ["credential", "资质证书"], industry: ["industry", "行业理解"],
  collaboration: ["collaboration", "协作推进"], "work-context": ["context", "工作情境"], constraint: ["constraint", "限制条件"],
};
export function defaultRequirementGroups(requirements: JDRequirementAtom[]): JDRequirementGroup[] {
  const groups = new Map<string, JDRequirementGroup>();
  for (const item of requirements) {
    const [id, title] = GROUPS[item.kind];
    const group = groups.get(id) ?? { id: `group-${id}`, title, meaning: "按原文类别整理；未进行额外语义推断。", outcome: "以原文细则为准；未明确的成果或指标仍为未知。", proof: "准备能逐条核验的真实经历、行动及结果。", requirementIds: [] };
    group.requirementIds.push(item.id);
    groups.set(id, group);
  }
  return [...groups.values()];
}

export function migrateJDMap(document: JDAnalysisDocument): JDAnalysisDocument {
  return { ...document, schemaVersion: 2, groups: document.groups?.length ? document.groups : defaultRequirementGroups(document.requirements),
    requirements: document.requirements.map(atom => ({ ...atom, sourceReferences: sourceReferences(document, atom) })),
    previousMap: document.previousMap ? { ...document.previousMap, schemaVersion: 2 } : null };
}

/** Validate a compact semantic proposal against immutable input, without writing state. */
export function prepareConsolidation(document: JDAnalysisDocument, output: ConsolidationModelOutput, mode: "llm" | "mock"): JDConsolidationProposal {
  if (document.requirements.length > JD_MAX_CANDIDATES) throw new Error(JD_CANDIDATE_MESSAGE);
  const parsed = consolidationModelSchema.parse(output);
  const byId = new Map(document.requirements.map(item => [item.id, item]));
  if (byId.size !== document.requirements.length) throw new Error("原需求 ID 重复，不能安全整理。");
  const used = new Set<string>();
  const warnings: string[] = [];
  const merges: JDConsolidationProposal["merges"] = [];
  for (const candidate of parsed.merges) {
    if (new Set(candidate.memberIds).size !== candidate.memberIds.length || candidate.memberIds.some(id => !byId.has(id) || used.has(id))) throw new Error("归并结果引用不存在或重复分配的要求，未应用任何变更。");
    candidate.memberIds.forEach(id => used.add(id));
    const members = candidate.memberIds.map(id => byId.get(id)!);
    const failure = mergeFailure(document, members, candidate.text);
    if (failure) { warnings.push(`保留原项「${members[0].normalizedText}」：${failure}`); continue; }
    merges.push({ ...candidate, memberIds: [...candidate.memberIds].sort(), id: `merge-${jdHash([...candidate.memberIds].sort().join("|"))}` });
  }
  const assigned = parsed.groups.flatMap(group => group.memberIds);
  if (assigned.length !== byId.size || new Set(assigned).size !== byId.size || assigned.some(id => !byId.has(id))) throw new Error("核心分组未完整、唯一覆盖全部原要求，已有地图未改变。");
  // A merge cannot straddle independent core groups.
  const safeMerges = merges.filter(merge => {
    const count = parsed.groups.filter(group => group.memberIds.some(id => merge.memberIds.includes(id))).length;
    if (count > 1) warnings.push(`保留原项「${merge.text}」：模型把同组归并项分到了不同核心组`);
    return count === 1;
  });
  return { materialRevision: document.materialRevision, baseRevision: document.revision, baseFingerprint: mapFingerprint(document), mode,
    merges: safeMerges, warnings, createdAt: new Date().toISOString(),
    groups: parsed.groups.map(group => {
      // A group explanation must never promote an invented result to an explicit JD fact.
      const outcome = group.outcome.trim();
      const grounded = outcome && group.memberIds.some(id => sourceReferences(document, byId.get(id)!).some(ref => normalized(ref.quote).includes(normalized(outcome))));
      return { id: `group-${jdHash([...group.memberIds].sort().join("|"))}`, title: group.title, meaning: group.meaning,
        outcome: grounded ? outcome : "信息不足：未找到可逐字核验的成果表述，请查看各细则原文。", proof: group.proof, requirementIds: group.memberIds };
    }),
  };
}

export function mockConsolidation(document: JDAnalysisDocument): JDConsolidationProposal {
  const identical = new Map<string, JDRequirementAtom[]>();
  for (const atom of document.requirements) {
    const key = JSON.stringify([normalized(atom.normalizedText), atom.kind, atom.modality, atom.priority, atom.isHardGate, atom.proficiencySignal]);
    identical.set(key, [...(identical.get(key) ?? []), atom]);
  }
  return prepareConsolidation(document, {
    merges: [...identical.values()].filter(items => items.length > 1).map(items => ({ memberIds: items.map(item => item.id), text: items[0].normalizedText, reason: "Mock 仅归并文本及约束一致的重复项，不进行语义推断。" })),
    groups: defaultRequirementGroups(document.requirements).map(group => ({ ...group, memberIds: group.requirementIds })),
  }, "mock");
}

export function applyConsolidation(document: JDAnalysisDocument, proposal: JDConsolidationProposal, selectedIds = proposal.merges.map(item => item.id), keepSnapshot = true): JDAnalysisDocument {
  if (document.materialRevision !== proposal.materialRevision || document.revision !== proposal.baseRevision || mapFingerprint(document) !== proposal.baseFingerprint) throw new Error("材料或需求地图已变化，请重新整理；旧提案未应用。");
  if (selectedIds.some(id => !proposal.merges.some(item => item.id === id))) throw new Error("选择了不存在的合并项。");
  // Revalidate server results / persisted proposals at the write gate as well.
  const verified = prepareConsolidation(document, { merges: proposal.merges, groups: proposal.groups.map(group => ({ ...group, memberIds: group.requirementIds })) }, proposal.mode);
  const selected = verified.merges.filter(item => selectedIds.includes(item.id));
  const lookup = new Map(selected.flatMap(merge => merge.memberIds.map(id => [id, merge] as const)));
  const requirements: JDRequirementAtom[] = [];
  const produced = new Set<string>();
  const remap = new Map<string, string>();
  for (const atom of document.requirements) {
    const merge = lookup.get(atom.id);
    if (!merge) { requirements.push(atom); remap.set(atom.id, atom.id); continue; }
    const id = `req-${jdHash(merge.memberIds.join("|"))}`;
    remap.set(atom.id, id);
    if (produced.has(id)) continue;
    produced.add(id);
    const members = document.requirements.filter(item => merge.memberIds.includes(item.id));
    const refs = [...new Map(members.flatMap(item => sourceReferences(document, item)).map(ref => [`${ref.sourceSpanId}:${ref.startOffset}:${ref.endOffset}`, ref])).values()];
    requirements.push({ ...members[0], id, normalizedText: merge.text, sourceReferences: refs, sourceSpanIds: unique(refs.map(ref => ref.sourceSpanId)),
      originalRequirementIds: unique(members.flatMap(item => item.originalRequirementIds ?? [item.id])), mergeReason: merge.reason,
      keywords: unique(members.flatMap(item => item.keywords ?? [])), priorityBasis: unique(members.flatMap(item => item.priorityBasis)),
      expectedOutcome: unique(members.map(item => item.expectedOutcome).filter((value): value is string => Boolean(value))).join("；") || null,
      expectedBehavior: unique(members.map(item => item.expectedBehavior).filter((value): value is string => Boolean(value))).join("；"),
      reviewStatus: "needs-review", reviewWarnings: ["归并后的语义需人工核验，确认未遗漏原文约束。"], userEdited: false });
  }
  if (requirements.length > JD_MAX_REQUIREMENTS) throw new Error(JD_CAPACITY_MESSAGE);
  const { previousMap: _previous, ...snapshot } = document;
  void _previous;
  return { ...document, schemaVersion: 2, revision: document.revision + 1, status: "draft", confirmedRevision: null,
    requirements, groups: verified.groups.map(group => ({ ...group, requirementIds: unique(group.requirementIds.map(id => remap.get(id)!)) })),
    consolidationWarnings: proposal.warnings, consolidationMode: proposal.mode, updatedAt: new Date().toISOString(), previousMap: keepSnapshot ? snapshot : null };
}

export function restorePreviousMap(document: JDAnalysisDocument): JDAnalysisDocument {
  if (!document.previousMap) throw new Error("没有可恢复的整理前地图。");
  if (document.previousMap.materialRevision !== document.materialRevision) throw new Error("材料已变化，不能恢复旧材料的需求地图。");
  const previous = document.previousMap;
  return { ...previous, schemaVersion: 2, revision: document.revision + 1, status: "draft", confirmedRevision: null, previousMap: null, updatedAt: new Date().toISOString() };
}
