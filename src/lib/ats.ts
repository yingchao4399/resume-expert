import type {
  AnalysisResult,
  ATSAssessment,
  FinalResume,
  UserInput,
} from "@/types/resume";
import { formatResumeAsText } from "@/lib/utils";
import { getBulletText } from "@/lib/evidence/resume-evidence";

const EVIDENCE_WEIGHT = {
  strong: 100,
  medium: 65,
  weak: 30,
  none: 0,
} as const;

function normalize(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[\s\u3000·•,，。:：;；()（）/\\_-]+/g, "");
}

function uniqueKeywords(keywords: string[]): string[] {
  return [...new Set(keywords.map((keyword) => keyword.trim()).filter((keyword) => keyword.length >= 2))];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function hasMetric(text: string): boolean {
  return /(?:\d+(?:[.,]\d+)?\s*(?:%|％|\+|万|千|百|个|项|家|次|人|天|月|年|倍)?|从\s*0\s*到\s*1)/i.test(
    text
  );
}

function completenessChecks(resume: FinalResume): boolean[] {
  return [
    Boolean(resume.personalInfo.name.trim()),
    Boolean(
      resume.personalInfo.email.trim() || resume.personalInfo.phone.trim()
    ),
    Boolean(resume.jobIntent.trim()),
    Boolean(resume.summary.trim()),
    resume.coreSkills.some(Boolean),
    resume.workExperience.some(
      (work) => work.company.trim() && work.bullets.some((bullet) => Boolean(getBulletText(bullet).trim()))
    ),
    resume.projectExperience.some(
      (project) => project.name.trim() && project.bullets.some((bullet) => Boolean(getBulletText(bullet).trim()))
    ),
    resume.skillsAndTools.some(Boolean),
    Boolean(resume.education.school.trim() && resume.education.degree.trim()),
  ];
}

export function calculateATSAssessment(
  input: UserInput,
  result: AnalysisResult
): ATSAssessment {
  const resume = result.finalResume;
  const resumeText = normalize(formatResumeAsText(resume));
  const keywords = uniqueKeywords(result.jdAnalysis.keywords);
  const matchedKeywords = keywords.filter((keyword) =>
    resumeText.includes(normalize(keyword))
  );
  const missingKeywords = keywords.filter(
    (keyword) => !matchedKeywords.includes(keyword)
  );
  const keywordScore =
    keywords.length > 0
      ? Math.round((matchedKeywords.length / keywords.length) * 100)
      : 0;

  const evidenceScore = Math.round(
    average(
      result.matchItems.map(
        (item) => EVIDENCE_WEIGHT[item.evidenceStrength]
      )
    )
  );

  const bullets = [
    ...resume.workExperience.flatMap((work) => work.bullets),
    ...resume.projectExperience.flatMap((project) => project.bullets),
  ].map(getBulletText).filter(Boolean);
  const measurableScore =
    bullets.length > 0
      ? Math.round(
          (bullets.filter((bullet) => hasMetric(bullet)).length /
            bullets.length) *
            100
        )
      : 0;

  const checks = completenessChecks(resume);
  const completenessScore = Math.round(
    (checks.filter(Boolean).length / checks.length) * 100
  );

  const weakEvidence = result.matchItems
    .filter(
      (item) =>
        item.evidenceStrength === "weak" ||
        item.evidenceStrength === "none"
    )
    .map((item) => item.jdRequirement);

  const suggestions: string[] = [];
  if (keywordScore < 70) {
    suggestions.push("优先补充确实掌握但尚未写入简历的 JD 关键词。");
  }
  if (evidenceScore < 70) {
    suggestions.push("为薄弱匹配项补充可核验的项目、职责或结果证据。");
  }
  if (measurableScore < 50) {
    suggestions.push("为成果描述补充规模、效率、收入、用户量或周期等数据。");
  }
  if (completenessScore < 100) {
    suggestions.push("补齐联系方式、经历、技能或教育等基础栏目。");
  }
  if (suggestions.length === 0) {
    suggestions.push("内容结构完整，导出前再核对事实、日期和联系方式。");
  }

  return {
    overallScore: Math.round(
      keywordScore * 0.4 +
        evidenceScore * 0.3 +
        measurableScore * 0.2 +
        completenessScore * 0.1
    ),
    keywordScore,
    evidenceScore,
    measurableScore,
    completenessScore,
    matchedKeywords,
    missingKeywords,
    weakEvidence,
    suggestions,
  };
}
