import type {
  CareerEvidence,
  EvidenceSourceReference,
  FinalResume,
  ResumeBullet,
  ResumeBulletValue,
  ResumeBulletSource,
  ResumeEvidenceLink,
  ResumeFormattedText,
} from "@/types/resume";
import { normalizeRichText, plainTextToRichText } from "@/lib/resume/rich-text";

function createId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function contentFingerprint(value: string): string {
  let hash = 2166136261;
  for (const character of value.trim().toLocaleLowerCase()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `fp-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function evidenceSourceReference(
  kind: EvidenceSourceReference["kind"],
  referenceId: string,
  content: string,
  runId: string | null = null
): EvidenceSourceReference {
  return { kind, referenceId, runId, fingerprint: contentFingerprint(content) };
}

export function getBulletText(bullet: ResumeBulletValue): string {
  return typeof bullet === "string" ? bullet : bullet.text;
}

function linksFromLegacyIds(ids: string[], status: ResumeEvidenceLink["status"]): ResumeEvidenceLink[] {
  return [...new Set(ids.filter(Boolean))].map((evidenceId) => ({
    evidenceId,
    status,
    method: "suggested",
    sourceReference: null,
  }));
}

export function createResumeBullet(
  text: string,
  sourceType: ResumeBulletSource = "imported",
  evidenceIds: string[] = [],
  evidenceLinks: ResumeEvidenceLink[] = []
): ResumeBullet {
  const links = evidenceLinks.length ? evidenceLinks : linksFromLegacyIds(evidenceIds, "candidate");
  return {
    id: createId("bullet"), text, sourceType,
    evidenceIds: links.map((link) => link.evidenceId), evidenceLinks: links,
    originalText: sourceType === "imported" ? text : "",
    aiText: sourceType === "ai-generated" ? text : "",
    manualText: sourceType === "manual" ? text : "",
    richText: plainTextToRichText(text),
  };
}

export function normalizeResumeBullet(
  bullet: ResumeBulletValue,
  sourceType: ResumeBulletSource = "imported",
  legacyLinkStatus: ResumeEvidenceLink["status"] = "needs-review"
): ResumeBullet {
  if (typeof bullet === "string") return createResumeBullet(bullet, sourceType);
  const legacyIds = Array.isArray(bullet.evidenceIds) ? bullet.evidenceIds : [];
  const existingLinks = Array.isArray(bullet.evidenceLinks) ? bullet.evidenceLinks : [];
  const links = existingLinks.length ? existingLinks : linksFromLegacyIds(legacyIds, legacyLinkStatus);
  return {
    id: bullet.id || createId("bullet"), text: bullet.text ?? "",
    sourceType: bullet.sourceType ?? sourceType,
    evidenceIds: links.map((link) => link.evidenceId), evidenceLinks: links,
    originalText: bullet.originalText ?? "", aiText: bullet.aiText ?? "", manualText: bullet.manualText ?? "",
    richText: normalizeRichText(bullet.richText, bullet.text ?? ""),
  };
}

export function updateResumeBulletText(bullet: ResumeBulletValue, text: string): ResumeBullet {
  const normalized = normalizeResumeBullet(bullet);
  const links = normalized.evidenceLinks.map((link) => ({ ...link, status: "needs-review" as const }));
  return { ...normalized, text, sourceType: "manual", manualText: text, richText: plainTextToRichText(text), evidenceLinks: links, evidenceIds: links.map((link) => link.evidenceId) };
}

export function updateResumeBulletRichText(bullet: ResumeBulletValue, richText: ResumeFormattedText): ResumeBullet {
  const normalized = normalizeResumeBullet(bullet);
  const next = normalizeRichText(richText);
  const links = normalized.evidenceLinks.map((link) => ({ ...link, status: "needs-review" as const }));
  return { ...normalized, text: next.runs.map((run) => run.text).join(""), sourceType: "manual", manualText: next.runs.map((run) => run.text).join(""), richText: next, evidenceLinks: links, evidenceIds: links.map((link) => link.evidenceId) };
}

function tokenize(value: string): string[] {
  const compact = value.toLocaleLowerCase().replace(/[\s\u3000]+/g, " ");
  return [...new Set(compact.split(/[\s,，。;；、/|：:（）()【】\[\]·+]+/).map((item) => item.trim()).filter((item) => item.length >= 2))];
}

function evidenceTerms(evidence: CareerEvidence): string[] {
  return tokenize([evidence.title, evidence.organization, evidence.role, evidence.description, ...evidence.metrics, ...evidence.skills].join(" "));
}

export function suggestEvidenceLinks(text: string, evidence: CareerEvidence[]): ResumeEvidenceLink[] {
  const normalized = text.toLocaleLowerCase();
  return evidence.filter((item) => item.status === "confirmed").map((item) => ({
    evidence: item,
    score: evidenceTerms(item).filter((term) => normalized.includes(term)).length,
  })).filter((item) => item.score >= 2).sort((a, b) => b.score - a.score || b.evidence.updatedAt.localeCompare(a.evidence.updatedAt)).slice(0, 3).map(({ evidence: item }) => ({
    evidenceId: item.id, status: "candidate", method: "suggested", sourceReference: item.sourceReference,
  }));
}

export function normalizeFinalResumeBullets(
  resume: FinalResume,
  sourceType: ResumeBulletSource = "imported",
  evidence: CareerEvidence[] = [],
  legacyLinkStatus: ResumeEvidenceLink["status"] = "needs-review"
): FinalResume {
  const normalize = (bullet: ResumeBulletValue) => {
    const current = normalizeResumeBullet(bullet, sourceType, legacyLinkStatus);
    if (current.evidenceLinks.length || sourceType !== "ai-generated") return current;
    const links = suggestEvidenceLinks(current.text, evidence);
    return { ...current, evidenceLinks: links, evidenceIds: links.map((link) => link.evidenceId) };
  };
  return {
    ...resume,
    workExperience: resume.workExperience.map((item) => ({ ...item, bullets: item.bullets.map(normalize) })),
    projectExperience: resume.projectExperience.map((item) => ({ ...item, bullets: item.bullets.map(normalize) })),
  };
}

export function mapResumeBullets(resume: FinalResume, mapper: (bullet: ResumeBullet) => ResumeBullet): FinalResume {
  const map = (value: ResumeBulletValue) => mapper(normalizeResumeBullet(value));
  return {
    ...resume,
    workExperience: resume.workExperience.map((item) => ({ ...item, bullets: item.bullets.map(map) })),
    projectExperience: resume.projectExperience.map((item) => ({ ...item, bullets: item.bullets.map(map) })),
  };
}

export function buildEvidenceCandidates(resume: FinalResume, sourceDocumentId: string): CareerEvidence[] {
  const now = new Date().toISOString();
  const create = (type: CareerEvidence["type"], title: string, organization: string, role: string, period: string, description: string, skills: string[] = []): CareerEvidence => {
    const referenceId = `${sourceDocumentId}:${contentFingerprint(`${title}|${description}`)}`;
    return {
      id: createId("evidence"), type, title: title || role || "未命名经历", organization, role, period, description,
      metrics: description.match(/\d+(?:\.\d+)?\s*(?:%|％|万|千|百|家|人|次|项|天|月|年|倍)/g) ?? [], skills,
      status: "candidate", sourceType: "resume-import", sourceDocumentId,
      sourceReference: evidenceSourceReference("resume-import", referenceId, description), createdAt: now, updatedAt: now,
    };
  };
  return [
    ...resume.workExperience.flatMap((item) => item.bullets.map(getBulletText).filter(Boolean).map((description) => create("work", item.role, item.company, item.role, item.period, description))),
    ...resume.projectExperience.flatMap((item) => item.bullets.map(getBulletText).filter(Boolean).map((description) => create("project", item.name, "", item.role, item.period, description))),
    ...resume.coreSkills.map((skill) => create("skill", skill, "", "", "", skill, [skill])),
  ];
}

export function selectRelevantEvidence(evidence: CareerEvidence[], targetRole: string, jobDescription: string, sourceDocumentId?: string, limit = 12): CareerEvidence[] {
  const target = `${targetRole}\n${jobDescription}`.toLocaleLowerCase();
  return evidence.filter((item) => item.status === "confirmed").map((item) => ({
    item,
    score: evidenceTerms(item).filter((term) => target.includes(term)).length * 10 + (item.sourceDocumentId === sourceDocumentId ? 1 : 0),
  })).filter(({ score }) => score >= 10).sort((a, b) => b.score - a.score || b.item.updatedAt.localeCompare(a.item.updatedAt)).slice(0, limit).map(({ item }) => item);
}

export function confirmedEvidencePrompt(evidence: CareerEvidence[]): string {
  if (!evidence.length) return "当前没有与此岗位明确相关的已确认经历证据。不得编造量化成果；证据不足时必须提出补证问题。";
  return [
    "以下是与当前岗位相关、且经用户确认的事实证据。AI 改写只能基于这些证据或原始简历中明确存在的事实，不得添加无法核验的数据：",
    ...evidence.map((item) => `[${item.id}] ${item.title}｜${item.organization}｜${item.period}｜${item.description}`),
  ].join("\n");
}
