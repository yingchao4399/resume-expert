import type { CareerAnalysisClaim } from "@/lib/career/career-context";
import type {
  CoreCompetency,
  JDSourceClassification,
  JDSourceItem,
  JobRequirement,
  JobRequirementCategory,
  RequirementPriority,
  UserInput,
} from "@/types/resume";

const BULLET_PREFIX = /^\s*(?:[-*•·▪◦]|\d+[.)、]|[一二三四五六七八九十]+[、.)）])\s*/;
const BENEFIT_WORDS = /福利|薪资|奖金|补贴|假期|团建|五险|公积金|股票|期权/;
const BACKGROUND_WORDS = /我们是|团队介绍|公司介绍|业务介绍|关于我们|部门介绍|产品介绍/;

function stableSourceId(index: number): string {
  return `jd-source-${index + 1}`;
}

export function splitJDSourceItems(jd: string): JDSourceItem[] {
  const items: JDSourceItem[] = [];
  const linePattern = /[^\r\n]+/g;
  let match: RegExpExecArray | null;
  while ((match = linePattern.exec(jd))) {
    const raw = match[0];
    const leading = raw.length - raw.trimStart().length;
    const trailing = raw.length - raw.trimEnd().length;
    const text = raw.trim();
    if (!text) continue;
    const startOffset = match.index + leading;
    const endOffset = match.index + raw.length - trailing;
    const classification: JDSourceClassification = BENEFIT_WORDS.test(text)
      ? "benefit"
      : BACKGROUND_WORDS.test(text)
        ? "background"
        : "requirement";
    items.push({ id: stableSourceId(items.length), text, startOffset, endOffset, classification });
  }
  if (items.length === 1 && items[0].text.length > 120) {
    const only = items[0];
    const pieces = [...only.text.matchAll(/[^。；;]+[。；;]?/g)]
      .map((part) => ({ text: part[0].trim(), offset: part.index ?? 0 }))
      .filter((part) => part.text.length >= 4);
    if (pieces.length > 1) {
      return pieces.map((part, index) => ({
        id: stableSourceId(index),
        text: part.text,
        startOffset: only.startOffset + part.offset,
        endOffset: only.startOffset + part.offset + part.text.length,
        classification: BENEFIT_WORDS.test(part.text) ? "benefit" : BACKGROUND_WORDS.test(part.text) ? "background" : "requirement",
      }));
    }
  }
  return items;
}

export function cleanRequirementText(value: string): string {
  return value.replace(BULLET_PREFIX, "").trim();
}

