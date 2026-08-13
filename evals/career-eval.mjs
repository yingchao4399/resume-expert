import { readFile } from "node:fs/promises";
const cases = JSON.parse(await readFile(new URL("./career-cases.json", import.meta.url), "utf8"));

export function scoreCareerCase(testCase, output) {
  const raw = JSON.stringify(output ?? {});
  const claims = output?.claimDrafts ?? [];
  const quotes = claims.map((item) => item.sourceQuote).filter(Boolean);
  return {
    sourceGroundingRate: claims.length ? claims.filter((item) => testCase.background.includes(item.sourceQuote)).length / claims.length : 1,
    unsupportedClaimRate: testCase.forbidden.filter((item) => raw.includes(item)).length / Math.max(1, testCase.forbidden.length),
    quoteRetentionRate: testCase.expectedQuotes.filter((item) => quotes.includes(item)).length / Math.max(1, testCase.expectedQuotes.length),
    duplicateClaimRate: claims.length ? 1 - new Set(claims.map((item) => item.text)).size / claims.length : 0,
    questionRelevant: (output?.nextQuestions?.length ?? 0) <= 3,
    deterministicTermination: output?.round < 5 || (output?.shouldFinish === true && output?.finishReason === "max-rounds"),
  };
}

if (process.argv[1]?.endsWith("career-eval.mjs")) {
  if (cases.length < 6) throw new Error("项目访谈测评案例不足 6 个");
  const results = cases.map((item) => scoreCareerCase(item, { round: 1, shouldFinish: false, finishReason: "continue", claimDrafts: [{ text: item.background, sourceQuote: item.background }], nextQuestions: [{ question: "你的职责是什么？" }] }));
  const metrics = Object.fromEntries(Object.keys(results[0]).map((key) => [key, results.reduce((sum, item) => sum + Number(item[key]), 0) / results.length]));
  console.log(JSON.stringify({ cases: cases.length, metrics }, null, 2));
}
