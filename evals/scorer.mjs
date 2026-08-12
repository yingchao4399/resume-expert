const strengths = ["strong", "medium", "weak", "none"];

export function contains(text, value) {
  return text.toLocaleLowerCase().includes(value.toLocaleLowerCase());
}

function safeRatio(numerator, denominator, emptyValue = 1) {
  return denominator === 0 ? emptyValue : numerator / denominator;
}

function f1(tp, fp, fn) {
  const precision = safeRatio(tp, tp + fp);
  const recall = safeRatio(tp, tp + fn);
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

export function validateCase(value) {
  const errors = [];
  if (!value || typeof value !== "object") return ["案例不是对象"];
  for (const key of ["id", "name", "category", "input", "facts", "expected"]) {
    if (!(key in value)) errors.push(`缺少 ${key}`);
  }
  if (!Array.isArray(value.facts?.immutableFacts)) errors.push("facts.immutableFacts 必须为数组");
  if (!Array.isArray(value.facts?.allowedFacts)) errors.push("facts.allowedFacts 必须为数组");
  if (!Array.isArray(value.facts?.forbiddenClaims)) errors.push("facts.forbiddenClaims 必须为数组");
  if (!Array.isArray(value.expected?.requiredKeywords)) errors.push("expected.requiredKeywords 必须为数组");
  if (!Array.isArray(value.expected?.supplementRequirements)) errors.push("expected.supplementRequirements 必须为数组");
  if (!value.expected?.evidenceStrength || typeof value.expected.evidenceStrength !== "object") {
    errors.push("expected.evidenceStrength 必须为对象");
  } else {
    for (const [key, strength] of Object.entries(value.expected.evidenceStrength)) {
      if (!strengths.includes(strength)) errors.push(`${key} 的证据强度无效`);
    }
  }
  return errors;
}

export function scoreCase(testCase, output, latencyMs = 0) {
  const failures = [];
  const schemaValid = Boolean(
    output && typeof output === "object" && typeof output.finalResumeText === "string" &&
      Array.isArray(output.coveredRequirements) && Array.isArray(output.matchItems)
  );
  if (!schemaValid) {
    const expectedRejection = testCase.category === "malformed-output";
    return {
      id: testCase.id,
      passed: expectedRejection,
      latencyMs,
      failures: expectedRejection ? [] : ["schema_invalid"],
      counters: { schemaValid: expectedRejection ? 1 : 0, immutableHit: 0, immutableTotal: 0, unsupportedHit: 0, forbiddenTotal: 0, requiredHit: 0, requiredTotal: 0, supplementTp: 0, supplementFp: 0, supplementFn: 0, strength: [] },
    };
  }

  const text = output.finalResumeText;
  const immutableHit = testCase.facts.immutableFacts.filter((fact) => contains(text, fact)).length;
  const unsupportedHit = testCase.facts.forbiddenClaims.filter((claim) => contains(text, claim)).length;
  const requiredHit = testCase.expected.requiredKeywords.filter((keyword) =>
    output.coveredRequirements.some((value) => contains(value, keyword))
  ).length;

  if (immutableHit !== testCase.facts.immutableFacts.length) failures.push("immutable_fact_missing");
  if (unsupportedHit > 0) failures.push("unsupported_claim");
  if (requiredHit !== testCase.expected.requiredKeywords.length) failures.push("jd_requirement_missing");

  const expectedSupplements = new Set(testCase.expected.supplementRequirements);
  const predictedSupplements = new Set(
    output.matchItems.filter((item) => item.needsSupplement).map((item) => item.requirement)
  );
  let supplementTp = 0;
  let supplementFp = 0;
  let supplementFn = 0;
  for (const value of predictedSupplements) expectedSupplements.has(value) ? supplementTp++ : supplementFp++;
  for (const value of expectedSupplements) if (!predictedSupplements.has(value)) supplementFn++;

  const strength = Object.entries(testCase.expected.evidenceStrength).map(([requirement, expected]) => {
    const predicted = output.matchItems.find((item) => item.requirement === requirement)?.evidenceStrength ?? "none";
    return { expected, predicted };
  });

  return {
    id: testCase.id,
    passed: failures.length === 0,
    latencyMs,
    failures,
    counters: { schemaValid: 1, immutableHit, immutableTotal: testCase.facts.immutableFacts.length, unsupportedHit, forbiddenTotal: testCase.facts.forbiddenClaims.length, requiredHit, requiredTotal: testCase.expected.requiredKeywords.length, supplementTp, supplementFp, supplementFn, strength },
  };
}

export function aggregateScores(results, metadata) {
  const sum = (key) => results.reduce((total, result) => total + result.counters[key], 0);
  const strengthF1 = strengths.map((label) => {
    let tp = 0; let fp = 0; let fn = 0;
    for (const result of results) {
      for (const item of result.counters.strength) {
        if (item.expected === label && item.predicted === label) tp++;
        else if (item.expected !== label && item.predicted === label) fp++;
        else if (item.expected === label && item.predicted !== label) fn++;
      }
    }
    return f1(tp, fp, fn);
  });
  const failures = {};
  for (const result of results) for (const failure of result.failures) failures[failure] = (failures[failure] ?? 0) + 1;
  const immutableTotal = sum("immutableTotal");
  const forbiddenTotal = sum("forbiddenTotal");
  const supplementTotal = sum("supplementTp") + sum("supplementFp") + sum("supplementFn");
  const supplementF1 = supplementTotal === 0 ? 1 : f1(sum("supplementTp"), sum("supplementFp"), sum("supplementFn"));
  const retention = safeRatio(sum("immutableHit"), immutableTotal);
  const unsupportedRate = safeRatio(sum("unsupportedHit"), forbiddenTotal, 0);
  return {
    schemaVersion: 1,
    id: `${metadata.mode}-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    mode: metadata.mode,
    createdAt: new Date().toISOString(),
    model: metadata.model,
    caseCount: results.length,
    metrics: {
      schemaValidityRate: safeRatio(sum("schemaValid"), results.length),
      immutableFactRetentionRate: retention,
      unsupportedClaimRate: unsupportedRate,
      finalResumeFactAccuracy: Math.max(0, retention * (1 - unsupportedRate)),
      jdRequirementRecall: safeRatio(sum("requiredHit"), sum("requiredTotal")),
      needsSupplementF1: supplementF1,
      evidenceStrengthMacroF1: strengthF1.reduce((a, b) => a + b, 0) / strengthF1.length,
      averageLatencyMs: Math.round(results.reduce((total, result) => total + result.latencyMs, 0) / Math.max(1, results.length)),
      totalTokens: metadata.totalTokens ?? 0,
      failureTypes: failures,
    },
    cases: results.map(({ id, passed, latencyMs, failures: caseFailures }) => ({ id, passed, latencyMs, failures: caseFailures })),
  };
}
