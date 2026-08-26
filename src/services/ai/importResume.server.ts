import { chatCompletionJSON } from "@/lib/ai/client";
import { getAIConfig } from "@/lib/ai/config";
import { importedResumeProfileSchema, structureResumeResultSchema } from "@/lib/ai/schemas";
import type { AIMode } from "@/lib/ai/types";
import type { FinalResume, ImportedEducation, ImportedExperience, ImportedResumeItem, ImportedResumeProfile } from "@/types/resume";
import type { WorkflowExecutionOptions } from "@/lib/studio/execution";

export interface StructuredImportedResumeResult {
  finalResume: FinalResume;
  importedResume: ImportedResumeProfile;
  unmappedSegments: ImportedResumeItem[];
  mode: AIMode;
}

export async function structureImportedResumeServer(
  text: string,
  execution: Pick<WorkflowExecutionOptions, "model" | "timeoutMs" | "capture"> = {},
): Promise<StructuredImportedResumeResult> {
  const mode = getAIConfig().mode;
  if (mode === "mock") {
    const importedResume = structureLocally(text);
    return { finalResume: projectFinalResume(importedResume), importedResume, unmappedSegments: importedResume.unmappedSegments, mode };
  }

  const result = await chatCompletionJSON({
    promptId: "resume.import-structure",
    schema: structureResumeResultSchema,
    schemaName: "structured_imported_resume",
    temperature: 0,
    system:
      "你是严谨的中文简历结构化助手。只能提取输入中明确存在的信息，不得补写、猜测或夸大。每条记录必须引用原文中的连续片段；无法归类的信息放入 unmappedSegments。所有记录默认 status=candidate。",
    user: [
      "只提取原文明确存在的事实，不得创造姓名、公司、时间、技术、数字或成果。",
      "请返回 finalResume（兼容旧页面）和 importedResume（完整来源资料）。",
      'importedResume 结构：{"schemaVersion":1,"personalInfo":{"name":"","email":"","phone":"","location":""},"jobIntent":"","summary":"","workExperience":[],"internshipExperience":[],"projectExperience":[],"educationHistory":[],"skillsAndTools":[],"certifications":[],"languages":[],"awards":[],"links":[],"otherSections":[],"unmappedSegments":[]}',
      "每条记录的 sourceQuote 必须是简历原文中的连续子串；无法确认时不要猜测，放入 unmappedSegments。",
      "Resume text:",
      text,
    ].join("\n\n"),
    ...execution,
  });
  const importedResume = sanitizeImportedProfile(result.importedResume ?? profileFromFinalResume(result.finalResume, text), text);
  return {
    finalResume: projectFinalResume(importedResume),
    importedResume,
    unmappedSegments: importedResume.unmappedSegments,
    mode,
  };
}

