import type { JDRequirementAtom } from "@/types/jd-analysis";

const normalize = (value: string) => value.toLocaleLowerCase().replace(/[\s，。；、,.：:（）()\-_/]+/g, "");

export function findResumeQuotes(resume: string, requirement: JDRequirementAtom, limit = 3): string[] {
  const terms = [...(requirement.keywords ?? []), ...(requirement.normalizedText.match(/[A-Za-z][A-Za-z0-9.+#/-]{1,20}|[\u4e00-\u9fff]{2,8}/g) ?? [])]
    .map((item) => item.trim()).filter((item) => item.length >= 2);
  const uniqueTerms = [...new Set(terms.map(normalize).filter(Boolean))];
  if (!uniqueTerms.length) return [];
  return resume.split(/\r?\n|(?<=[。；!?！？])/).map((item) => item.trim()).filter((item) => item.length >= 4).map((line) => {
    const normalized = normalize(line);
    const hits = uniqueTerms.filter((term) => normalized.includes(term));
    return { line, score: hits.reduce((sum, term) => sum + Math.min(term.length, 12), 0), hits: hits.length };
  }).filter((item) => item.hits > 0 && item.score >= 3).sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.line);
}
