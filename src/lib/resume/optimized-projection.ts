import type { FinalResume, OptimizedItem, ResumeBulletValue } from "@/types/resume";

function bulletText(value: ResumeBulletValue): string { return typeof value === "string" ? value : value.text; }

function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s\u3000\p{P}\p{S}]+/gu, "");
}

function semanticFragments(value: string): Set<string> {
  const text = normalized(value);
  const fragments = new Set<string>();
  for (const match of text.matchAll(/[a-z0-9+#]+|[\u4e00-\u9fff]/gi)) fragments.add(match[0]);
  for (let index = 0; index < text.length - 1; index += 1) {
    const pair = text.slice(index, index + 2);
    if (/^[\u4e00-\u9fff]{2}$/.test(pair)) fragments.add(pair);
  }
  return fragments;
}

function overlapScore(left: string, right: string): number {
  const leftFragments = semanticFragments(left);
  const rightFragments = semanticFragments(right);
  let score = 0;
  for (const fragment of leftFragments) if (rightFragments.has(fragment)) score += fragment.length === 1 ? 0.5 : 1;
  return score;
}

function replaceBullet(bullets: ResumeBulletValue[], before: string, after: string): ResumeBulletValue[] {
  if (bullets.some((bullet) => normalized(bulletText(bullet)) === normalized(after))) return [...bullets];
  const needle = before.trim().slice(0, 48);
  const exactIndex = needle ? bullets.findIndex((bullet) => normalized(bulletText(bullet)).includes(normalized(needle))) : -1;
  if (exactIndex >= 0) return bullets.map((bullet, bulletIndex) => bulletIndex === exactIndex ? after : bullet);
  const scores = bullets.map((bullet) => overlapScore(before, bulletText(bullet)));
  const bestScore = Math.max(0, ...scores);
  const index = bestScore >= 2 ? scores.indexOf(bestScore) : -1;
  if (index < 0) return [...bullets, after];
  return bullets.map((bullet, bulletIndex) => bulletIndex === index ? after : bullet);
}

function sectionLabel(section: string, kind: "工作经历" | "项目经历"): string {
  const match = section.match(new RegExp(`${kind}\\s*[-—:：]\\s*(.+)$`));
  return match?.[1]?.trim() ?? "";
}

function findExperienceIndex<T extends { company?: string; role?: string; name?: string; bullets: ResumeBulletValue[] }>(
  experiences: T[],
  section: string,
  before: string,
  kind: "工作经历" | "项目经历",
): number {
  const label = sectionLabel(section, kind);
  const scores = experiences.map((experience) => {
    const identity = `${experience.company ?? ""} ${experience.name ?? ""} ${experience.role ?? ""}`;
    const bulletTextValue = experience.bullets.map(bulletText).join(" ");
    return overlapScore(label, identity) * 3 + overlapScore(before, bulletTextValue);
  });
  const bestScore = Math.max(0, ...scores);
  return bestScore >= 2 ? scores.indexOf(bestScore) : -1;
}

/** Keep the final deliverable auditable against the rows approved in the optimization table. */
export function applyOptimizedItemsToFinalResume(resume: FinalResume, items: OptimizedItem[]): FinalResume {
  let next: FinalResume = { ...resume, workExperience: resume.workExperience.map((item) => ({ ...item, bullets: [...item.bullets] })), projectExperience: resume.projectExperience.map((item) => ({ ...item, bullets: [...item.bullets] })), skillsAndTools: [...resume.skillsAndTools] };
  for (const item of items) {
    const after = item.after.trim();
    if (!after) continue;
    if (/职业摘要|摘要/.test(item.section)) { next = { ...next, summary: after }; continue; }
    if (/技能|工具/.test(item.section)) { next = { ...next, skillsAndTools: after.split(/\s*\|\s*/).map((value) => value.trim()).filter(Boolean) }; continue; }
    if (/工作经历/.test(item.section)) {
      const matchedIndex = findExperienceIndex(next.workExperience, item.section, item.before, "工作经历");
      const index = matchedIndex >= 0 ? matchedIndex : 0;
      const targetIndex = index >= 0 ? index : 0;
      next = { ...next, workExperience: next.workExperience.map((experience, experienceIndex) => experienceIndex === targetIndex ? { ...experience, bullets: replaceBullet(experience.bullets, item.before, after) } : experience) };
      continue;
    }
    if (/项目经历|新增/.test(item.section)) {
      const matchedIndex = findExperienceIndex(next.projectExperience, item.section, item.before, "项目经历");
      const index = matchedIndex >= 0 ? matchedIndex : next.projectExperience.findIndex((experience) => `${experience.name} ${experience.bullets.map(bulletText).join(" ")}`.includes(item.before.trim().slice(0, 24)));
      if (index >= 0) next = { ...next, projectExperience: next.projectExperience.map((experience, experienceIndex) => experienceIndex === index ? { ...experience, bullets: replaceBullet(experience.bullets, item.before, after) } : experience) };
      else if (/新增/.test(item.section)) next = { ...next, projectExperience: [...next.projectExperience, { name: item.section.replace(/^新增\s*[-—:]?\s*/, "") || "岗位相关项目", role: "", period: "", bullets: [after] }] };
    }
  }
  return next;
}
