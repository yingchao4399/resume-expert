import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { runMockInterviewAnalysis } from "../src/services/ai/interviewAgent.mock";
import type { CareerEvidence, ResumeBullet, ResumeLibraryState } from "../src/types/resume";

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

function stateFor(templateId = "ats-classic", finalResumeStatus: "draft" | "confirmed" | "stale" = "confirmed") {
  const document = {
    schemaVersion: 7,
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
      matchItems: [], followUpQuestions: [], optimizedItems: [], finalResume: structuredClone(resume),
      interviewPrep: { likelyQuestions: [], evidenceToPrepare: [], possibleExaggerations: [], dataToSupplement: [], selfIntroduction: "" },
    },
    materialRevision: 0,
    analysisRevision: 0,
    sourceResume: structuredClone(resume),
    importMetadata: null,
    layoutConfig: { ...layoutDefaults, templateId },
    optimizeStyle: "ai-product",
    finalResumeStatus,
    hasManualEdits: false,
  } as ResumeLibraryState["documents"][number];
  return { state: { schemaVersion: 8, documents: [document], activeDocumentId: document.id, careerEvidence: [] as CareerEvidence[], jobApplications: [], interviewReviews: [] } satisfies ResumeLibraryState, version: 8 };
}

async function seed(page: Page, templateId = "ats-classic") {
  await page.addInitScript((value) => { if (!localStorage.getItem("resume-expert-library")) localStorage.setItem("resume-expert-library", JSON.stringify(value)); }, stateFor(templateId));
}

async function waitForLibraryHydration(page: Page) {
  await expect(page.locator('select[aria-label]').first()).toBeEnabled();
}

test("enables the developer studio and switches between product and workflow views", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.getByText("开发者工作台尚未开启")).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "AI 设置" }).click();
  await page.getByLabel("高级功能：开发者工作台").check();
  await page.getByRole("button", { name: "保存配置" }).click();
  await page.getByRole("link", { name: "开发者工作台" }).click();
  await expect(page.getByRole("heading", { name: "可视化工作流" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "可视化工作流" })).toBeVisible();
  await page.getByRole("link", { name: "简历助手" }).click();
  await expect(page.getByRole("heading", { name: "简历专家" })).toBeVisible();
});

test("tests, publishes, restores and rolls back a workflow version", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("resume-expert-studio-enabled", "true"));
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: "可视化工作流" })).toBeVisible();
  const analysisNode = page.locator('.react-flow__node[data-id="analysis"]');
  await expect(analysisNode).toBeVisible();
  await analysisNode.click();
  await page.getByLabel("节点说明").fill("解析 JD、诊断匹配、证据缺口与回归风险");
  await page.getByRole("button", { name: "测试草稿" }).click();
  await expect(page.getByText(/结构校验和 Mock 测评通过/)).toBeVisible();
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect(page.getByText("生产版本 v2 已发布。")).toBeVisible();
  await page.reload();
  await expect(page.getByText("v2", { exact: true }).first()).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "回滚到此版本" }).last().click();
  await expect(page.getByText("已回滚并发布生产版本 v3。")).toBeVisible();
});

test("shows Flowise safety guidance and confirms a Mock draft into evidence", async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => localStorage.setItem("resume-expert-studio-enabled", "true"));
  await page.goto("/studio");
  await page.getByRole("button", { name: "Flowise 实验室" }).click();
  await expect(page.getByRole("heading", { name: "Flowise 实验室" })).toBeVisible();
  await expect(page.getByText("安全审计未通过。", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "运行实验" }).click();
  await expect(page.getByText("事实草稿")).toBeVisible();
  await page.getByRole("button", { name: "确认进入证据库（候选）" }).click();
  await expect(page.getByText("独立候选事实已进入证据库", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "简历助手" }).click();
  await page.getByRole("button", { name: /经历证据库/ }).click();
  await expect(page.getByRole("heading", { name: "个人经历事实与能力库" })).toBeVisible();
});

