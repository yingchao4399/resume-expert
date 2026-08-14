import type { FinalResume, UserInput } from "@/types/resume";

function firstMatchingLine(input: UserInput, pattern: RegExp): string {
  return input.originalResume
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => pattern.test(line)) ?? "";
}

export function buildConservativeResume(input: UserInput): FinalResume {
  const firstLine = firstMatchingLine(input, /\S/);
  const email = input.originalResume.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] ?? "";
  const phone = input.originalResume.match(/(?:\+?86[-\s]?)?1[3-9]\d{9}/)?.[0] ?? "";
  const nameCandidate = firstLine.split(/[|｜·]/)[0]?.trim() ?? "";
  const safeName = nameCandidate && nameCandidate.length <= 20 && !/简历|经历|求职|resume/i.test(nameCandidate)
    ? nameCandidate
    : "";
  const summaryLines = input.originalResume
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 12 && !/[【】]/.test(line))
    .slice(0, 2);

  return {
    personalInfo: { name: safeName, email, phone, location: "" },
    jobIntent: input.targetRole.trim(),
    summary: summaryLines.join(" "),
    coreSkills: [],
    workExperience: [],
    projectExperience: [],
    skillsAndTools: [],
    education: { school: "", degree: "", period: "" },
  };
}

