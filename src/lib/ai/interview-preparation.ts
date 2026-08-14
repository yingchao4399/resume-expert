import { randomUUID } from "node:crypto";
import type { AIMode } from "@/lib/ai/types";
import type { PromptRuntimeSnapshot } from "@/lib/studio/prompt-types";
import type { InterviewPrep } from "@/types/resume";

export const INTERVIEW_PREPARATION_TIMEOUT_MS = 180_000;

interface BaseEvent {
  requestId: string;
  elapsedMs: number;
  remainingMs: number;
}

export type InterviewPreparationProgressEvent =
  | (BaseEvent & { type: "started" | "heartbeat"; message: string })
  | (BaseEvent & { type: "batch-progress"; batchIndex: number; batchCount: number; batchStatus: "started" | "completed" | "split"; message: string })
  | (BaseEvent & { type: "completed"; interviewPrep: InterviewPrep; mode: AIMode; promptSnapshots?: PromptRuntimeSnapshot[] })
  | (BaseEvent & { type: "failed"; error: string; category?: string; promptSnapshots?: PromptRuntimeSnapshot[] })
  | (BaseEvent & { type: "cancelled"; message: string; promptSnapshots?: PromptRuntimeSnapshot[] });

type InterviewPreparationProgressPayload<T = InterviewPreparationProgressEvent> = T extends BaseEvent ? Omit<T, keyof BaseEvent> : never;

export function createInterviewProgressClock(startedAt = Date.now(), requestId: string = randomUUID()) {
  const deadlineAt = startedAt + INTERVIEW_PREPARATION_TIMEOUT_MS;
  return {
    requestId,
    event(payload: InterviewPreparationProgressPayload): InterviewPreparationProgressEvent {
      const now = Date.now();
      return { ...payload, requestId, elapsedMs: Math.max(0, now - startedAt), remainingMs: Math.max(0, deadlineAt - now) } as InterviewPreparationProgressEvent;
    },
  };
}
