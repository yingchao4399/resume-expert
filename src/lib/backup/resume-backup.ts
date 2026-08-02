"use client";

import { z } from "zod";
import {
  analysisResultSchema,
  finalResumeSchema,
  optimizeStyleSchema,
  userInputSchema,
} from "@/lib/ai/schemas";
import type { ResumeDocument } from "@/types/resume";

const importMetadataSchema = z.object({
  sourceType: z.enum(["text", "pdf", "docx"]),
  fileName: z.string(),
  importedAt: z.string(),
  warnings: z.array(z.string()),
});

const stepIdSchema = z.enum([
  "input",
  "jd-analysis",
  "diagnosis",
  "match",
  "follow-up",
  "optimize",
  "interview-recording",
  "final-resume",
  "interview",
  "export",
]);

const documentSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  userInput: userInputSchema,
  currentStep: stepIdSchema,
  analysisResult: analysisResultSchema.nullable(),
  sourceResume: finalResumeSchema.nullable().optional(),
  importMetadata: importMetadataSchema.nullable().optional(),
  optimizeStyle: optimizeStyleSchema,
  isFinalResumeStale: z.boolean(),
  hasManualEdits: z.boolean(),
});

const backupSchema = z.object({
  backupVersion: z.literal(1),
  exportedAt: z.string(),
  documents: z.array(documentSchema).min(1),
});

export interface ResumeBackup {
  backupVersion: 1;
  exportedAt: string;
  documents: ResumeDocument[];
}

export function createResumeBackup(documents: ResumeDocument[]): ResumeBackup {
  return {
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    documents: structuredClone(documents),
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
    backupVersion: 1,
    exportedAt: parsed.data.exportedAt,
    documents: parsed.data.documents.map((document) => ({
      ...document,
      schemaVersion: 2,
      sourceResume: document.sourceResume ?? null,
      importMetadata: document.importMetadata ?? null,
    })),
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
  fileName = "resume-expert-backup.json"
): void {
  const blob = new Blob([JSON.stringify(createResumeBackup(documents), null, 2)], {
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
