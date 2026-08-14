import { getAIConfig } from "@/lib/ai/config";
import { chatCompletionJSON } from "@/lib/ai/client";
import { careerInterviewModelOutputSchema, careerInterviewTurnSchema } from "@/lib/career/schemas";
import type { CareerInterviewAnswer, CareerInterviewModelOutput, CareerInterviewTurn } from "@/types/career-domain";
import type { WorkflowExecutionOptions } from "@/lib/studio/execution";

export interface CareerInterviewInput {
  sessionId: string; targetRole: string; experienceTitle: string; background: string;
  round: number; answers: CareerInterviewAnswer[]; endRequested: boolean;
}

export async function runCareerInterview(
  input: CareerInterviewInput,
  execution: Pick<WorkflowExecutionOptions, "model" | "timeoutMs" | "capture"> = {},
): Promise<{ turn: CareerInterviewTurn; mode: "mock" | "llm" }> {
  if (getAIConfig().mode === "mock") return { turn: buildMockInterviewTurn(input), mode: "mock" };
  const output = await chatCompletionJSON({
    promptId: "career.interview",
    schema: careerInterviewModelOutputSchema, schemaName: "career_interview_model_output", strictOutput: true, temperature: 0.2,
    system: [
      "你是项目经历结构化访谈助手。只允许整理用户原文和回答中的事实，不得新增人名、公司、日期、技术、数字或结果。",
      "每条 claimDraft.sourceQuote 必须逐字存在于 background 或 answers.answer；找不到逐字引用时 status 必须为 needs-review。",
      "每轮只提出 1-3 个信息增益最高的问题。你只负责语义内容，不要输出 runId、round、coverage 或 finishReason，这些由服务端生成。",
    ].join("\n"),
    user: JSON.stringify(input),
    ...execution,
  });
  return { turn: assembleCareerInterviewTurn(output, input), mode: "llm" };
}

export function assembleCareerInterviewTurn(output: CareerInterviewModelOutput, input: CareerInterviewInput): CareerInterviewTurn {
  const source = [input.background, ...input.answers.map((item) => item.answer)].join("\n");
  const maxed = input.round >= 5;
  const ended = input.endRequested || maxed;
  const claims = output.claimDrafts.map((claim) => ({
    ...claim, sourceRound: input.round,
    status: claim.sourceQuote && source.includes(claim.sourceQuote) ? claim.status : "needs-review" as const,
  }));
  return careerInterviewTurnSchema.parse({
    runId: `career-${crypto.randomUUID()}`, round: input.round,
    coverage: {
      responsibility: claims.some((claim) => claim.kind === "responsibility"),
      action: claims.some((claim) => claim.kind === "action" || claim.kind === "skill-practice"),
      result: claims.some((claim) => claim.kind === "result"), metric: output.metricDrafts.length > 0,
      decision: claims.some((claim) => claim.kind === "decision"),
    },
    claimDrafts: claims, metricDrafts: output.metricDrafts, capabilitySuggestions: output.capabilitySuggestions,
    nextQuestions: ended || output.shouldFinish ? [] : output.nextQuestions.slice(0, 3),
    shouldFinish: ended || output.shouldFinish,
    finishReason: maxed ? "max-rounds" : input.endRequested ? "user-ended" : output.shouldFinish ? "sufficient" : "continue",
    reviewWarnings: output.reviewWarnings,
  });
}

export function enforceSourceGrounding(turn: CareerInterviewTurn, input: CareerInterviewInput): CareerInterviewTurn {
  return assembleCareerInterviewTurn({
    claimDrafts: turn.claimDrafts.map((claim) => ({
      id: claim.id, kind: claim.kind, text: claim.text, contribution: claim.contribution,
      complexity: claim.complexity, hasTradeoff: claim.hasTradeoff, hasMethodReuse: claim.hasMethodReuse,
      sourceQuote: claim.sourceQuote, status: claim.status,
    })),
    metricDrafts: turn.metricDrafts,
    capabilitySuggestions: turn.capabilitySuggestions,
    nextQuestions: turn.nextQuestions,
    shouldFinish: turn.shouldFinish,
    reviewWarnings: turn.reviewWarnings,
  }, input);
}

export function buildMockInterviewTurn(input: CareerInterviewInput): CareerInterviewTurn {
  const quote = input.answers.at(-1)?.answer.trim() || input.background.trim();
  const lines = quote.split(/[。！？\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  const claimDrafts = lines.map((text, index) => ({
    id: `draft-${input.sessionId}-${input.round}-${index + 1}`, kind: "action" as const, text,
    contribution: "independent" as const, complexity: "routine" as const, hasTradeoff: false, hasMethodReuse: false,
    sourceQuote: text, status: "candidate" as const,
  }));
  const questions = [
    { id: `q-${input.round}-role`, question: "你在这段经历中的具体职责和个人边界是什么？", purpose: "确认个人贡献" },
    { id: `q-${input.round}-result`, question: "结果如何验证？如果有数据，请说明口径、周期和来源。", purpose: "补充可核验结果" },
    { id: `q-${input.round}-decision`, question: "你做过哪些关键取舍，为什么这样决定？", purpose: "补充复杂度与决策证据" },
  ];
  return assembleCareerInterviewTurn({ claimDrafts, metricDrafts: [], capabilitySuggestions: [],
    nextQuestions: questions.slice(0, input.round > 1 ? 2 : 3), shouldFinish: false,
    reviewWarnings: ["Mock 仅用于流程验证，未调用真实模型。"] }, input);
}
