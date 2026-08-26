import type { JDAnalysisDocument } from "@/types/jd-analysis";
import type { OptimizedItem } from "@/types/resume";

export interface KeywordTextSegment { text: string; keyword: string | null }

export function normalizeKeyword(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s\u3000·•,，。:：;；()（）\[\]【】/\\_-]+/g, "");
}

export function getConfirmedJDKeywords(document: JDAnalysisDocument | null): string[] {
  if (!document || document.status !== "confirmed") return [];
  const keywords = document.requirements
    .filter((item) => item.anchorStatus === "validated" && item.reviewStatus !== "rejected" && item.reviewStatus !== "needs-review")
    .flatMap((item) => item.keywords ?? []);
  return uniqueKeywords(keywords);
}

export function findCoveredKeywords(text: string, keywords: string[]): string[] {
  const normalizedText = normalizeKeyword(text);
  return uniqueKeywords(keywords).filter((keyword) => normalizedText.includes(normalizeKeyword(keyword)));
}

export function getMissingKeywordCandidates(item: OptimizedItem, keywords: string[], limit = 8): string[] {
  const missing = uniqueKeywords(keywords).filter((keyword) => !findCoveredKeywords(item.after, [keyword]).length);
  const context = normalizeKeyword(`${item.section} ${item.before} ${item.after} ${item.reason}`);
  const related = missing.filter((keyword) => context.includes(normalizeKeyword(keyword)));
  return [...related, ...missing.filter((keyword) => !related.includes(keyword))].slice(0, limit);
}

export function splitTextByKeywords(text: string, keywords: string[]): KeywordTextSegment[] {
  const clean = uniqueKeywords(keywords).sort((a, b) => b.length - a.length);
  if (!text || !clean.length) return [{ text, keyword: null }];
  const escaped = clean.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const matcher = new RegExp(`(${escaped.join("|")})`, "gi");
  return text.split(matcher).filter(Boolean).map((part) => ({
    text: part,
    keyword: clean.find((keyword) => normalizeKeyword(keyword) === normalizeKeyword(part)) ?? null,
  }));
}

export function stableKeywordSource(documentId: string, itemId: string, keyword: string): string {
  return `keyword-enhancement:${documentId}:${itemId}:${normalizeKeyword(keyword)}`;
}

function uniqueKeywords(values: string[]): string[] {
  const seen = new Set<string>();
  return values.map((item) => item.trim()).filter((item) => {
    const key = normalizeKeyword(item);
    if (key.length < 2 || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
