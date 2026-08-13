import { getAIConfig } from "@/lib/ai/config";
import { chatCompletionJSON } from "@/lib/ai/client";
import { careerInterviewTurnSchema } from "@/lib/career/schemas";
import type { CareerInterviewAnswer, CareerInterviewTurn } from "@/types/career-domain";

export interface CareerInterviewInput {
  sessionId: string; targetRole: string; experienceTitle: string; background: string;
  round: number; answers: CareerInterviewAnswer[]; endRequested: boolean;
}

export async function runCareerInterview(input: CareerInterviewInput): Promise<{ turn: CareerInterviewTurn; mode: "mock" | "llm" }> {
  if (getAIConfig().mode === "mock") return { turn: buildMockInterviewTurn(input), mode: "mock" };
  const turn = await chatCompletionJSON({
    schema: careerInterviewTurnSchema, schemaName: "career_interview_turn", strictOutput: true, temperature: 0.2,
    system: `你是项目经历结构化访谈助手。只允许整理用户原文和回答中的事实，不得新增人名、公司、日期、技术、数字或结果。
每条 claimDraft.sourceQuote 必须逐字存在于 background 或 answers.answer；找不到逐字引用时 status 必须为 needs-review。
每轮只提出 1-3 个信息增益最高的问题；第 5 轮必须结束。输出严格 JSON。`,
    user: JSON.stringify(input),
  });
  return { turn: enforceSourceGrounding(turn, input), mode: "llm" };
}

export function enforceSourceGrounding(turn: CareerInterviewTurn, input: CareerInterviewInput): CareerInterviewTurn {
  const source = [input.background, ...input.answers.map((item) => item.answer)].join("\n");
  const maxed = input.round >= 5;
  const ended = input.endRequested || maxed;
  return careerInterviewTurnSchema.parse({
    ...turn, round: input.round,
    claimDrafts: turn.claimDrafts.map((claim) => ({ ...claim, sourceRound: input.round, status: claim.sourceQuote && source.includes(claim.sourceQuote) ? claim.status : "needs-review" })),
    nextQuestions: ended ? [] : turn.nextQuestions.slice(0, 3),
    shouldFinish: ended || turn.shouldFinish,
    finishReason: maxed ? "max-rounds" : input.endRequested ? "user-ended" : turn.shouldFinish ? "sufficient" : "continue",
  });
}

export function buildMockInterviewTurn(input: CareerInterviewInput): CareerInterviewTurn {
  const quote = input.answers.at(-1)?.answer.trim() || input.background.trim();
  const lines = quote.split(/[。！？\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  const claimDrafts = lines.map((text, index) => ({
    id: `draft-${input.sessionId}-${input.round}-${index + 1}`, kind: "action" as const, text,
    contribution: "independent" as const, complexity: "routine" as const, hasTradeoff: false, hasMethodReuse: false,
    sourceQuote: text, sourceRound: input.round, status: "candidate" as const,
  }));
  const questions = [
    { id: `q-${input.round}-role`, question: "你在这段经历中的具体职责和个人边界是什么？", purpose: "确认个人贡献" },
    { id: `q-${input.round}-result`, question: "结果如何验证？如果有数据，请说明口径、周期和来源。", purpose: "补充可核验结果" },
    { id: `q-${input.round}-decision`, question: "你做过哪些关键取舍，为什么这样决定？", purpose: "补充复杂度与决策证据" },
  ];
  const finish = input.endRequested || input.round >= 5;
  return careerInterviewTurnSchema.parse({
    runId: `career-${crypto.randomUUID()}`, round: input.round,
    coverage: { responsibility: input.answers.length > 0, action: claimDrafts.length > 0, result: /结果|提升|降低|完成/.test(quote), metric: /\d/.test(quote), decision: /选择|取舍|决定|因为/.test(quote) },
    claimDrafts, metricDrafts: [], capabilitySuggestions: [], nextQuestions: finish ? [] : questions.slice(0, input.round > 1 ? 2 : 3),
    shouldFinish: finish, finishReason: input.round >= 5 ? "max-rounds" : input.endRequested ? "user-ended" : "continue", reviewWarnings: [],
  });
}