test("loads example data and keeps an evidence item after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "使用示例数据" }).click();
  await expect(page.getByLabel("目标岗位")).toHaveValue("AI 产品经理");

  await page.getByRole("button", { name: /经历证据库/ }).click();
  await page.getByRole("button", { name: "新增经历" }).click();
  await page.getByText("名称").locator("..").getByRole("textbox").fill("客户上线提效");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("客户上线提效")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /经历证据库/ }).click();
  await expect(page.getByText("客户上线提效")).toBeVisible();
});

test("persists a job application linked to the selected resume", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await page.getByRole("button", { name: /投递与进展/ }).click();
  await page.getByRole("button", { name: "新增投递" }).click();
  await page.getByLabel("公司").fill("未来科技");
  await page.getByLabel("岗位").fill("高级产品经理");
  await page.getByRole("button", { name: "保存投递" }).click();
  await expect(page.getByText("未来科技 · 高级产品经理")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /投递与进展/ }).click();
  await expect(page.getByText("未来科技 · 高级产品经理")).toBeVisible();
});

test("keeps creation pending until the final resume is generated", async ({ page }) => {
  const analysis = stateFor().state.documents[0].analysisResult;
  await page.route("**/api/analyze", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: analysis, mode: "mock" }) }));
  await page.route("**/api/finalize", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ finalResume: resume, mode: "mock" }) }));
  await page.goto("/");
  await page.getByRole("button", { name: "使用示例数据" }).click();
  await page.getByRole("button", { name: "开始分析", exact: true }).click();
  await expect(page.getByText("最终简历尚未生成确认")).toBeVisible();
  await page.getByRole("button", { name: /AI 优化 3\.1/ }).click();
  await page.getByRole("button", { name: "确认并生成最终简历" }).click();
  await expect(page.getByRole("heading", { name: "最终简历" })).toBeVisible();
});

test("locks the old analysis after JD changes and unlocks after reanalysis", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await page.getByRole("button", { name: /岗位与简历材料 1\.1/ }).click();
  await page.getByLabel("目标 JD").fill("新的岗位要求：负责可信 AI 产品");
  await expect(page.getByText(/旧分析仍可查看/)).toBeVisible();
  await expect(page.getByRole("button", { name: /AI 优化 3\.1/ })).toBeDisabled();
  await page.getByRole("button", { name: /JD 解析 2\.1/ }).click();
  await expect(page.getByText(/修改材料前的旧分析/)).toBeVisible();
});

test("shows candidate evidence links and requires explicit confirmation", async ({ page }) => {
  const value = stateFor();
  value.state.careerEvidence = [{
    id: "evidence-1", type: "achievement", title: "库存流程重构", organization: "示例科技", role: "产品经理", period: "2021",
    description: "主导库存流程重构，效率提升 40%", metrics: ["40%"], skills: ["库存流程"], status: "confirmed", sourceType: "manual", sourceDocumentId: null, sourceReference: null,
    createdAt: "2026-08-03T00:00:00.000Z", updatedAt: "2026-08-03T00:00:00.000Z",
  } as CareerEvidence];
  value.state.documents[0].analysisResult!.finalResume.workExperience[0].bullets = [{
    id: "bullet-1", text: "主导库存流程重构，效率提升 40%", sourceType: "ai-generated", evidenceIds: ["evidence-1"],
    evidenceLinks: [{ evidenceId: "evidence-1", status: "candidate", method: "suggested", sourceReference: null }], originalText: "", aiText: "主导库存流程重构，效率提升 40%", manualText: "",
  } as ResumeBullet];
  await page.addInitScript((seedValue) => localStorage.setItem("resume-expert-library", JSON.stringify(seedValue)), value);
  await page.goto("/");
  await expect(page.getByText("候选", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "确认关联" }).click();
  await expect(page.getByText("已确认", { exact: true })).toBeVisible();
});

