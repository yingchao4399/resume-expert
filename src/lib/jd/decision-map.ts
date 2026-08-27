import type {
  JDAnalysisDocument,
  JDRequirementAtom,
  JDRequirementAtomDraft,
  JDSourceRole,
  JDSourceSpan,
} from "@/types/jd-analysis";
import { JD_MAX_CANDIDATES, JD_CANDIDATE_MESSAGE, JD_MAX_REQUIREMENTS, JD_CAPACITY_MESSAGE } from "./limits";
import { validReferences } from "./consolidation";

const HEADING_PATTERN = /^(?:#{1,6}\s*)?(岗位职责|工作职责|职责描述|职位描述|岗位要求|任职要求|职位要求|任职资格|加分项|优先条件|福利待遇|公司介绍|团队介绍)\s*[:：]?$/;
const BULLET_PATTERN = /^(\s*)(?:[-*•·▪◦]|\d+[.)、]|[一二三四五六七八九十]+[、.)）])\s*/;
const BENEFIT_PATTERN = /福利|薪资|奖金|补贴|假期|团建|五险|公积金|股票|期权/;
const BACKGROUND_PATTERN = /我们是|团队介绍|公司介绍|业务介绍|关于我们|部门介绍|产品介绍/;
const NEGATED_PATTERN = /不要求|无需|无须|不限于?|不作为硬性要求/;
const REQUIRED_PATTERN = /必须|须具备|至少|以上|持有.*证|硬性要求|不可或缺/;
const PREFERRED_PATTERN = /优先|加分项|更佳|最好具备/;

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function sourceRole(text: string, heading: boolean): JDSourceRole {
  if (heading) return "heading";
  if (BENEFIT_PATTERN.test(text)) return "benefit";
  if (BACKGROUND_PATTERN.test(text)) return "background";
  return "requirement";
}

export function parseJDSourceSpans(sourceText: string): JDSourceSpan[] {
  const spans: JDSourceSpan[] = [];
  const pattern = /[^\r\n]+/g;
  let match: RegExpExecArray | null;
  let activeSectionId: string | null = null;

  while ((match = pattern.exec(sourceText))) {
    const raw = match[0];
    const text = raw.trim();
    if (!text) continue;
    const leading = raw.length - raw.trimStart().length;
    const startOffset = match.index + leading;
    const endOffset = startOffset + text.length;
    const isHeading = HEADING_PATTERN.test(text);
    const id = `jd-span-${startOffset}-${endOffset}`;
    if (isHeading) activeSectionId = id;
    const bullet = raw.match(BULLET_PATTERN);
    spans.push({
      id,
      sectionId: isHeading ? null : activeSectionId,
      text,
      startOffset,
      endOffset,
      listLevel: bullet ? Math.floor((bullet[1]?.length ?? 0) / 2) + 1 : 0,
      role: sourceRole(text, isHeading),
    });
  }

  return spans;
}

function draftOrder(a: JDRequirementAtomDraft, b: JDRequirementAtomDraft, spans: Map<string, JDSourceSpan>): number {
  const aSpan = spans.get(a.sourceSpanId);
  const bSpan = spans.get(b.sourceSpanId);
  return (aSpan?.startOffset ?? Number.MAX_SAFE_INTEGER) - (bSpan?.startOffset ?? Number.MAX_SAFE_INTEGER)
    || (aSpan?.text.indexOf(a.sourceQuote) ?? Number.MAX_SAFE_INTEGER) - (bSpan?.text.indexOf(b.sourceQuote) ?? Number.MAX_SAFE_INTEGER)
    || a.normalizedText.localeCompare(b.normalizedText, "zh-CN");
}

function applyDeterministicCues(draft: JDRequirementAtomDraft, span?: JDSourceSpan): JDRequirementAtomDraft {
  const source = `${span?.text ?? ""}\n${draft.sourceQuote}`;
  let modality = draft.modality;
  let priority = draft.priority;
  const priorityBasis = [...draft.priorityBasis];

  if (NEGATED_PATTERN.test(source)) {
    modality = "negated";
    priority = "low";
    priorityBasis.push("原文包含明确否定条件");
  } else if (REQUIRED_PATTERN.test(source)) {
    modality = "required";
    if (priority === "low") priority = "high";
    priorityBasis.push("原文包含明确必选词");
  } else if (PREFERRED_PATTERN.test(source)) {
    modality = "preferred";
    if (priority === "critical") priority = "high";
    priorityBasis.push("原文包含明确优先词");
  }

  return { ...draft, modality, priority, priorityBasis };
}

