"use client";

import { z } from "zod";
import {
  analysisResultSchema,
  finalResumeSchema,
  optimizeStyleSchema,
  userInputSchema,
  interviewAnalysisResultSchema,
} from "@/lib/ai/schemas";
import type { CareerEvidence, JobApplication, ResumeDocument } from "@/types/resume";
import type { InterviewReviewRecord } from "@/types/interview";
import { sanitizeLayoutConfig } from "@/lib/templates/resume-templates";

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
  sectionOrder: z.array(z.enum(["jobIntent", "summary", "coreSkills", "workExperience", "projectExperience", "skillsAndTools", "education"])),
  hiddenSections: z.array(z.enum(["jobIntent", "summary", "coreSkills", "workExperience", "projectExperience", "skillsAndTools", "education"])),
});

const documentSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  userInput: userInputSchema,
  currentStep: stepIdSchema,
  analysisResult: analysisResultSchema.nullable(),
  sourceResume: finalResumeSchema.nullable().optional(),
  importMetadata: importMetadataSchema.nullable().optional(),
  layoutConfig: layoutConfigSchema.optional(),
  optimizeStyle: optimizeStyleSchema,
  isFinalResumeStale: z.boolean(),
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
  sourceType: z.enum(["resume-import", "manual", "follow-up"]),
  sourceDocumentId: z.string().nullable(),
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
  backupVersion: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string(),
  documents: z.array(documentSchema).min(1),
  careerEvidence: z.array(careerEvidenceSchema).optional().default([]),
  jobApplications: z.array(jobApplicationSchema).optional().default([]),
  interviewReviews: z.array(interviewReviewSchema).optional().default([]),
});

export interface ResumeBackup {
  backupVersion: 2;
  exportedAt: string;
  documents: ResumeDocument[];
  careerEvidence: CareerEvidence[];
  jobApplications: JobApplication[];
  interviewReviews: InterviewReviewRecord[];
}

export function createResumeBackup(documents: ResumeDocument[], careerEvidence: CareerEvidence[] = [], jobApplications: JobApplication[] = [], interviewReviews: InterviewReviewRecord[] = []): ResumeBackup {
  return {
    backupVersion: 2,
    exportedAt: new Date().toISOString(),
    documents: structuredClone(documents),
    careerEvidence: structuredClone(careerEvidence),
    jobApplications: structuredClone(jobApplications),
    interviewReviews: structuredClone(interviewReviews),
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
    backupVersion: 2,
    exportedAt: parsed.data.exportedAt,
    documents: parsed.data.documents.map((document) => ({
      ...document,
      schemaVersion: 4,
      sourceResume: document.sourceResume ?? null,
      importMetadata: document.importMetadata ?? null,
      layoutConfig: sanitizeLayoutConfig(document.layoutConfig),
    })),
    careerEvidence: parsed.data.careerEvidence,
    jobApplications: parsed.data.jobApplications,
    interviewReviews: parsed.data.interviewReviews,
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
