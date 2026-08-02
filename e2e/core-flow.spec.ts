import { expect, test, type Page } from "@playwright/test";

const resume = {
  personalInfo: { name: "张明", email: "ming@example.com", phone: "13800000000", location: "上海" },
  jobIntent: "产品经理",
  summary: "五年企业服务产品经验，专注数据产品和流程效率。",
  coreSkills: ["需求分析", "数据驱动"],
  workExperience: [{ company: "示例科技", role: "产品经理", period: "2021 - 至今", bullets: ["主导库存流程重构，效率提升 40%"] }],
  projectExperience: [{ name: "经营分析平台", role: "产品负责人", period: "2022", bullets: ["覆盖 20 家客户，月活 200 人"] }],
  skillsAndTools: ["Figma", "SQL"],
  education: { school: "示例大学", degree: "本科", period: "2015 - 2019" },
};

const layoutDefaults = {
  fontFamily: "microsoft-yahei",
  baseFontSize: 10.5,
  lineHeight: 1.45,
  sectionSpacing: 14,
  pageMargin: 16,
  accentColor: "#334155",
  bulletStyle: "disc",
  sectionOrder: ["jobIntent", "summary", "coreSkills", "workExperience", "projectExperience", "skillsAndTools", "education"],
  hiddenSections: [],
};

function stateFor(templateId = "ats-classic") {
  const document = {
    schemaVersion: 4,
    id: "e2e-document",
    title: "产品经理版本",
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    userInput: {
      targetRole: "产品经理", industry: "企业服务", companyType: "中型公司", jobStage: "社招-中级",
      highlightSkills: "需求分析", jobDescription: "负责企业服务产品规划", originalResume: "原始简历", additionalInfo: "",
    },
    currentStep: "final-resume",
    analysisResult: {
      jdAnalysis: { responsibilities: [], hardRequirements: [], implicitRequirements: [], keywords: ["产品规划"], idealCandidate: "", coreCompetencies: [] },
      diagnosis: { overallScore: 80, dimensionScores: [], mainIssues: [], prioritySuggestions: [] },
      matchItems: [], followUpQuestions: [], optimizedItems: [], finalResume: resume,
      interviewPrep: { likelyQuestions: [], evidenceToPrepare: [], possibleExaggerations: [], dataToSupplement: [], selfIntroduction: "" },
    },
    sourceResume: resume,
    importMetadata: null,
    layoutConfig: { ...layoutDefaults, templateId },
    optimizeStyle: "ai-product",
    isFinalResumeStale: false,
    hasManualEdits: false,
  };
  return { state: { schemaVersion: 4, documents: [document], activeDocumentId: document.id, careerEvidence: [] }, version: 4 };
}

async function seed(page: Page, templateId = "ats-classic") {
  await page.addInitScript((value) => localStorage.setItem("resume-expert-library", JSON.stringify(value)), stateFor(templateId));
}

test("loads example data and keeps an evidence item after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "使用示例数据" }).click();
  await expect(page.getByLabel("目标岗位")).toHaveValue("AI 产品经理");

  await page.getByRole("button", { name: /经历证据库/ }).click();
  await page.getByRole("button", { name: "手工添加" }).click();
  await page.getByPlaceholder("如：库存盘点流程重构").fill("客户上线提效");
  await page.getByPlaceholder("写清做了什么、范围和结果；不确定的数据先不要写").fill("推动 10 家客户按期上线，交付周期缩短 20%");
  await page.getByRole("button", { name: "确认并保存" }).click();
  await expect(page.getByText("客户上线提效")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /经历证据库/ }).click();
  await expect(page.getByText("客户上线提效")).toBeVisible();
});

for (const templateId of ["ats-classic", "modern-clean", "compact-professional"]) {
  test(`renders A4 ${templateId}`, async ({ page }) => {
    await seed(page, templateId);
    await page.goto("/print?documentId=e2e-document");
    await expect(page.locator(".resume-document")).toBeVisible();
    await expect(page.locator(".resume-document")).toHaveScreenshot(`${templateId}-a4.png`, { animations: "disabled" });
  });
}