function stableId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${prefix}-${(hash >>> 0).toString(16)}`;
}

function item(text: string, sourceQuote = text): ImportedResumeItem {
  const normalizedText = text.trim();
  const normalizedQuote = sourceQuote.trim();
  return { id: stableId("import", `${normalizedQuote}\u0000${normalizedText}`), text: normalizedText, sourceQuote: normalizedQuote, status: "candidate", confidence: "medium" };
}

const SECTION_PATTERNS: Array<[RegExp, keyof ImportedResumeProfile]> = [
  [/^(工作|工作经历|工作经验|employment|experience)/i, "workExperience"],
  [/^(实习|实习经历|internship)/i, "internshipExperience"],
  [/^(项目|项目经历|项目经验|projects?)/i, "projectExperience"],
  [/^(教育|教育背景|教育经历|学历|education)/i, "educationHistory"],
  [/^(技能|专业技能|技术栈|skills?|technologies?)/i, "skillsAndTools"],
  [/^(证书|资格证书|certifications?|certificates?)/i, "certifications"],
  [/^(语言|语言能力|languages?)/i, "languages"],
  [/^(奖项|荣誉|awards?|honors?)/i, "awards"],
  [/^(链接|作品集|联系方式|links?|portfolio|github)/i, "links"],
  [/^(论文|出版|志愿|社团|其他|publications?|volunteer|other)/i, "otherSections"],
];

function sectionFor(line: string): keyof ImportedResumeProfile | null {
  const normalized = line.replace(/[：:]$/, "").trim();
  return SECTION_PATTERNS.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

function parseExperience(lines: string[], kind: "workExperience" | "internshipExperience" | "projectExperience"): ImportedExperience[] {
  if (!lines.length) return [];
  const groups: string[][] = [];
  for (const line of lines) {
    if (/^[-•·*]/.test(line) && groups.length) groups[groups.length - 1].push(line.replace(/^[-•·*]\s*/, ""));
    else if (groups.length && /\d{4}|至今|present|公司|项目|有限公司/i.test(line) && groups[groups.length - 1].length > 2) groups.push([line]);
    else if (!groups.length) groups.push([line]);
    else groups[groups.length - 1].push(line);
  }
  return groups.map((group, index) => {
    const sourceQuote = group.join(" ");
    const first = group[0] ?? "";
    const period = first.match(/(?:19|20)\d{2}\s*(?:年|[-/.至到])\s*(?:(?:19|20)\d{2}|至今|present)?/i)?.[0] ?? "";
    const parts = first.split(/[|｜·,，]/).map((value) => value.trim()).filter(Boolean);
    const organization = kind === "projectExperience" ? "" : parts[0] ?? "";
    const name = kind === "projectExperience" ? parts[0] ?? "" : "";
    const role = parts[1] ?? "";
    const bulletLines = group.slice(1).filter(Boolean);
    return {
      id: stableId(kind === "projectExperience" ? "project" : "experience", sourceQuote || String(index)),
      organization,
      name,
      role,
      period,
      summary: bulletLines.length ? bulletLines[0] : "",
      bullets: bulletLines.map((value) => item(value)),
      sourceQuote,
      status: "candidate" as const,
      confidence: "medium" as const,
    };
  });
}

function parseEducation(lines: string[]): ImportedEducation[] {
  return lines.filter(Boolean).map((line, index) => {
    const parts = line.split(/[|｜·,，]/).map((value) => value.trim()).filter(Boolean);
    return {
      id: stableId("education", line || String(index)),
      school: parts[0] ?? "",
      degree: parts[1] ?? "",
      period: parts.find((part) => /(?:19|20)\d{2}|至今|present/i.test(part)) ?? "",
      details: parts.slice(2).map((value) => item(value)),
      sourceQuote: line,
      status: "candidate",
      confidence: "medium",
    };
  });
}

export function structureLocally(text: string): ImportedResumeProfile {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = text.match(/(?:\+?86[- ]?)?1[3-9]\d{9}/)?.[0] ?? "";
  const firstLine = lines[0] ?? "";
  const name = firstLine.split(/[|｜·-]/)[0]?.trim() ?? "";
  const personalInfo = { name: name.length <= 20 ? name : "", email, phone, location: firstLine.match(/(?:北京|上海|广州|深圳|杭州|成都|南京|苏州|武汉|重庆|西安)/)?.[0] ?? "" };
  const buckets: Record<string, string[]> = {};
  let current: keyof ImportedResumeProfile | "header" = "header";
  for (const line of lines) {
    const next = sectionFor(line);
    if (next) { current = next; buckets[current] ??= []; continue; }
    (buckets[current] ??= []).push(line);
  }
  const profile: ImportedResumeProfile = {
    schemaVersion: 1,
    personalInfo,
    jobIntent: firstLine.split(/[|｜·-]/)[1]?.trim() ?? "",
    summary: (buckets.header ?? []).slice(1, 4).join(" ").slice(0, 500),
    workExperience: parseExperience(buckets.workExperience ?? [], "workExperience"),
    internshipExperience: parseExperience(buckets.internshipExperience ?? [], "internshipExperience"),
    projectExperience: parseExperience(buckets.projectExperience ?? [], "projectExperience"),
    educationHistory: parseEducation(buckets.educationHistory ?? []),
    skillsAndTools: (buckets.skillsAndTools ?? []).flatMap((line) => line.split(/[、,，|｜]/).filter(Boolean).map((value) => item(value.trim(), line))),
    certifications: (buckets.certifications ?? []).map((line) => item(line)),
    languages: (buckets.languages ?? []).map((line) => item(line)),
    awards: (buckets.awards ?? []).map((line) => item(line)),
    links: (buckets.links ?? []).map((line) => item(line)),
    otherSections: (buckets.otherSections ?? []).map((line) => item(line)),
    unmappedSegments: [],
  };
  const known = new Set(["header", ...SECTION_PATTERNS.map(([, key]) => key)]);
  for (const [key, values] of Object.entries(buckets)) if (!known.has(key)) for (const value of values) profile.unmappedSegments.push(item(value));
  return profile;
}

function profileFromFinalResume(resume: FinalResume, text: string): ImportedResumeProfile {
  const quote = text.slice(0, Math.min(text.length, 100));
  return {
    schemaVersion: 1,
    personalInfo: resume.personalInfo,
    jobIntent: resume.jobIntent,
    summary: resume.summary,
    workExperience: resume.workExperience.map((entry) => ({ id: stableId("experience", entry.company + entry.role), organization: entry.company, name: "", role: entry.role, period: entry.period, summary: "", bullets: entry.bullets.map((bullet) => item(typeof bullet === "string" ? bullet : bullet.text)), sourceQuote: quote, status: "needs-review", confidence: "low" })),
    internshipExperience: [],
    projectExperience: resume.projectExperience.map((entry) => ({ id: stableId("project", entry.name + entry.role), organization: "", name: entry.name, role: entry.role, period: entry.period, summary: "", bullets: entry.bullets.map((bullet) => item(typeof bullet === "string" ? bullet : bullet.text)), sourceQuote: quote, status: "needs-review", confidence: "low" })),
    educationHistory: resume.education.school ? [{ id: stableId("education", quote), school: resume.education.school, degree: resume.education.degree, period: resume.education.period, details: [], sourceQuote: quote, status: "needs-review", confidence: "low" }] : [],
    skillsAndTools: resume.skillsAndTools.map((value) => item(value, value)),
    certifications: [], languages: [], awards: [], links: [], otherSections: [], unmappedSegments: [],
  };
}

function hasSourceQuote(sourceText: string, sourceQuote: string): boolean {
  const normalizedQuote = sourceQuote.trim();
  return normalizedQuote.length > 0 && sourceText.includes(normalizedQuote);
}

export function sanitizeImportedProfile(profile: ImportedResumeProfile, sourceText: string): ImportedResumeProfile {
  const invalidSegments: ImportedResumeItem[] = [];
  const quarantine = (entry: ImportedResumeItem) => {
    if (!entry.text.trim()) return;
    if (!invalidSegments.some((item) => item.text === entry.text)) {
      invalidSegments.push({ ...entry, id: stableId("unmapped-invalid", `${entry.id}\u0000${entry.text}`), sourceQuote: "", status: "needs-review", confidence: "low" });
    }
  };
  const sanitize = (entry: ImportedResumeItem): ImportedResumeItem => {
    if (hasSourceQuote(sourceText, entry.sourceQuote)) return entry;
    quarantine(entry);
    return { ...entry, sourceQuote: "", status: "needs-review", confidence: "low" };
  };
  const sanitizeExperience = (entry: ImportedExperience): ImportedExperience => {
    const valid = hasSourceQuote(sourceText, entry.sourceQuote);
    if (!valid) quarantine({
      id: entry.id,
      text: entry.summary || [entry.organization, entry.name, entry.role, entry.period].filter(Boolean).join(" · "),
      sourceQuote: "",
      status: "needs-review",
      confidence: "low",
    });
    return {
      ...entry,
      bullets: entry.bullets.map(sanitize),
      sourceQuote: valid ? entry.sourceQuote : "",
      status: valid ? entry.status : "needs-review",
      confidence: valid ? entry.confidence : "low",
    };
  };
  const parsed = importedResumeProfileSchema.parse({
    ...profile,
    workExperience: profile.workExperience.map(sanitizeExperience),
    internshipExperience: profile.internshipExperience.map(sanitizeExperience),
    projectExperience: profile.projectExperience.map(sanitizeExperience),
    educationHistory: profile.educationHistory.map((entry) => {
      const valid = hasSourceQuote(sourceText, entry.sourceQuote);
      if (!valid) quarantine({ id: entry.id, text: [entry.school, entry.degree, entry.period].filter(Boolean).join(" · "), sourceQuote: "", status: "needs-review", confidence: "low" });
      return {
        ...entry,
        details: entry.details.map(sanitize),
        sourceQuote: valid ? entry.sourceQuote : "",
        status: valid ? entry.status : "needs-review",
        confidence: valid ? entry.confidence : "low",
      };
    }),
    skillsAndTools: profile.skillsAndTools.map(sanitize), certifications: profile.certifications.map(sanitize), languages: profile.languages.map(sanitize), awards: profile.awards.map(sanitize), links: profile.links.map(sanitize), otherSections: profile.otherSections.map(sanitize), unmappedSegments: profile.unmappedSegments.map(sanitize),
  });
  const quotes = collectSourceQuotes(parsed);
  const missing = sourceText.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length >= 2 && !quotes.some((quote) => quote.includes(line) || line.includes(quote)));
  const existing = new Set(parsed.unmappedSegments.map((segment) => segment.text));
  return {
    ...parsed,
    unmappedSegments: [
      ...parsed.unmappedSegments,
      ...invalidSegments.filter((entry) => !existing.has(entry.text)),
      ...missing.filter((line) => !existing.has(line) && !invalidSegments.some((entry) => entry.text === line)).map((line) => ({ ...item(line), id: stableId("unmapped", line), confidence: "low" as const })),
    ],
  };
}

function collectSourceQuotes(profile: ImportedResumeProfile): string[] {
  const quotes: string[] = [];
  const collectItems = (values: ImportedResumeItem[]) => values.forEach((value) => value.sourceQuote && quotes.push(value.sourceQuote));
  const collectExperiences = (values: ImportedExperience[]) => values.forEach((value) => { if (value.sourceQuote) quotes.push(value.sourceQuote); collectItems(value.bullets); });
  collectExperiences(profile.workExperience); collectExperiences(profile.internshipExperience); collectExperiences(profile.projectExperience);
  profile.educationHistory.forEach((value) => { if (value.sourceQuote) quotes.push(value.sourceQuote); collectItems(value.details); });
  collectItems(profile.skillsAndTools); collectItems(profile.certifications); collectItems(profile.languages); collectItems(profile.awards); collectItems(profile.links); collectItems(profile.otherSections);
  return quotes;
}

export function projectFinalResume(profile: ImportedResumeProfile): FinalResume {
  const safeItems = (values: ImportedResumeItem[]) => values.filter((item) => item.status !== "needs-review" && item.text.trim());
  const safeWork = [...profile.workExperience, ...profile.internshipExperience].filter((entry) => entry.status !== "needs-review");
  const safeProjects = profile.projectExperience.filter((entry) => entry.status !== "needs-review");
  const safeEducation = profile.educationHistory.filter((entry) => entry.status !== "needs-review");
  const firstEducation = safeEducation[0];
  const skills = safeItems(profile.skillsAndTools);
  return {
    personalInfo: profile.personalInfo,
    jobIntent: profile.jobIntent,
    summary: profile.summary,
    coreSkills: skills.map((value) => value.text),
    workExperience: safeWork.map((entry) => ({ company: entry.organization, role: entry.role, period: entry.period, bullets: safeItems(entry.bullets).map((value) => value.text) })),
    projectExperience: safeProjects.map((entry) => ({ name: entry.name, role: entry.role, period: entry.period, bullets: safeItems(entry.bullets).map((value) => value.text) })),
    skillsAndTools: skills.map((value) => value.text),
    education: firstEducation ? { school: firstEducation.school, degree: firstEducation.degree, period: firstEducation.period } : { school: "", degree: "", period: "" },
    educationHistory: safeEducation,
    certifications: safeItems(profile.certifications),
    languages: safeItems(profile.languages),
    awards: safeItems(profile.awards),
    links: safeItems(profile.links),
    otherSections: safeItems(profile.otherSections),
  };
}