test("migrates legacy evidence into the projectized career library", async ({ page }) => {
  const value = stateFor();
  value.state.careerEvidence = [{
    id: "legacy-claim", type: "project", title: "库存项目", organization: "示例科技", role: "产品经理", period: "2025",
    description: "独立完成库存盘点流程", metrics: [], skills: ["流程设计"], status: "confirmed", sourceType: "manual", sourceDocumentId: null, sourceReference: null,
    createdAt: "2026-08-03T00:00:00.000Z", updatedAt: "2026-08-03T00:00:00.000Z",
  } as CareerEvidence];
  await page.addInitScript((seedValue) => localStorage.setItem("resume-expert-library", JSON.stringify(seedValue)), value);
  await page.goto("/");
  await page.getByRole("button", { name: /经历证据库/ }).click();
  await expect(page.getByRole("heading", { name: "个人经历事实与能力库" })).toBeVisible();
  await expect(page.getByText("库存项目", { exact: true })).toBeVisible();
  await expect(page.getByText("待确认", { exact: true }).first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /经历证据库/ }).click();
  await expect(page.getByText("库存项目", { exact: true })).toBeVisible();
});

test("creates a career project, fact, metric and capability", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await page.getByRole("button", { name: /经历证据库/ }).click();
  await page.getByRole("button", { name: "新增经历" }).click();
  await page.getByText("名称").locator("..").getByRole("textbox").fill("指标体系项目");
  await page.getByText("组织/公司").locator("..").getByRole("textbox").fill("示例科技");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("tab", { name: "事实" }).click();
  await page.getByText("最小可核验事实").locator("..").getByRole("textbox").fill("独立完成指标口径设计");
  await page.getByRole("button", { name: "添加已确认事实" }).click();
  await page.getByLabel("指标值").fill("20");
  await page.getByLabel("指标单位").fill("项");
  await page.getByLabel("统计方法").fill("验收清单统计");
  await page.getByLabel("指标来源").fill("项目验收报告");
  await page.getByRole("button", { name: "添加指标" }).click();
  await page.getByRole("tab", { name: "能力" }).click();
  await page.getByText("能力名称").locator("..").getByRole("textbox").fill("数据产品");
  await page.getByRole("button", { name: "新增能力" }).click();
  await expect(page.getByText("数据产品", { exact: true })).toBeVisible();
});

test("mock career interview keeps user wording and enters fact review", async ({ page }) => {
  await seed(page);
  await page.route("**/api/career/interview", async (route) => {
    const input = route.request().postDataJSON() as { sessionId: string; background: string; round: number };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        turn: {
          runId: `career-e2e-${input.sessionId}`,
          round: input.round,
          coverage: { responsibility: false, action: true, result: false, metric: false, decision: false },
          claimDrafts: [{ id: "draft-e2e-1", kind: "action", text: input.background, contribution: "independent", complexity: "routine", hasTradeoff: false, hasMethodReuse: false, sourceQuote: input.background, sourceRound: input.round, status: "candidate" }],
          metricDrafts: [], capabilitySuggestions: [], nextQuestions: [], shouldFinish: true, finishReason: "sufficient", reviewWarnings: [],
        },
        mode: "mock",
      }),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /经历证据库/ }).click();
  await page.getByRole("tab", { name: "项目梳理" }).click();
  await page.getByText("经历/项目名称").locator("..").getByRole("textbox").fill("访谈项目");
  await page.getByText("现有背景与已知事实").locator("..").getByRole("textbox").fill("我独立完成需求梳理和原型设计");
  await page.getByRole("button", { name: "开始项目梳理" }).click();
  await expect(page.getByText("我独立完成需求梳理和原型设计", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "确认事实" }).first().click();
  await page.getByRole("tab", { name: "事实" }).click();
  await expect(page.getByText("我独立完成需求梳理和原型设计", { exact: true })).toBeVisible();
});

