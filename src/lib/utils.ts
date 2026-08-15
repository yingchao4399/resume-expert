import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getBulletText } from "@/lib/evidence/resume-evidence";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function formatResumeAsText(resume: import("@/types/resume").FinalResume): string {
  const lines: string[] = [];

  lines.push(resume.personalInfo.name);
  lines.push(
    `${resume.personalInfo.email} | ${resume.personalInfo.phone} | ${resume.personalInfo.location}`
  );
  lines.push("");
  lines.push(`求职意向：${resume.jobIntent}`);
  lines.push("");
  lines.push("职业摘要");
  lines.push(resume.summary);
  lines.push("");
  lines.push("核心能力");
  resume.coreSkills.forEach((s) => lines.push(`• ${s}`));
  lines.push("");
  lines.push("工作经历");
  resume.workExperience.forEach((w) => {
    lines.push(`${w.company} | ${w.role} | ${w.period}`);
    w.bullets.forEach((b) => lines.push(`  • ${getBulletText(b)}`));
    lines.push("");
  });
  lines.push("项目经历");
  resume.projectExperience.forEach((p) => {
    lines.push(`${p.name} | ${p.role} | ${p.period}`);
    p.bullets.forEach((b) => lines.push(`  • ${getBulletText(b)}`));
    lines.push("");
  });
  lines.push("技能工具");
  lines.push(resume.skillsAndTools.join(" · "));
  lines.push("");
  lines.push("教育背景");
  const education = resume.educationHistory?.length ? resume.educationHistory : [resume.education];
  education.forEach((item) => lines.push(`${item.school} | ${item.degree} | ${item.period}`));
  for (const [label, values] of [["证书", resume.certifications], ["语言", resume.languages], ["奖项", resume.awards], ["链接", resume.links]] as const) {
    if (values?.length) {
      lines.push("");
      lines.push(label);
      values.forEach((item) => lines.push(item.text));
    }
  }
  if (resume.otherSections?.length) {
    lines.push("");
    lines.push("其他信息");
    resume.otherSections.forEach((item) => lines.push(item.text));
  }
  return lines.join("\n");
}
