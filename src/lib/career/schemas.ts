import { z } from "zod";

const status = z.enum(["candidate", "confirmed", "needs-review", "superseded"]);
const timestamps = { createdAt: z.string(), updatedAt: z.string() };
const sourceReference = z.object({
  kind: z.enum(["resume-import", "manual", "follow-up", "flowise"]),
  referenceId: z.string(), runId: z.string().nullable(), fingerprint: z.string(),
}).nullable();

export const careerExperienceSchema = z.object({
  id: z.string().min(1), type: z.enum(["work", "project", "internship", "inbox"]),
  title: z.string(), organization: z.string(), role: z.string(), startDate: z.string(), endDate: z.string(),
  periodText: z.string(), summary: z.string(), order: z.number().int().nonnegative(), status, ...timestamps,
});

export const evidenceClaimSchema = z.object({
  id: z.string().min(1), experienceId: z.string().min(1),
  kind: z.enum(["responsibility", "action", "decision", "result", "skill-practice"]),
  text: z.string().min(1), contribution: z.enum(["assisted", "independent", "led"]),
  complexity: z.enum(["routine", "complex"]), hasTradeoff: z.boolean(), hasMethodReuse: z.boolean(), status,
  sourceReference, sourceQuote: z.string(), sourceRunId: z.string().nullable(), sourceRound: z.number().int().min(1).max(5).nullable(), ...timestamps,
});

export const metricEvidenceSchema = z.object({
  id: z.string().min(1), claimId: z.string().min(1), value: z.string().min(1), unit: z.string(), baseline: z.string(),
  method: z.string(), period: z.string(), sourceNote: z.string(), status, ...timestamps,
});

export const capabilitySchema = z.object({
  id: z.string().min(1), name: z.string().min(1), category: z.enum(["product", "technology", "data", "industry", "collaboration", "custom"]),
  aliases: z.array(z.string()), selfLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), ...timestamps,
});

export const capabilityLinkSchema = z.object({
  id: z.string().min(1), capabilityId: z.string().min(1), claimId: z.string().min(1),
  status: z.enum(["candidate", "confirmed", "needs-review"]), source: z.enum(["suggested", "manual"]), ...timestamps,
});

const question = z.object({ id: z.string().min(1), question: z.string().min(1), purpose: z.string() });
const claimDraft = z.object({
  id: z.string().min(1), kind: z.enum(["responsibility", "action", "decision", "result", "skill-practice"]), text: z.string().min(1),
  contribution: z.enum(["assisted", "independent", "led"]), complexity: z.enum(["routine", "complex"]),
  hasTradeoff: z.boolean(), hasMethodReuse: z.boolean(), sourceQuote: z.string(), sourceRound: z.number().int().min(1).max(5),
  status: z.enum(["candidate", "needs-review"]),
});

const modelClaimDraft = claimDraft.omit({ sourceRound: true });

export const careerInterviewModelOutputSchema = z.object({
  claimDrafts: z.array(modelClaimDraft).max(12),
  metricDrafts: z.array(z.object({ claimDraftId: z.string(), value: z.string(), unit: z.string(), baseline: z.string(), method: z.string(), period: z.string(), sourceNote: z.string() })).max(12),
  capabilitySuggestions: z.array(z.object({ name: z.string().min(1), category: z.enum(["product", "technology", "data", "industry", "collaboration", "custom"]), claimDraftIds: z.array(z.string()) })).max(12),
  nextQuestions: z.array(question).max(3),
  shouldFinish: z.boolean(),
  reviewWarnings: z.array(z.string()).max(12),
});

export const careerInterviewTurnSchema = z.object({
  runId: z.string().min(1), round: z.number().int().min(1).max(5),
  coverage: z.object({ responsibility: z.boolean(), action: z.boolean(), result: z.boolean(), metric: z.boolean(), decision: z.boolean() }),
  claimDrafts: z.array(claimDraft).max(12),
  metricDrafts: z.array(z.object({ claimDraftId: z.string(), value: z.string(), unit: z.string(), baseline: z.string(), method: z.string(), period: z.string(), sourceNote: z.string() })).max(12),
  capabilitySuggestions: z.array(z.object({ name: z.string().min(1), category: z.enum(["product", "technology", "data", "industry", "collaboration", "custom"]), claimDraftIds: z.array(z.string()) })).max(12),
  nextQuestions: z.array(question).max(3), shouldFinish: z.boolean(),
  finishReason: z.enum(["sufficient", "user-ended", "max-rounds", "continue"]), reviewWarnings: z.array(z.string()).max(12),
}).superRefine((value, context) => {
  if (value.round === 5 && (!value.shouldFinish || value.finishReason !== "max-rounds")) context.addIssue({ code: "custom", path: ["finishReason"], message: "第 5 轮必须收束" });
  if (value.shouldFinish && value.nextQuestions.length) context.addIssue({ code: "custom", path: ["nextQuestions"], message: "已结束时不能继续提问" });
});

export const careerInterviewSessionSchema = z.object({
  id: z.string().min(1), experienceId: z.string().nullable(), targetRole: z.string(), experienceTitle: z.string(), background: z.string(),
  round: z.number().int().min(0).max(5), status: z.enum(["active", "review", "completed"]),
  answers: z.array(z.object({ questionId: z.string(), question: z.string(), answer: z.string(), round: z.number().int().min(1).max(5) })),
  latestTurn: careerInterviewTurnSchema.nullable(), ...timestamps,
});

export const careerDomainSnapshotSchema = z.object({
  schemaVersion: z.literal(1), experiences: z.array(careerExperienceSchema), claims: z.array(evidenceClaimSchema),
  metrics: z.array(metricEvidenceSchema), capabilities: z.array(capabilitySchema), capabilityLinks: z.array(capabilityLinkSchema),
  interviewSessions: z.array(careerInterviewSessionSchema), quarantined: z.array(z.object({ store: z.string(), value: z.unknown(), reason: z.string() })),
});

export const careerInterviewRequestSchema = z.object({
  sessionId: z.string().min(1), targetRole: z.string().trim().min(1).max(120), experienceTitle: z.string().trim().min(1).max(160),
  background: z.string().trim().min(10).max(20_000), round: z.number().int().min(1).max(5),
  answers: z.array(z.object({ questionId: z.string(), question: z.string(), answer: z.string().max(5_000), round: z.number().int().min(1).max(5) })).max(15),
  endRequested: z.boolean().default(false),
});
