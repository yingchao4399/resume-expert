import { createEmptyDocument } from "@/store/resume-store-document";
import { buildJDAnalysisDocument, confirmJDAnalysisDocument, confirmSafeRequirements, parseJDSourceSpans } from "@/lib/jd/decision-map";
import type { FinalResume, ResumeDocument } from "@/types/resume";

export function syntheticLibraryDocument(id = "library-synthetic"): ResumeDocument {
  const document = createEmptyDocument(id);
  const finalResume: FinalResume = {
    personalInfo: { name: "合成候选人", email: "demo@example.com", phone: "", location: "上海" },
    jobIntent: "产品经理", summary: "仅用于自动化测试的合成简历。", coreSkills: ["需求分析", "产品规划"],
    workExperience: [{ company: "合成公司", role: "产品经理", period: "2024—2025", bullets: ["梳理合成项目的用户需求，输出需求文档。"] }],
    projectExperience: [], skillsAndTools: ["Figma"], education: { school: "合成大学", degree: "本科", period: "2020—2024" },
  };
  const sourceText = "必须负责产品规划";
  const spans = parseJDSourceSpans(sourceText);
  const jd = confirmJDAnalysisDocument(confirmSafeRequirements(buildJDAnalysisDocument({ sourceText, materialRevision: 0, spans,
    drafts: spans.map(span => ({ sourceSpanId: span.id, sourceQuote: span.text, normalizedText: span.text, kind: "task", modality: "required", priority: "high", priorityBasis: ["原文明示"] })) })));
  return { ...document, title: "合成产品经理简历", jobTargetContext: { ...document.jobTargetContext, companyName: "合成公司" },
    currentStep: "final-resume", userInput: { ...document.userInput, targetRole: "产品经理", jobDescription: jd.sourceText, originalResume: "合成候选人，合成公司产品经理，负责需求分析和产品规划。" },
    jdAnalysisDocument: jd, analysisBasis: { materialRevision: 0, jdAnalysisRevision: jd.revision }, analysisRevision: 0, finalResumeStatus: "confirmed",
    analysisResult: {
      jdAnalysis: { responsibilities: [], hardRequirements: [], implicitRequirements: [], keywords: ["产品规划"], idealCandidate: "", coreCompetencies: [] },
      diagnosis: { overallScore: 0, dimensionScores: [], mainIssues: [], prioritySuggestions: [] }, matchItems: [], followUpQuestions: [], optimizedItems: [], finalResume,
      interviewPrep: { likelyQuestions: [], evidenceToPrepare: [], possibleExaggerations: [], dataToSupplement: [], selfIntroduction: "" },
    },
  };
}