function normalizedTerms(value: string): string[] {
  const lower = value.toLocaleLowerCase();
  const words = lower.split(/[\s,，。；;、/()（）【】\[\]:：+]+/).map((item) => item.trim()).filter((item) => item.length >= 2);
  const latin = lower.match(/[a-z][a-z0-9+#.-]{1,}/g) ?? [];
  const chinese = lower.match(/[\u3400-\u9fff]{2,}/g)?.flatMap((chunk) => {
    const grams: string[] = [];
    for (let size = 2; size <= Math.min(4, chunk.length); size += 1) {
      for (let index = 0; index <= chunk.length - size; index += 1) grams.push(chunk.slice(index, index + size));
    }
    return grams;
  }) ?? [];
  return [...new Set([...words, ...latin, ...chinese])];
}

export function rankCareerClaimsForRequirements(
  claims: CareerAnalysisClaim[],
  requirements: JobRequirement[],
  input: Pick<UserInput, "targetRole">,
  limit = 12,
): CareerAnalysisClaim[] {
  const requirementText = requirements.map((item) => `${item.requirement} ${item.keywords.join(" ")}`).join(" ");
  const targetTerms = normalizedTerms(`${input.targetRole} ${requirementText}`);
  return claims
    .map((claim) => {
      const claimTerms = normalizedTerms([
        claim.text,
        claim.experienceTitle,
        claim.role,
        ...claim.capabilities.flatMap((item) => [item.name, ...item.aliases]),
      ].join(" "));
      const overlap = claimTerms.filter((term) => targetTerms.some((target) => target === term || target.includes(term) || term.includes(target)));
      const capabilityBonus = claim.capabilities.filter((capability) => requirements.some((requirement) =>
        [capability.name, ...capability.aliases].some((name) => `${requirement.requirement} ${requirement.keywords.join(" ")}`.toLocaleLowerCase().includes(name.toLocaleLowerCase())),
      )).length * 4;
      return { claim, score: overlap.length + capabilityBonus + (claim.metrics.length ? 1 : 0) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.claim.id.localeCompare(b.claim.id))
    .slice(0, limit)
    .map((item) => item.claim);
}

export interface JDRequirementDraft {
  sourceItemId: string;
  sourceQuote: string;
  requirement: string;
  category: JobRequirementCategory;
  priority: RequirementPriority;
  keywords: string[];
  interviewFocus: string;
}

export function assembleRequirements(sourceItems: JDSourceItem[], drafts: JDRequirementDraft[]): JobRequirement[] {
  if (drafts.length > 40) throw new Error("JD 拆分后超过 40 条原子要求，请精简或分段分析 JD。");
  const sources = new Map(sourceItems.map((item) => [item.id, item]));
  return drafts.map((draft, index) => {
    const source = sources.get(draft.sourceItemId);
    const anchorValid = Boolean(source && draft.sourceQuote.trim() && source.text.includes(draft.sourceQuote.trim()));
    return {
      id: `req-${index + 1}`,
      sourceItemId: source?.id ?? draft.sourceItemId,
      sourceQuote: draft.sourceQuote.trim(),
      requirement: cleanRequirementText(draft.requirement),
      category: draft.category,
      priority: draft.priority,
      keywords: [...new Set(draft.keywords.map((item) => item.trim()).filter(Boolean))],
      interviewFocus: draft.interviewFocus.trim(),
      anchorStatus: anchorValid ? "validated" : "needs-review",
    };
  });
}

export function summarizeRequirementMap(requirements: JobRequirement[]): {
  responsibilities: string[];
  hardRequirements: string[];
  implicitRequirements: string[];
  keywords: string[];
  coreCompetencies: CoreCompetency[];
} {
  const unique = (values: string[], limit: number) => [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);
  const keywords = unique(requirements.flatMap((item) => item.keywords), 30);
  return {
    responsibilities: unique(requirements.filter((item) => item.category === "responsibility").map((item) => item.requirement), 12),
    hardRequirements: unique(requirements.filter((item) => item.priority === "must").map((item) => item.requirement), 12),
    implicitRequirements: unique(requirements.filter((item) => item.priority !== "must").map((item) => item.requirement), 12),
    keywords,
    coreCompetencies: keywords.slice(0, 12).map((name, index) => ({
      name,
      importance: index < 4 ? "high" as const : index < 8 ? "medium" as const : "low" as const,
      description: "由已校验岗位要求中的关键词确定性汇总",
    })),
  };
}

export function validateMatchReferences<T extends {
  requirementId?: string; evidenceClaimIds?: string[]; resumeQuotes?: string[];
  evidenceStrength: "strong" | "medium" | "weak" | "none"; needsSupplement: boolean;
  resumeEvidence: string; matchRationale?: string; missingEvidenceTypes?: string[];
}>(
  items: T[], requirements: JobRequirement[], allowedClaims: CareerAnalysisClaim[], originalResume: string,
): T[] {
  const requirementIds = new Set(requirements.map((item) => item.id));
  const claimIds = new Set(allowedClaims.map((item) => item.id));
  return items
    .filter((item) => Boolean(item.requirementId && requirementIds.has(item.requirementId)))
    .map((item) => {
      const evidenceClaimIds = [...new Set((item.evidenceClaimIds ?? []).filter((id) => claimIds.has(id)))];
      const resumeQuotes = [...new Set((item.resumeQuotes ?? []).map((quote) => quote.trim()).filter((quote) => quote.length >= 2 && originalResume.includes(quote)))];
      const hasVerifiedReference = evidenceClaimIds.length > 0 || resumeQuotes.length > 0;
      return {
        ...item,
        evidenceClaimIds,
        resumeQuotes,
        evidenceStrength: hasVerifiedReference ? item.evidenceStrength : "none" as const,
        needsSupplement: hasVerifiedReference ? item.needsSupplement : true,
        resumeEvidence: hasVerifiedReference ? item.resumeEvidence : "未找到通过服务端校验的事实或原简历引用",
        matchRationale: hasVerifiedReference ? (item.matchRationale ?? "") : `${item.matchRationale ?? ""}${item.matchRationale ? "；" : ""}模型引用未通过校验，已按无证据处理`,
        missingEvidenceTypes: hasVerifiedReference ? (item.missingEvidenceTypes ?? []) : [...new Set([...(item.missingEvidenceTypes ?? []), "可核验事实或原简历引用"])],
      };
    });
}