test("uses the same deterministic ATS score in sidebar and delivery", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  const sidebarScore = await page.getByTestId("sidebar-ats-score").innerText();
  await page.getByRole("button", { name: /ATS 与导出 4\.2/ }).click();
  const exportScore = await page.getByTestId("export-ats-score").innerText();
  expect(sidebarScore.replace("/100", "").trim()).toBe(exportScore.trim());
});

test("asks before leaving a manually edited resume draft", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await page.getByRole("button", { name: "编辑简历" }).click();
  await page.getByLabel("姓名").fill("未保存姓名");
  let dialogMessage = "";
  page.once("dialog", async (dialog) => { dialogMessage = dialog.message(); await dialog.dismiss(); });
  await page.getByRole("button", { name: /面试准备/ }).click();
  await expect(page.getByRole("heading", { name: "最终简历" })).toBeVisible();
  expect(dialogMessage).toContain("未保存修改");
});

for (const fixture of ["chinese-cid-resume.pdf", "chinese-ttf-resume.pdf", "chinese-resume.docx", "multi-page-resume.pdf"]) {
  test(`extracts Chinese text from ${fixture}`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "导入 PDF / DOCX" }).click();
    await page.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "e2e", "fixtures", fixture));
    const dialog = page.getByRole("dialog", { name: "导入已有简历" });
    await expect(dialog.locator("textarea").first()).toHaveValue(/张明/, { timeout: 20_000 });
    if (fixture === "multi-page-resume.pdf") await expect(dialog.locator("textarea").first()).toHaveValue(/第 2 页/);
  });
}

test("preserves corrupt browser data in recovery mode", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("resume-expert-library", "{broken-json"));
  await page.goto("/");
  await expect(page.getByText(/检测到损坏或非法的本地数据/)).toBeVisible();
  await expect(page.getByRole("button", { name: "下载异常数据" })).toBeVisible();
});

test("supports recording range playback and deletion", async ({ request }) => {
  const audio = Buffer.from("ID3fixture-audio-content");
  const upload = await request.post("/api/interview-recording/upload", {
    multipart: { file: { name: "fixture.mp3", mimeType: "audio/mpeg", buffer: audio } },
  });
  expect(upload.ok()).toBeTruthy();
  const { id } = await upload.json() as { id: string };
  const range = await request.get(`/api/interview-recording/${id}`, { headers: { Range: "bytes=3-9" } });
  expect(range.status()).toBe(206);
  expect(range.headers()["content-range"]).toContain("bytes 3-9/");
  expect((await range.body()).length).toBe(7);
  expect((await request.delete(`/api/interview-recording/${id}`)).ok()).toBeTruthy();
  expect((await request.get(`/api/interview-recording/${id}`)).status()).toBe(404);
});

test("persists, reopens and deletes an interview review", async ({ page }) => {
  await seed(page);
  const result = await runMockInterviewAnalysis("原始简历", "产品经理");
  await page.route("**/api/interview-recording/analyze", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result, mode: "mock" }),
    })
  );

  await page.goto("/");
  await waitForLibraryHydration(page);
  await page.getByRole("button", { name: /对话诊断/ }).click();
  await page.getByRole("button", { name: "使用示例对话" }).click();
  await page.getByRole("button", { name: "开始 AI 诊断分析" }).click();
  await expect(page.getByText("已保存复盘记录")).toBeVisible();
  await expect(page.getByText("面试摘要总结")).toBeVisible();

  await page.reload();
  await waitForLibraryHydration(page);
  await page.getByRole("button", { name: /对话诊断/ }).click();
  await expect(page.getByText("已保存复盘记录")).toBeVisible();
  await page.getByRole("button", { name: /未关联投递.*分/ }).click();
  await expect(page.getByText("面试摘要总结")).toBeVisible();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.getByText("已保存复盘记录")).toBeHidden();
});

test("rejects invalid AI connection settings without calling a provider", async ({ request }) => {
  const response = await request.post("/api/ai/test", { data: { provider: "deepseek", baseUrl: "bad-url", model: "deepseek-chat", apiKey: "sk-abcdef1234567890", useMock: false } });
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toContain("Base URL");
});

