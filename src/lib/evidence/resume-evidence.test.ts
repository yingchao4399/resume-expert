import { describe, expect, it } from "vitest";
import {
  buildEvidenceCandidates,
  confirmedEvidencePrompt,
  getBulletText,
  normalizeFinalResumeBullets,
  selectRelevantEvidence,
  updateResumeBulletText,
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

  it("creates candidate links for strong automatic evidence matches", () => {
    const evidence: CareerEvidence[] = [{
      ...buildEvidenceCandidates(resume, "document-1")[0],
      id: "evidence-1",
      status: "confirmed",
    }];
    const normalized = normalizeFinalResumeBullets(resume, "ai-generated", evidence);
    const bullet = normalized.workExperience[0].bullets[0];
    expect(typeof bullet).toBe("object");
    expect(getBulletText(bullet)).toContain("库存盘点");
    expect(typeof bullet === "string" ? [] : bullet.evidenceLinks).toContainEqual(expect.objectContaining({ evidenceId: "evidence-1", status: "candidate" }));
  });

  it("marks evidence links for review after a manual bullet edit", () => {
    const edited = updateResumeBulletText({
      id: "bullet-1", text: "原文", sourceType: "ai-generated", evidenceIds: ["evidence-1"],
      evidenceLinks: [{ evidenceId: "evidence-1", status: "confirmed", method: "manual", sourceReference: null }],
      originalText: "", aiText: "原文", manualText: "",
    }, "人工改写后的内容");
    expect(edited.evidenceLinks[0].status).toBe("needs-review");
  });

  it("exposes only confirmed evidence to the AI grounding prompt", () => {
    const candidates = buildEvidenceCandidates(resume, "document-1");
    candidates[0].status = "confirmed";
    const prompt = confirmedEvidencePrompt(candidates.filter((item) => item.status === "confirmed"));
    expect(prompt).toContain(candidates[0].id);
    expect(prompt).not.toContain(candidates[1].id);
  });

  it("selects only JD-relevant confirmed evidence and caps results", () => {
    const candidates = Array.from({ length: 15 }, (_, index) => ({
      ...buildEvidenceCandidates(resume, "document-1")[0], id: `evidence-${index}`, status: "confirmed" as const,
      title: `库存盘点 ${index}`, skills: ["库存盘点"], updatedAt: new Date(2026, 0, index + 1).toISOString(),
    }));
    const unrelated = { ...candidates[0], id: "unrelated", title: "摄影", description: "人像摄影", skills: ["摄影"] };
    const selected = selectRelevantEvidence([...candidates, unrelated], "产品经理", "负责库存盘点流程", "document-1");
    expect(selected).toHaveLength(12);
    expect(selected.some((item) => item.id === "unrelated")).toBe(false);
  });
});
