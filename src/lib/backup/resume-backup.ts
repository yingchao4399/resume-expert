"use client";

import { z } from "zod";
import { migrateJDMap } from "@/lib/jd/consolidation";
import {
  persistedAnalysisResultSchema,
  finalResumeSchema,
  optimizeStyleSchema,
  userInputSchema,
  jobTargetContextSchema,
  interviewAnalysisResultSchema,
  importedResumeProfileSchema,
} from "@/lib/ai/schemas";
import type { CareerEvidence, JobApplication, ResumeDocument, ResumeArchive } from "@/types/resume";
import type { InterviewReviewRecord } from "@/types/interview";
import type { CareerDomainSnapshot } from "@/types/career-domain";
import { careerDomainSnapshotSchema } from "@/lib/career/schemas";
import { readCareerDomain } from "@/lib/career/career-db";
import { mapResumeBullets } from "@/lib/evidence/resume-evidence";
import { sanitizeLayoutConfig } from "@/lib/templates/resume-templates";
import { analysisBasisSchema, jdAnalysisDocumentSchema } from "@/lib/jd/schemas";

const importMetadataSchema = z.object({
  sourceType: z.enum(["text", "pdf", "docx"]),
  fileName: z.string(),
  importedAt: z.string(),
  warnings: z.array(z.string()),
});

const stepIdSchema = z.enum([
  "input",
  "evidence",
  "jd-analysis",
  "diagnosis",
  "match",
  "follow-up",
  "optimize",
  "interview-recording",
  "final-resume",
  "interview",
  "applications",
  "export",
]);

const layoutConfigSchema = z.object({
  templateId: z.enum(["ats-classic", "modern-clean", "compact-professional"]),
  fontFamily: z.enum(["microsoft-yahei", "songti", "arial", "calibri"]),
  baseFontSize: z.number(),
  lineHeight: z.number(),
  sectionSpacing: z.number(),
  pageMargin: z.number(),
  accentColor: z.string(),
  bulletStyle: z.enum(["disc", "dash", "square"]),
  sectionOrder: z.array(z.enum(["jobIntent", "summary", "coreSkills", "workExperience", "projectExperience", "skillsAndTools", "education", "certifications", "languages", "awards", "links", "otherSections"])),
  hiddenSections: z.array(z.enum(["jobIntent", "summary", "coreSkills", "workExperience", "projectExperience", "skillsAndTools", "education", "certifications", "languages", "awards", "links", "otherSections"])),
});

export const resumeArchiveSchema = z.object({
  id: z.string().min(1), title: z.string().trim().min(1).max(120), notes: z.string().max(1000),
  archivedAt: z.string().datetime(), sourceDocumentId: z.string().nullable(),
  sourceFingerprint: z.string(), contentFingerprint: z.string(),
  targetRole: z.string(), companyName: z.string(), finalResume: finalResumeSchema, layoutConfig: layoutConfigSchema,
});

const documentSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7), z.literal(8), z.literal(9), z.literal(10), z.literal(11), z.literal(12)]),
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  userInput: userInputSchema,
  jobTargetContext: jobTargetContextSchema.optional(),
  currentStep: stepIdSchema,
  analysisResult: persistedAnalysisResultSchema.nullable(),
  materialRevision: z.number().int().nonnegative().optional(),
  analysisRevision: z.number().int().nonnegative().nullable().optional(),
  jdAnalysisDocument: jdAnalysisDocumentSchema.nullable().optional(),
  analysisBasis: analysisBasisSchema.nullable().optional(),
  sourceResume: finalResumeSchema.nullable().optional(),
  importedResume: importedResumeProfileSchema.nullable().optional(),
  importMetadata: importMetadataSchema.nullable().optional(),
  layoutConfig: layoutConfigSchema.optional(),
  optimizeStyle: optimizeStyleSchema,
  customOptimizeInstruction: z.string().max(300).optional(),
  finalResumeStatus: z.enum(["draft", "confirmed", "stale"]).optional(),
  isFinalResumeStale: z.boolean().optional(),
  hasManualEdits: z.boolean(),
});

const careerEvidenceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["work", "project", "achievement", "skill"]),
  title: z.string(),
  organization: z.string(),
  role: z.string(),
  period: z.string(),
  description: z.string(),
  metrics: z.array(z.string()),
  skills: z.array(z.string()),
  status: z.enum(["candidate", "confirmed"]),
  sourceType: z.enum(["resume-import", "manual", "follow-up", "flowise"]),
  sourceDocumentId: z.string().nullable(),
  sourceReference: z.object({
    kind: z.enum(["resume-import", "manual", "follow-up", "flowise"]),
    referenceId: z.string(), runId: z.string().nullable(), fingerprint: z.string(),
  }).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const jobApplicationSchema = z.object({
  id: z.string().min(1), company: z.string(), role: z.string(), jdUrl: z.string(), jdText: z.string(),
  status: z.enum(["准备中", "已投递", "笔试", "面试", "Offer", "结束"]),
  appliedAt: z.string(), nextStepAt: z.string(), notes: z.string(), resumeDocumentId: z.string().nullable(),
  createdAt: z.string(), updatedAt: z.string(),
});

const interviewReviewSchema = z.object({
  id: z.string().min(1), applicationId: z.string().nullable(), resumeDocumentId: z.string().nullable(),
  transcriptText: z.string(), result: interviewAnalysisResultSchema,
  recording: z.object({ id: z.string(), fileName: z.string(), fileSize: z.number(), durationSec: z.number().optional(), uploadedAt: z.string() }).nullable(),
  createdAt: z.string(), updatedAt: z.string(),
});

const backupSchema = z.object({
  backupVersion: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7), z.literal(8), z.literal(9), z.literal(10)]),
  exportedAt: z.string(),
  documents: z.array(documentSchema).min(1),
  archives: z.array(resumeArchiveSchema).optional().default([]),
  careerEvidence: z.array(careerEvidenceSchema).optional().default([]),
  jobApplications: z.array(jobApplicationSchema).optional().default([]),
  interviewReviews: z.array(interviewReviewSchema).optional().default([]),
  careerDomain: careerDomainSnapshotSchema.optional(),
});

export interface ResumeBackup {
  backupVersion: 10;
  exportedAt: string;
  documents: ResumeDocument[];
  archives: ResumeArchive[];
  careerEvidence: CareerEvidence[];
  jobApplications: JobApplication[];
  interviewReviews: InterviewReviewRecord[];
  careerDomain: CareerDomainSnapshot;
}

export function createResumeBackup(documents: ResumeDocument[], careerEvidence: CareerEvidence[] = [], jobApplications: JobApplication[] = [], interviewReviews: InterviewReviewRecord[] = [], archives: ResumeArchive[] = []): ResumeBackup {
  return {
    backupVersion: 10,
    exportedAt: new Date().toISOString(),
    documents: structuredClone(documents),
    archives: structuredClone(archives),
    careerEvidence: structuredClone(careerEvidence),
    jobApplications: structuredClone(jobApplications),
    interviewReviews: structuredClone(interviewReviews),
    careerDomain: { schemaVersion: 1, experiences: [], claims: [], metrics: [], capabilities: [], capabilityLinks: [], interviewSessions: [], quarantined: [] },
  };
}

