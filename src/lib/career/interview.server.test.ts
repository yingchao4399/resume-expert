import { describe, expect, it } from "vitest";
import { assembleCareerInterviewTurn, buildMockInterviewTurn, enforceSourceGrounding } from "@/lib/career/interview.server";

const input = { sessionId: "s1", targetRole: "产品经理", experienceTitle: "项目", background: "完成了需求梳理和原型设计", round: 1, answers: [], endRequested: false };

describe("career interview", () => {
  it("mock copies user-provided facts and asks at most three questions", () => {
    const turn = buildMockInterviewTurn(input);
    expect(turn.claimDrafts[0].text).toBe(input.background);
    expect(turn.nextQuestions.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(turn)).not.toContain("40%");
  });

  it("downgrades drafts whose source quote is absent", () => {
    const turn = buildMockInterviewTurn(input);
    turn.claimDrafts[0].sourceQuote = "输入中不存在的成果";
    expect(enforceSourceGrounding(turn, input).claimDrafts[0].status).toBe("needs-review");
  });

  it("forces the fifth round to finish", () => {
    const finalInput = { ...input, round: 5 };
    const turn = buildMockInterviewTurn(finalInput);
    expect(turn).toMatchObject({ shouldFinish: true, finishReason: "max-rounds", nextQuestions: [] });
  });

  it("assembles DeepSeek-style semantic output without runId or coverage", () => {
    const turn = assembleCareerInterviewTurn({
      claimDrafts: [{ id: "c1", kind: "action", text: input.background, contribution: "independent", complexity: "routine", hasTradeoff: false, hasMethodReuse: false, sourceQuote: input.background, status: "candidate" }],
      metricDrafts: [], capabilitySuggestions: [], nextQuestions: [{ id: "q1", question: "结果如何验证？", purpose: "补证" }], shouldFinish: false, reviewWarnings: [],
    }, input);
    expect(turn.runId).toMatch(/^career-/);
    expect(turn.coverage).toEqual({ responsibility: false, action: true, result: false, metric: false, decision: false });
    expect(turn.claimDrafts[0].sourceRound).toBe(1);
  });
});
