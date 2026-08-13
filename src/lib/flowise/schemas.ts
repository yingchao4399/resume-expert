import { z } from "zod";

export const projectEvidenceInputSchema = z.object({
  targetRole: z.string().trim().min(1).max(120),
  projectTitle: z.string().trim().min(1).max(160),
  currentDemo: z.string().trim().min(10).max(20_000),
});

export const projectEvidenceDraftSchema = z.object({
  targetRole: z.string().trim().min(1),
  projectTitle: z.string().trim().min(1),
  maturity: z.enum(["idea", "demo", "validated"]),
  factDrafts: z.array(z.string().trim().min(1)).min(1).max(12),
  missingEvidence: z.array(z.string().trim().min(1)).max(12),
  improvementTasks: z.array(z.string().trim().min(1)).max(12),
  interviewNarrative: z.string().trim().min(1),
  questions: z.array(z.string().trim().min(1)).max(10),
});

export const projectEvidenceRequestSchema = z.object({
  provider: z.enum(["mock", "direct", "flowise"]),
  input: projectEvidenceInputSchema,
  allowFallback: z.boolean().default(true),
});

export type ProjectEvidenceInput = z.infer<typeof projectEvidenceInputSchema>;
export type ProjectEvidenceDraft = z.infer<typeof projectEvidenceDraftSchema>;
export type ProjectEvidenceProvider = z.infer<typeof projectEvidenceRequestSchema>["provider"];

export interface ProjectEvidenceResult {
  runId: string;
  draft: ProjectEvidenceDraft;
  requestedProvider: ProjectEvidenceProvider;
  actualProvider: ProjectEvidenceProvider;
  fallbackUsed: boolean;
  warning?: string;
}
