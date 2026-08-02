import type {
  CareerEvidence,
  FinalResume,
  ResumeBullet,
  ResumeBulletValue,
  ResumeBulletSource,
} from "@/types/resume";

function createId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getBulletText(bullet: ResumeBulletValue): string {
  return typeof bullet === "string" ? bullet : bullet.text;
}

export function createResumeBullet(
  text: string,
  sourceType: ResumeBulletSource = "imported",
  evidenceIds: string[] = []
): ResumeBullet {
  return {
    id: createId("bullet"),
    text,
    sourceType,
    evidenceIds: [...new Set(evidenceIds)],
    originalText: sourceType === "imported" ? text : "",
    aiText: sourceType === "ai-generated" ? text : "",
    manualText: sourceType === "manual" ? text : "",
  };
}

export function normalizeResumeBullet(
  bullet: ResumeBulletValue,
  sourceType: ResumeBulletSource = "imported"
): ResumeBullet {
  if (typeof bullet === "string") return createResumeBullet(bullet, sourceType);
  return {
    id: bullet.id || createId("bullet"),
    text: bullet.text ?? "",
    sourceType: bullet.sourceType ?? sourceType,
    evidenceIds: Array.isArray(bullet.evidenceIds)
      ? [...new Set(bullet.evidenceIds.filter(Boolean))]
      : [],
    originalText: bullet.originalText ?? "",
    aiText: bullet.aiText ?? "",
    manualText: bullet.manualText ?? "",
  };
}

export function updateResumeBulletText(
  bullet: ResumeBulletValue,
  text: string
): ResumeBullet {
  const normalized = normalizeResumeBullet(bullet);
  return {
    ...normalized,
    text,
    sourceType: "manual",
    manualText: text,
  };
}

function evidenceTerms(evidence: CareerEvidence): string[] {
  return [
    evidence.title,
    evidence.organization,
    evidence.role,
    evidence.description,
    ...evidence.metrics,
    ...evidence.skills,
  ]
    .flatMap((value) => value.toLocaleLowerCase().split(/[\s,，。;；、/|：:（）()]+/))
    .filter((value) => value.length >= 2);
}

function findRelatedEvidenceIds(text: string, evidence: CareerEvidence[]): string[] {
  const normalized = text.toLocaleLowerCase();
  return evidence
    .filter((item) => item.status === "confirmed")
    .map((item) => ({
      id: item.id,
      score: evidenceTerms(item).filter((term) => normalized.includes(term)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.id);
}

export function normalizeFinalResumeBullets(
  resume: FinalResume,
  sourceType: ResumeBulletSource = "imported",
  evidence: CareerEvidence[] = []
): FinalResume {
  const normalize = (bullet: ResumeBulletValue) => {
    const current = normalizeResumeBullet(bullet, sourceType);
    if (current.evidenceIds.length || sourceType !== "ai-generated") return current;
    return {
      ...current,
      evidenceIds: findRelatedEvidenceIds(current.text, evidence),
    };
  };
  return {
    ...resume,
    workExperience: resume.workExperience.map((item) => ({
      ...item,
      bullets: item.bullets.map(normalize),
    })),
    projectExperience: resume.projectExperience.map((item) => ({
      ...item,
      bullets: item.bullets.map(normalize),
    })),
  };
}

export function buildEvidenceCandidates(
  resume: FinalResume,
  sourceDocumentId: string
): CareerEvidence[] {
  const now = new Date().toISOString();
  const create = (
    type: CareerEvidence["type"],
    title: string,
    organization: string,
    role: string,
    period: string,
    description: string,
    skills: string[] = []
  ): CareerEvidence => ({
    id: createId("evidence"),
    type,
    title: title || role || "未命名经历",
    organization,
    role,
    period,
    description,
    metrics: description.match(/\d+(?:\.\d+)?\s*(?:%|％|万|千|百|家|人|次|项|天|月|年|倍)/g) ?? [],
    skills,
    status: "candidate",
    sourceType: "resume-import",
    sourceDocumentId,
    createdAt: now,
    updatedAt: now,
  });

  return [
    ...resume.workExperience.flatMap((item) =>
      item.bullets
        .map(getBulletText)
        .filter(Boolean)
        .map((description) =>
          create("work", item.role, item.company, item.role, item.period, description)
        )
    ),
    ...resume.projectExperience.flatMap((item) =>
      item.bullets
        .map(getBulletText)
        .filter(Boolean)
        .map((description) =>
          create("project", item.name, "", item.role, item.period, description)
        )
    ),
    ...resume.coreSkills.map((skill) =>
      create("skill", skill, "", "", "", skill, [skill])
    ),
  ];
}

export function confirmedEvidencePrompt(evidence: CareerEvidence[]): string {
  const confirmed = evidence.filter((item) => item.status === "confirmed");
  if (!confirmed.length) {
    return "当前没有已确认的经历证据。不得编造量化成果；证据不足时必须提出补证问题。";
  }
  return [
    "以下是用户已确认的事实证据。AI 改写只能基于这些证据或原始简历中明确存在的事实，不得添加无法核验的数据：",
    ...confirmed.map(
      (item) =>
        `[${item.id}] ${item.title}｜${item.organization}｜${item.period}｜${item.description}`
    ),
  ].join("\n");
}
