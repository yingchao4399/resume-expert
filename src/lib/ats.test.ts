import { describe, expect, it } from "vitest";
import { calculateATSAssessment } from "@/lib/ats";
import type { AnalysisResult, UserInput } from "@/types/resume";

const input: UserInput = {
  targetRole: "前端工程师",
  industry: "互联网",
  companyType: "中型公司",
  jobStage: "社招-中级",
  highlightSkills: "",
  jobDescription: "需要 TypeScript、React 和 SQL",
  originalResume: "测试简历",
  additionalInfo: "",
};

const result: AnalysisResult = {
  jdAnalysis: {
    responsibilities: [],
    hardRequirements: [],
    implicitRequirements: [],
    keywords: ["TypeScript", "React", "SQL"],
    idealCandidate: "",
    coreCompetencies: [],
  },
  diagnosis: {
    overallScore: 50,
    dimensionScores: [],
    mainIssues: [],
    prioritySuggestions: [],
  },
  matchItems: [
    {
      jdRequirement: "TypeScript",
      resumeEvidence: "项目使用 TypeScript",
      evidenceStrength: "strong",
      needsSupplement: false,
      optimizationSuggestion: "",
    },
    {
      jdRequirement: "SQL",
      resumeEvidence: "",
      evidenceStrength: "weak",
      needsSupplement: true,
      optimizationSuggestion: "补充数据库经验",
    },
  ],
  followUpQuestions: [],
  optimizedItems: [],
  finalResume: {
    personalInfo: {
      name: "张三",
      email: "zhangsan@example.com",
      phone: "",
      location: "上海",
    },
    jobIntent: "前端工程师",
    summary: "熟悉 TypeScript 与 React 的前端工程师。",
    coreSkills: ["TypeScript", "React"],
    workExperience: [
      {
        company: "某公司",
        role: "前端工程师",
        period: "2022-至今",
        bullets: ["负责核心系统开发，效率提升 40%", "维护组件库"],
      },
    ],
    projectExperience: [
      {
        name: "管理后台",
        role: "负责人",
        period: "2023",
        bullets: [],
      },
    ],
    skillsAndTools: ["Git"],
    education: {
      school: "某大学",
      degree: "本科",
      period: "2018-2022",
    },
  },
  interviewPrep: {
    likelyQuestions: [],
    evidenceToPrepare: [],
    possibleExaggerations: [],
    dataToSupplement: [],
    selfIntroduction: "",
  },
};

describe("calculateATSAssessment", () => {
  it("uses deterministic weighted scoring", () => {
    const assessment = calculateATSAssessment(input, result);

    expect(assessment.keywordScore).toBe(67);
    expect(assessment.evidenceScore).toBe(65);
    expect(assessment.measurableScore).toBe(50);
    expect(assessment.completenessScore).toBe(89);
    expect(assessment.overallScore).toBe(65);
    expect(assessment.matchedKeywords).toEqual(["TypeScript", "React"]);
    expect(assessment.missingKeywords).toEqual(["SQL"]);
    expect(assessment.weakEvidence).toEqual(["SQL"]);
  });

  it("does not count desired highlight skills as resume keyword matches", () => {
    const assessment = calculateATSAssessment(
      { ...input, highlightSkills: "完全未写入简历的关键能力" },
      { ...result, jdAnalysis: { ...result.jdAnalysis, keywords: ["完全未写入简历的关键能力"] } }
    );
    expect(assessment.keywordScore).toBe(0);
    expect(assessment.missingKeywords).toContain("完全未写入简历的关键能力");
  });
});