test("exports a DOCX that can be imported again", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await page.getByRole("button", { name: /ATS 与导出 4\.2/ }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 DOCX" }).click();
  const download = await downloadPromise;
  const exportPath = path.join(process.cwd(), "test-results", "v1.6-export.docx");
  await download.saveAs(exportPath);
  expect((await fs.promises.stat(exportPath)).size).toBeGreaterThan(5_000);

  await page.getByRole("button", { name: /岗位与简历材料 1\.1/ }).click();
  await page.getByRole("button", { name: "导入 PDF / DOCX" }).click();
  await page.locator('input[type="file"]').setInputFiles(exportPath);
  await expect(page.getByRole("dialog", { name: "导入已有简历" }).locator("textarea").first()).toHaveValue(/张明/, { timeout: 20_000 });
});

test("prints with one 16 mm margin and no empty multi-page output", async ({ page }) => {
  await seed(page);
  await page.goto("/print?documentId=e2e-document");
  await expect(page.locator(".resume-document")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const singlePageBuffer = await page.pdf({ printBackground: true, preferCSSPageSize: true });
  await fs.promises.writeFile(path.join(process.cwd(), "test-results", "print-16mm-single.pdf"), singlePageBuffer);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const singlePagePdf = await pdfjs.getDocument({ data: new Uint8Array(singlePageBuffer) }).promise;
  expect(singlePagePdf.numPages).toBe(1);
  const firstContent = await (await singlePagePdf.getPage(1)).getTextContent();
  const textItems = firstContent.items.filter((item): item is Extract<(typeof firstContent.items)[number], { str: string }> => "str" in item && Boolean(item.str.trim()));
  const minimumX = Math.min(...textItems.map((item) => item.transform[4]));
  expect(minimumX).toBeGreaterThan(44);
  expect(minimumX).toBeLessThan(47);
  expect(textItems.map((item) => item.str).join(" ")).not.toContain("AI 设置");

  const multiPageState = stateFor();
  multiPageState.state.documents[0].analysisResult!.finalResume.workExperience = Array.from({ length: 24 }, (_, index) => ({
    company: `示例科技 ${index + 1}`,
    role: "产品经理",
    period: "2021 - 至今",
    bullets: [`主导第 ${index + 1} 个流程重构项目，效率提升 40%`],
  }));
  await page.evaluate((value) => localStorage.setItem("resume-expert-library", JSON.stringify(value)), multiPageState);
  await page.reload();
  await expect(page.locator(".resume-document")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const multiPageBuffer = await page.pdf({ printBackground: true, preferCSSPageSize: true });
  await fs.promises.writeFile(path.join(process.cwd(), "test-results", "print-16mm-multi.pdf"), multiPageBuffer);
  const multiPagePdf = await pdfjs.getDocument({ data: new Uint8Array(multiPageBuffer) }).promise;
  expect(multiPagePdf.numPages).toBeGreaterThan(1);
  for (let pageNumber = 1; pageNumber <= multiPagePdf.numPages; pageNumber += 1) {
    const content = await (await multiPagePdf.getPage(pageNumber)).getTextContent();
    expect(content.items.some((item) => "str" in item && Boolean(item.str.trim()))).toBeTruthy();
    if (pageNumber === 1) {
      expect(content.items.some((item) => "str" in item && item.str.includes("工作经历"))).toBeTruthy();
    }
  }
});

for (const templateId of ["ats-classic", "modern-clean", "compact-professional"]) {
  test(`renders A4 ${templateId}`, async ({ page }) => {
    test.skip(process.platform !== "win32", "Pixel baselines are generated with Windows Chinese fonts.");
    await seed(page, templateId);
    await page.goto("/print?documentId=e2e-document");
    await expect(page.locator(".resume-document")).toBeVisible();
    await expect(page.locator(".resume-document")).toHaveScreenshot(`${templateId}-a4.png`, { animations: "disabled" });
  });
}