export function parseResumeBackup(value: unknown): ResumeBackup {
  const parsed = backupSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") || "root";
    throw new Error(`备份文件结构无效（${path}）：${issue?.message ?? "未知错误"}`);
  }
  return {
    backupVersion: 10,
    exportedAt: parsed.data.exportedAt,
    archives: parsed.data.archives,
    documents: parsed.data.documents.map((document) => {
      const hasCurrentRequirementMap = document.schemaVersion >= 9 && Boolean(document.jdAnalysisDocument);
      const finalResumeStatus = document.analysisResult && !hasCurrentRequirementMap ? "stale" : document.finalResumeStatus ??
        (document.isFinalResumeStale
          ? "stale"
          : document.analysisResult?.finalResume
            ? "confirmed"
            : "draft");
      const { isFinalResumeStale: _legacyStatus, ...currentDocument } = document;
      void _legacyStatus;
      return {
        ...currentDocument,
        schemaVersion: 12,
        jobTargetContext: document.jobTargetContext ?? { companyName: "", notes: "", companySnapshotId: null },
        materialRevision: document.materialRevision ?? 0,
        analysisRevision: hasCurrentRequirementMap && document.analysisResult ? document.analysisRevision ?? null : null,
        jdAnalysisDocument: hasCurrentRequirementMap && document.jdAnalysisDocument ? migrateJDMap(document.jdAnalysisDocument) : null,
        analysisBasis: hasCurrentRequirementMap ? document.analysisBasis ?? null : null,
        sourceResume: document.sourceResume ?? null,
        importedResume: document.importedResume ?? null,
        importMetadata: document.importMetadata ?? null,
        layoutConfig: sanitizeLayoutConfig(document.layoutConfig),
        finalResumeStatus,
        customOptimizeInstruction: document.customOptimizeInstruction ?? "",
      };
    }),
    careerEvidence: parsed.data.careerEvidence.map((item) => ({ ...item, sourceReference: item.sourceReference ?? null })),
    jobApplications: parsed.data.jobApplications,
    interviewReviews: parsed.data.interviewReviews,
    careerDomain: parsed.data.careerDomain ?? { schemaVersion: 1, experiences: [], claims: [], metrics: [], capabilities: [], capabilityLinks: [], interviewSessions: [], quarantined: [] },
  };
}

export async function readResumeBackup(file: File): Promise<ResumeBackup> {
  if (file.size > 10 * 1024 * 1024) throw new Error("备份文件不能超过 10 MB。");
  try {
    return parseResumeBackup(JSON.parse(await file.text()));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("备份文件不是合法 JSON。");
    throw error;
  }
}