export function buildJDAnalysisDocument(input: {
  sourceText: string;
  materialRevision: number;
  spans?: JDSourceSpan[];
  drafts: JDRequirementAtomDraft[];
  now?: string;
}): JDAnalysisDocument {
  if (input.drafts.length > JD_MAX_CANDIDATES) throw new Error(JD_CANDIDATE_MESSAGE);
  const spans = input.spans ?? parseJDSourceSpans(input.sourceText);
  const spanMap = new Map(spans.map((span) => [span.id, span]));
  const indexBySpan = new Map<string, number>();
  const requirements: JDRequirementAtom[] = [...input.drafts]
    .sort((a, b) => draftOrder(a, b, spanMap))
    .map((draft) => {
      const span = spanMap.get(draft.sourceSpanId);
      const normalizedDraft = applyDeterministicCues(draft, span);
      const atomIndex = (indexBySpan.get(draft.sourceSpanId) ?? 0) + 1;
      indexBySpan.set(draft.sourceSpanId, atomIndex);
      const anchorValid = Boolean(span && draft.sourceQuote.trim() && span.text.includes(draft.sourceQuote.trim()));
      const deterministicCue = Boolean(span && (NEGATED_PATTERN.test(span.text) || REQUIRED_PATTERN.test(span.text) || PREFERRED_PATTERN.test(span.text)));
      const identity = `${span?.startOffset ?? -1}:${span?.endOffset ?? -1}:${atomIndex}`;
      return {
        ...normalizedDraft,
        id: `req-${stableHash(identity)}`,
        sourceSpanIds: [draft.sourceSpanId],
        sourceQuote: draft.sourceQuote.trim(),
        normalizedText: draft.normalizedText.trim(),
        priorityBasis: [...new Set(normalizedDraft.priorityBasis.map((item) => item.trim()).filter(Boolean))],
        expectedBehavior: draft.expectedBehavior?.trim() ?? "",
        expectedOutcome: draft.expectedOutcome?.trim() || null,
        proficiencySignal: draft.proficiencySignal ?? "unknown",
        keywords: [...new Set((draft.keywords ?? []).map((item) => item.trim()).filter(Boolean))],
        anchorStatus: anchorValid ? "validated" : "needs-review",
        reviewStatus: anchorValid && deterministicCue ? "auto-validated" : "needs-review",
        isHardGate: normalizedDraft.modality === "required" && normalizedDraft.priority === "critical",
        userEdited: false,
      };
    });
  const now = input.now ?? new Date().toISOString();
  return {
    schemaVersion: 2,
    sourceText: input.sourceText,
    materialRevision: input.materialRevision,
    revision: 1,
    status: "draft",
    confirmedRevision: null,
    sourceSpans: spans,
    requirements,
    hypotheses: [],
    qualityFindings: [],
    createdAt: now,
    updatedAt: now,
  };
}

function reviseDocument(document: JDAnalysisDocument, requirements: JDRequirementAtom[], now?: string): JDAnalysisDocument {
  return {
    ...document,
    requirements,
    revision: document.revision + 1,
    status: "draft",
    confirmedRevision: null,
    updatedAt: now ?? new Date().toISOString(),
  };
}

export function confirmSafeRequirements(document: JDAnalysisDocument, now?: string): JDAnalysisDocument {
  return reviseDocument(document, document.requirements.map((requirement) =>
    requirement.reviewStatus === "auto-validated" && validReferences(document, requirement) && !requirement.reviewWarnings?.length
      ? { ...requirement, reviewStatus: "confirmed" }
      : requirement
  ), now);
}

export function confirmRequirement(document: JDAnalysisDocument, requirementId: string, now?: string): JDAnalysisDocument {
  const selected = document.requirements.find(item => item.id === requirementId);
  if (!selected || !validReferences(document, selected)) throw new Error("该要求缺少有效原文出处，不能确认；请拒绝此项或重新解析 JD。");
  return reviseDocument(document, document.requirements.map((requirement) =>
    requirement.id === requirementId
      ? { ...requirement, reviewStatus: "confirmed", anchorStatus: "validated" }
      : requirement
  ), now);
}

export function rejectRequirement(document: JDAnalysisDocument, requirementId: string, now?: string): JDAnalysisDocument {
  return reviseDocument(document, document.requirements.map((requirement) =>
    requirement.id === requirementId ? { ...requirement, reviewStatus: "rejected" } : requirement
  ), now);
}

export function updateRequirementAtom(
  document: JDAnalysisDocument,
  requirementId: string,
  patch: Partial<Pick<JDRequirementAtom, "normalizedText" | "kind" | "modality" | "priority" | "priorityBasis" | "isHardGate" | "expectedBehavior" | "expectedOutcome" | "keywords">>,
  now?: string,
): JDAnalysisDocument {
  return reviseDocument(document, document.requirements.map((requirement) =>
    requirement.id === requirementId
      ? { ...requirement, ...patch, userEdited: true, reviewStatus: "needs-review" }
      : requirement
  ), now);
}

export function confirmJDAnalysisDocument(document: JDAnalysisDocument, now?: string): JDAnalysisDocument {
  if (document.status === "stale") throw new Error("材料已变化，请重新解析 JD，不能重新确认旧地图。");
  if (document.requirements.length > JD_MAX_REQUIREMENTS) throw new Error(JD_CAPACITY_MESSAGE);
  if (document.requirements.some(item => item.reviewStatus === "confirmed" && !validReferences(document, item))) throw new Error("已确认要求中存在无效原文引用，请重新核验。");
  const unresolved = document.requirements.filter((item) => item.reviewStatus !== "confirmed" && item.reviewStatus !== "rejected");
  if (unresolved.length) throw new Error(`仍有 ${unresolved.length} 条岗位要求待复核。`);

  const confirmedSpanIds = new Set(document.requirements
    .filter((item) => item.reviewStatus === "confirmed")
    .flatMap((item) => item.sourceSpanIds));
  const uncovered = document.sourceSpans.filter((span) => span.role === "requirement" && !confirmedSpanIds.has(span.id));
  if (uncovered.length) throw new Error(`仍有原文条目未覆盖：${uncovered.map((item) => item.text).join("；")}`);

  return {
    ...document,
    status: "confirmed",
    confirmedRevision: document.revision,
    updatedAt: now ?? new Date().toISOString(),
  };
}
