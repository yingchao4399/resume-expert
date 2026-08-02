import { describe, expect, it } from "vitest";
import {
  buildEvidenceCandidates,
  confirmedEvidencePrompt,
  getBulletText,
  normalizeFinalResumeBullets,
} from "@/lib/evidence/resume-evidence";
import type { CareerEvidence, FinalResume } from "@/types/resume";

const resume: FinalResume = {
  personalInfo: { name: "测试用户", email: "", phone: "", location: "" },
  jobIntent: "产品经理",
  summary: "",
  coreSkills: ["需求分析"],
  workExperience: [{ company: "示例公司", role: "产品经理", period: "2023", bullets: ["重构库存盘点流程，效率提升 40%"] }],
  projectExperience: [],
  skillsAndTools: [],
  education: { school: "", degree: "", period: "" },
};

describe("resume evidence", () => {
  it("creates unconfirmed candidates from imported structured resumes", () => {
    const candidates = buildEvidenceCandidates(resume, "document-1");
    expect(candidates.length).toBe(2);
    expect(candidates.every((item) => item.status === "candidate")).toBe(true);
    expect(candidates[0].metrics).toContain("40%");
  });

  it("normalizes legacy bullets to stable records and links confirmed evidence", () => {
    const evidence: CareerEvidence[] = [{
      ...buildEvidenceCandidates(resume, "document-1")[0],
      id: "evidence-1",
      status: "confirmed",
    }];
    const normalized = normalizeFinalResumeBullets(resume, "ai-generated", evidence);
    const bullet = normalized.workExperience[0].bullets[0];
    expect(typeof bullet).toBe("object");
    expect(getBulletText(bullet)).toContain("库存盘点");
    expect(typeof bullet === "string" ? [] : bullet.evidenceIds).toContain("evidence-1");
  });

  it("exposes only confirmed evidence to the AI grounding prompt", () => {
    const candidates = buildEvidenceCandidates(resume, "document-1");
    candidates[0].status = "confirmed";
    const prompt = confirmedEvidencePrompt(candidates);
    expect(prompt).toContain(candidates[0].id);
    expect(prompt).not.toContain(candidates[1].id);
  });
});