export function downloadResumeBackup(
  documents: ResumeDocument[],
  careerEvidence: CareerEvidence[] = [],
  jobApplications: JobApplication[] = [],
  interviewReviews: InterviewReviewRecord[] = [],
  fileName = "resume-expert-backup.json"
): void {
  const blob = new Blob([JSON.stringify(createResumeBackup(documents, careerEvidence, jobApplications, interviewReviews), null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function createResumeBackupV4(
  documents: ResumeDocument[], careerEvidence: CareerEvidence[] = [], jobApplications: JobApplication[] = [],
  interviewReviews: InterviewReviewRecord[] = [], scope: "all" | "current" = "all", archives: ResumeArchive[] = []
): Promise<ResumeBackup> {
  const domain = await readCareerDomain();
  const careerDomain = scope === "current" ? selectCareerClosure(documents, domain) : domain;
  const selectedArchives = scope === "current" ? archives.filter(item => documents.some(document => document.id === item.sourceDocumentId)) : archives;
  return { ...createResumeBackup(documents, careerEvidence, jobApplications, interviewReviews, selectedArchives), careerDomain };
}

export const createResumeBackupV5 = createResumeBackupV4;
export const createResumeBackupV6 = createResumeBackupV4;
export const createResumeBackupV7 = createResumeBackupV4;
export const createResumeBackupV8 = createResumeBackupV4;
export const createResumeBackupV10 = createResumeBackupV4;

export async function downloadResumeBackupV4(
  documents: ResumeDocument[], careerEvidence: CareerEvidence[] = [], jobApplications: JobApplication[] = [],
  interviewReviews: InterviewReviewRecord[] = [], fileName = "resume-expert-backup.json", scope: "all" | "current" = "all", archives: ResumeArchive[] = []
): Promise<void> {
  const backup = await createResumeBackupV4(documents, careerEvidence, jobApplications, interviewReviews, scope, archives);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadResumeBackupV5 = downloadResumeBackupV4;
export const downloadResumeBackupV6 = downloadResumeBackupV4;
export const downloadResumeBackupV7 = downloadResumeBackupV4;
export const downloadResumeBackupV8 = downloadResumeBackupV4;
export const downloadResumeBackupV10 = downloadResumeBackupV4;

function selectCareerClosure(documents: ResumeDocument[], domain: CareerDomainSnapshot): CareerDomainSnapshot {
  const referencedClaims = new Set<string>();
  for (const document of documents) {
    for (const match of document.analysisResult?.matchItems ?? []) for (const claimId of match.evidenceClaimIds ?? []) referencedClaims.add(claimId);
    const resume = document.analysisResult?.finalResume;
    if (!resume) continue;
    for (const section of [...resume.workExperience, ...resume.projectExperience]) for (const bullet of section.bullets) {
      if (typeof bullet !== "string") for (const link of bullet.evidenceLinks) referencedClaims.add(link.evidenceId);
    }
  }
  for (const claim of domain.claims) if (claim.sourceReference?.referenceId.includes(documents[0]?.id ?? "__none__")) referencedClaims.add(claim.id);
  const claims = domain.claims.filter((item) => referencedClaims.has(item.id));
  const experienceIds = new Set(claims.map((item) => item.experienceId));
  const capabilityLinks = domain.capabilityLinks.filter((item) => referencedClaims.has(item.claimId));
  const capabilityIds = new Set(capabilityLinks.map((item) => item.capabilityId));
  return {
    schemaVersion: 1, experiences: domain.experiences.filter((item) => experienceIds.has(item.id)), claims,
    metrics: domain.metrics.filter((item) => referencedClaims.has(item.claimId)), capabilities: domain.capabilities.filter((item) => capabilityIds.has(item.id)),
    capabilityLinks, interviewSessions: domain.interviewSessions.filter((item) => !item.experienceId || experienceIds.has(item.experienceId)), quarantined: [],
  };
}

export function remapCareerDomainForMerge(domain: CareerDomainSnapshot): { domain: CareerDomainSnapshot; claimIdMap: Map<string, string> } {
  const map = (prefix: string, values: Array<{ id: string }>) => new Map(values.map((item) => [item.id, `${prefix}-${crypto.randomUUID()}`]));
  const experienceIds = map("experience", domain.experiences); const claimIds = map("claim", domain.claims);
  const capabilityIds = map("capability", domain.capabilities); const sessionIds = map("interview", domain.interviewSessions);
  return { claimIdMap: claimIds, domain: {
    schemaVersion: 1,
    experiences: domain.experiences.map((item) => ({ ...item, id: experienceIds.get(item.id)! })),
    claims: domain.claims.map((item) => ({ ...item, id: claimIds.get(item.id)!, experienceId: experienceIds.get(item.experienceId) ?? item.experienceId })),
    metrics: domain.metrics.map((item) => ({ ...item, id: `metric-${crypto.randomUUID()}`, claimId: claimIds.get(item.claimId) ?? item.claimId })),
    capabilities: domain.capabilities.map((item) => ({ ...item, id: capabilityIds.get(item.id)! })),
    capabilityLinks: domain.capabilityLinks.map((item) => ({ ...item, id: `capability-link-${crypto.randomUUID()}`, capabilityId: capabilityIds.get(item.capabilityId) ?? item.capabilityId, claimId: claimIds.get(item.claimId) ?? item.claimId })),
    interviewSessions: domain.interviewSessions.map((item) => ({ ...item, id: sessionIds.get(item.id)!, experienceId: item.experienceId ? experienceIds.get(item.experienceId) ?? item.experienceId : null })),
    quarantined: domain.quarantined,
  } };
}

export function remapDocumentsClaimIds(documents: ResumeDocument[], claimIdMap: Map<string, string>): ResumeDocument[] {
  return documents.map((document) => document.analysisResult ? {
    ...document, analysisResult: { ...document.analysisResult,
      matchItems: (document.analysisResult.matchItems ?? []).map((item) => ({ ...item, evidenceClaimIds: (item.evidenceClaimIds ?? []).map((id) => claimIdMap.get(id) ?? id) })),
      finalResume: mapResumeBullets(document.analysisResult.finalResume, (bullet) => {
      const evidenceLinks = bullet.evidenceLinks.map((link) => ({ ...link, evidenceId: claimIdMap.get(link.evidenceId) ?? link.evidenceId }));
      return { ...bullet, evidenceLinks, evidenceIds: evidenceLinks.map((link) => link.evidenceId) };
    }) },
  } : document);
}
