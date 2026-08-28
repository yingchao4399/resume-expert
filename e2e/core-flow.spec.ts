import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
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

function decisionDocument(materialRevision = 0, status: "draft" | "confirmed" = "confirmed") {
  const sourceText = "任职要求\n- 必须负责企业服务产品规划";
  return {
    schemaVersion: 1 as const, sourceText, materialRevision, revision: 1, status, confirmedRevision: status === "confirmed" ? 1 : null,
    sourceSpans: [
      { id: "jd-span-heading", sectionId: null, text: "任职要求", startOffset: 0, endOffset: 4, listLevel: 0, role: "heading" as const },
      { id: "jd-span-requirement", sectionId: "jd-span-heading", text: "- 必须负责企业服务产品规划", startOffset: 5, endOffset: sourceText.length, listLevel: 1, role: "requirement" as const },
    ],
    requirements: [{ id: "req-e2e", sourceSpanId: "jd-span-requirement", sourceSpanIds: ["jd-span-requirement"], sourceQuote: "负责企业服务产品规划", normalizedText: "负责企业服务产品规划", kind: "task" as const, modality: "required" as const, priority: "high" as const, priorityBasis: ["原文包含明确必选词"], expectedBehavior: "说明真实项目", expectedOutcome: null, proficiencySignal: "unknown" as const, keywords: ["产品规划"], anchorStatus: "validated" as const, reviewStatus: status === "confirmed" ? "confirmed" as const : "auto-validated" as const, isHardGate: false, userEdited: false }],
    hypotheses: [], qualityFindings: [], createdAt: "2026-08-15T00:00:00.000Z", updatedAt: "2026-08-15T00:00:00.000Z",
  };
}

function stateFor(templateId = "ats-classic", finalResumeStatus: "draft" | "confirmed" | "stale" = "confirmed") {
  const document = {
    schemaVersion: 10,
    id: "e2e-document",
    title: "产品经理版本",
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    userInput: {
      targetRole: "产品经理", industry: "企业服务", companyType: "中型公司", jobStage: "社招-中级",
      highlightSkills: "需求分析", jobDescription: "负责企业服务产品规划", originalResume: "原始简历", additionalInfo: "",
    },
    jobTargetContext: { companyName: "", notes: "", companySnapshotId: null },
    currentStep: "final-resume",
    analysisResult: {
      jdAnalysis: { responsibilities: [], hardRequirements: [], implicitRequirements: [], keywords: ["产品规划"], idealCandidate: "", coreCompetencies: [], sourceItems: [{ id: "jd-source-1", text: "负责企业服务产品规划", startOffset: 0, endOffset: 10, classification: "requirement" }], requirements: [{ id: "req-1", sourceItemId: "jd-source-1", sourceQuote: "负责", requirement: "企业服务产品规划", category: "responsibility", priority: "must", keywords: ["产品规划"], interviewFocus: "检查项目经历", anchorStatus: "validated" }], roleInference: { items: [] }, clarificationNeeds: [] },
      diagnosis: { overallScore: 80, dimensionScores: [], mainIssues: [], prioritySuggestions: [] },
      matchItems: [], followUpQuestions: [], optimizedItems: [], finalResume: structuredClone(resume),
      interviewPrep: { likelyQuestions: [], evidenceToPrepare: [], possibleExaggerations: [], dataToSupplement: [], selfIntroduction: "" },
    },
    materialRevision: 0,
    analysisRevision: 0,
    jdAnalysisDocument: decisionDocument(0, "confirmed"),
    analysisBasis: { materialRevision: 0, jdAnalysisRevision: 1 },
    sourceResume: structuredClone(resume),
    importMetadata: null,
    layoutConfig: { ...layoutDefaults, templateId },
    optimizeStyle: "ai-product",
    finalResumeStatus,
    hasManualEdits: false,
  } as ResumeLibraryState["documents"][number];
  return { state: { schemaVersion: 10, documents: [document], archives: [], activeDocumentId: document.id, careerEvidence: [] as CareerEvidence[], jobApplications: [], interviewReviews: [] } satisfies ResumeLibraryState, version: 10 };
}

function paginationBoundaryState() {
  const state = stateFor("ats-classic");
  state.state.documents[0].analysisResult!.finalResume.workExperience = Array.from({ length: 7 }, (_, index) => ({
    company: `合成科技 ${index + 1}`,
    role: "产品经理",
    period: "2021 - 至今",
    bullets: [
      `负责第 ${index + 1} 个企业服务项目的需求分析、方案设计、跨团队协作和上线复盘，确保全部描述仅用于分页测试。`,
      "围绕用户反馈梳理业务流程并形成可核验交付记录，持续跟踪关键节点和风险。",
    ],
  }));
  state.state.documents[0].layoutConfig = { ...layoutDefaults, templateId: "ats-classic", pageMargin: 12 } as ResumeLibraryState["documents"][number]["layoutConfig"];
  return state;
}

async function seed(page: Page, templateId = "ats-classic") {
  await page.addInitScript((value) => { if (!localStorage.getItem("resume-expert-library")) localStorage.setItem("resume-expert-library", JSON.stringify(value)); }, stateFor(templateId));
}

async function waitForLibraryHydration(page: Page) {
  await expect(page.locator('select[aria-label]').first()).toBeEnabled();
}

function jdStreamBody(materialRevision = 1) {
  const document = decisionDocument(materialRevision, "draft");
  return [
    { type: "started", elapsedMs: 0 },
    { type: "stage-started", stage: "jd-draft", elapsedMs: 5, message: "生成 JD 需求地图草稿" },
    { type: "stage-completed", stage: "jd-draft", elapsedMs: 10, message: "等待人工确认" },
    { type: "completed", elapsedMs: 10, document, mode: "mock" },
  ].map((event) => JSON.stringify(event)).join("\n") + "\n";
}

function matchStreamBody(analysis: NonNullable<ResumeLibraryState["documents"][number]["analysisResult"]>) {
  return [
    { type: "started", elapsedMs: 0 },
    { type: "stage-started", stage: "fact-match", elapsedMs: 5, message: "匹配真实经历" },
    { type: "stage-completed", stage: "fact-match", elapsedMs: 10, message: "岗位准备度已完成" },
    { type: "completed", elapsedMs: 10, result: analysis, mode: "mock" },
  ].map((event) => JSON.stringify(event)).join("\n") + "\n";
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

test("audits prompt definitions, source files and full local runtime snapshots", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("resume-expert-studio-enabled", "true"));
  await page.goto("/studio");
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("resume-expert-studio", 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("traces")) request.result.createObjectStore("traces", { keyPath: "id" });
        if (!request.result.objectStoreNames.contains("workflow-workspace")) request.result.createObjectStore("workflow-workspace");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = new Date().toISOString();
    const transaction = db.transaction("traces", "readwrite");
    transaction.objectStore("traces").put({ schemaVersion: 2, id: "prompt-e2e-trace", status: "success", createdAt: now, updatedAt: now, spans: [{ id: "prompt-e2e-span", nodeId: "analyze", label: "岗位分析", status: "success", mode: "llm", provider: "deepseek", model: "deepseek-v4-flash", startedAt: now, finishedAt: now, latencyMs: 10, input: {}, output: {}, promptSnapshots: [{ schemaVersion: 1, id: "snapshot-e2e", invocationId: "invocation-e2e", traceId: "prompt-e2e-trace", promptId: "resume.deep-jd", promptVersion: "deep-jd-v2", attempt: 1, attemptKind: "primary", status: "success", createdAt: now, finishedAt: now, provider: "deepseek", model: "deepseek-v4-flash", structuredOutputStrategy: "json-object", responseFormat: '{"type":"json_object"}', schemaName: "deep_jd_requirement_map", schemaContract: "{}", schemaHash: "schema-hash", promptHash: "prompt-hash", baseSystemPrompt: "system", runtimeUserPrompt: "sensitive user prompt", sentSystemPrompt: "system with schema", sentUserPrompt: "sensitive user prompt", temperature: 0.2, maxTokens: 12000, timeoutMs: 90000, validationIssues: [] }] }] });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
  });
  await page.getByRole("button", { name: "提示词与设定" }).click();
  await expect(page.getByRole("heading", { name: "提示词与设定" })).toBeVisible();
  await expect(page.getByText("深度 JD 解析", { exact: true }).first()).toBeVisible();
  await page.getByText("深度 JD 解析", { exact: true }).first().click();
  await expect(page.getByText("resume.deep-jd", { exact: true }).last()).toBeVisible();
  const sourceLoaded = page.waitForResponse(response => response.url().includes("/api/studio/sources/content?") && response.url().includes("jd-prompts.ts"));
  await page.getByRole("button", { name: /src\/lib\/ai\/jd-prompts.ts/ }).click();
  expect((await sourceLoaded).ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "src/lib/ai/jd-prompts.ts", exact: true })).toBeVisible();
  const markdownLoaded = page.waitForResponse(response => response.url().includes("/api/studio/sources/content?") && response.url().includes("README.md"));
  await page.getByRole("button", { name: /README.md/ }).first().click();
  expect((await markdownLoaded).ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "README.md" })).toBeVisible();
  await expect(page.getByRole("button", { name: "查看原文" })).toBeVisible();
  await page.getByRole("tab", { name: "运行快照" }).click();
  await expect(page.getByText(/resume\.deep-jd · primary · deepseek\/deepseek-v4-flash/)).toBeVisible();
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
  await expect(page.locator("#companyType")).toContainText("中型公司");
  await page.locator("#companyType").click();
  await expect(page.getByRole("option")).toHaveText(["大厂", "中型公司", "创业公司", "外企", "国企"]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "使用示例数据" }).click();
  await expect(page.getByLabel("目标岗位")).toHaveValue("AI 产品经理");
  await expect(page.getByText("示例材料已载入，下一步点击“生成 JD 需求地图”。")).toBeVisible();

  await page.getByRole("button", { name: /经历证据库/ }).click();
  await page.getByRole("button", { name: "新增经历" }).click();
  await page.getByText("名称").locator("..").getByRole("textbox").fill("客户上线提效");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("客户上线提效")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /经历证据库/ }).click();
  await expect(page.getByText("客户上线提效")).toBeVisible();
});

test("opens and closes AI settings without client errors", async ({ page }) => {
  const clientErrors: string[] = [];
  page.on("pageerror", (error) => clientErrors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/_next/") && response.status() >= 400) clientErrors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "AI 设置" }).click();
  await expect(page.getByRole("dialog", { name: "AI 模型设置" })).toBeVisible();
  await page.getByRole("button", { name: "关闭对话框" }).click();
  await expect(page.getByRole("dialog", { name: "AI 模型设置" })).toBeHidden();
  expect(clientErrors).toEqual([]);
});

test("asks before replacing existing materials with example data", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("目标岗位").fill("已有岗位");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "使用示例数据" }).click();
  await expect(page.getByLabel("目标岗位")).toHaveValue("已有岗位");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "使用示例数据" }).click();
  await expect(page.getByLabel("目标岗位")).toHaveValue("AI 产品经理");
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
  await page.route("**/api/analyze/stream", (route) => route.fulfill({ status: 200, contentType: "application/x-ndjson", body: jdStreamBody() }));
  await page.route("**/api/analyze/match/stream", (route) => route.fulfill({ status: 200, contentType: "application/x-ndjson", body: matchStreamBody(analysis!) }));
  await page.route("**/api/optimize", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      mode: "mock",
      optimizedItems: [{ id: "opt-e2e", section: "职业摘要", before: "原摘要", after: "优化摘要", reason: "对齐岗位", riskWarning: "核对事实" }],
    }),
  }));
  await page.route("**/api/finalize", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ finalResume: resume, mode: "mock" }) }));
  await page.goto("/");
  await page.getByRole("button", { name: "使用示例数据" }).click();
  await page.getByRole("button", { name: "生成 JD 需求地图", exact: true }).click();
  await page.getByRole("button", { name: "批量确认安全项" }).click();
  await page.getByRole("button", { name: "确认需求地图" }).click();
  await page.getByRole("button", { name: "匹配真实经历", exact: true }).click();
  await expect(page.getByText("最终简历尚未生成确认")).toBeVisible();
  await page.getByRole("button", { name: /AI 优化 3\.1/ }).click();
  await page.getByRole("button", { name: "生成优化方案" }).click();
  await page.getByRole("button", { name: "重新生成最终简历", exact: true }).click();
  await expect(page.getByRole("heading", { name: "最终简历" })).toBeVisible();
});

test("streams analysis progress, cancels actively and recovers after refresh", async ({ page }) => {
  let analysisCalls = 0;
  await page.route("**/api/analyze/stream", async (route) => {
    analysisCalls += 1;
    if (analysisCalls <= 2) {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: jdStreamBody() }).catch(() => undefined);
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: jdStreamBody() });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "使用示例数据" }).click();

  await page.getByRole("button", { name: "生成 JD 需求地图", exact: true }).click();
  await expect(page.getByRole("button", { name: "取消分析" })).toBeVisible();
  await expect(page.getByText("正在启动深度分析", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "取消分析" }).click();
  await expect(page.getByText(/分析已取消/)).toBeVisible();
  await expect(page.getByRole("button", { name: "生成 JD 需求地图", exact: true })).toBeEnabled();

  await page.getByRole("button", { name: "生成 JD 需求地图", exact: true }).click();
  await expect(page.getByRole("button", { name: "取消分析" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "生成 JD 需求地图", exact: true })).toBeEnabled();

  await page.getByRole("button", { name: "生成 JD 需求地图", exact: true }).click();
  await expect(page.getByRole("heading", { name: "JD 决策地图" })).toBeVisible();
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

test("stores target company context and shows the requirement map", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await page.getByRole("button", { name: /岗位与简历材料 1\.1/ }).click();
  await page.getByLabel("目标公司名称（可选）").fill("示例目标公司");
  await page.getByLabel("岗位背景补充（可选）").fill("已知该岗位负责企业服务业务线，团队配置仍待确认");
  await expect(page.getByText(/旧分析仍可查看/)).toBeVisible();
  await page.getByRole("button", { name: /JD 解析 2\.1/ }).click();
  await expect(page.getByRole("heading", { name: "JD 决策地图" })).toBeVisible();
  await expect(page.getByText(/材料已变化，这张需求地图只能查看/)).toBeVisible();
  await page.locator("details").filter({ has: page.getByText("负责企业服务产品规划", { exact: true }) }).first().locator("summary").click();
  await expect(page.getByText("负责企业服务产品规划", { exact: true }).first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /岗位与简历材料 1\.1/ }).click();
  await expect(page.getByLabel("目标公司名称（可选）")).toHaveValue("示例目标公司");
});

test("opens targeted follow-up help and keeps placeholder examples separate", async ({ page }) => {
  const value = stateFor();
  const analysis = value.state.documents[0].analysisResult!;
  analysis.matchItems = [{ requirementId: "req-1", jdRequirement: "企业服务产品规划", evidenceClaimIds: [], resumeQuotes: [], resumeEvidence: "", matchRationale: "没有相关事实", evidenceStrength: "none", missingEvidenceTypes: ["真实项目"], needsSupplement: true, optimizationSuggestion: "补充真实项目" }];
  analysis.followUpQuestions = [{ id: "fu-1", requirementId: "req-1", question: "请说明一个真实规划项目", purpose: "补充规划证据", thinkingPrompts: ["业务目标是什么？"], answerFramework: ["场景", "行动", "结果"], honestNoExperience: "如实说明没有直接经历。", placeholderExample: "", userAnswer: "", generatedBullet: "" }];
  value.state.documents[0].currentStep = "match";
  await page.addInitScript((seedValue) => localStorage.setItem("resume-expert-library", JSON.stringify(seedValue)), value);
  await page.route("**/api/follow-up/guidance", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ example: "在【你的项目】中采取【具体行动】，按【指标口径】核对【真实结果】。", mode: "mock" }) }));
  await page.goto("/");
  await page.getByRole("button", { name: "针对该要求补证" }).click();
  await expect(page.getByText("请说明一个真实规划项目")).toBeVisible();
  await expect(page.getByRole("button", { name: "收起回答帮助" })).toBeVisible();
  await expect(page.getByText("业务目标是什么？")).toBeVisible();
  await page.getByRole("button", { name: "生成占位符示范" }).click();
  await expect(page.getByText(/虚构结构示范/)).toBeVisible();
  await expect(page.getByLabel("你的回答")).toHaveValue("");
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

test("generates interview strategy on demand without blocking quick analysis", async ({ page }) => {
  await seed(page);
  const prep = {
    likelyQuestions: [{ requirementId: "req-1", question: "如何规划企业服务产品？", suggestedAnswer: "只使用已确认事实作答。", evidenceNeeded: ["项目事实"] }],
    evidenceToPrepare: ["项目事实"], possibleExaggerations: ["不要扩大个人职责"], dataToSupplement: [], selfIntroduction: "这是按需生成的面试自我介绍。",
    requirementStrategies: [{ requirementId: "req-1", validationApproaches: ["追问案例"], demonstrationPoints: ["个人行动"], answerStructure: ["场景", "行动", "结果"], evidenceNeeded: ["事实"], metricsNeeded: [], exaggerationRisks: ["避免虚构"] }],
    reverseQuestions: [],
  };
  await page.route("**/api/interview/prepare/stream", (route) => route.fulfill({ status: 200, contentType: "application/x-ndjson", body: [
    { type: "started", requestId: "interview-e2e", elapsedMs: 0, remainingMs: 180000, message: "开始生成面试策略" },
    { type: "completed", requestId: "interview-e2e", elapsedMs: 20, remainingMs: 179980, interviewPrep: prep, mode: "mock" },
  ].map((event) => JSON.stringify(event)).join("\n") + "\n" }));
  await page.goto("/");
  await page.getByRole("button", { name: /面试准备/ }).click();
  await expect(page.getByText("尚未生成面试策略")).toBeVisible();
  await page.getByRole("button", { name: "生成面试策略" }).click();
  await expect(page.getByText("这是按需生成的面试自我介绍。")).toBeVisible();
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

test("refreshes account models while preserving a manual legacy model", async ({ page }) => {
  await page.route("**/api/ai/config", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ provider: "deepseek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", mode: "llm", useMock: false, hasApiKey: true, invalidApiKey: false, apiKeyMasked: "sk-ab...1234", apiKeySource: "user" }) });
      return;
    }
    await route.continue();
  });
  await page.route("**/api/ai/models", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ provider: "deepseek", models: [{ id: "deepseek-v4-flash", source: "official" }, { id: "account-chat", source: "account" }], refreshedAt: new Date().toISOString() }) }));
  await page.goto("/");
  await page.getByRole("button", { name: "AI 设置" }).click();
  await expect(page.getByText(/deepseek-chat.*不在最新官方预设/)).toBeVisible();
  await page.getByRole("button", { name: "刷新可用模型" }).click();
  await expect(page.getByText(/1 个账号模型/)).toBeVisible();
  await expect(page.getByLabel("手动模型 ID")).toHaveValue("deepseek-chat");
});

test("shows actionable guidance and saves nothing after repeated structure errors", async ({ page }) => {
  await seed(page);
  await page.route("**/api/career/interview", async (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "所选 deepseek / deepseek-v4-flash 连续两次未返回合格结构。不合格字段：claimDrafts: 必填。本次未保存会话、事实或指标。", code: "MODEL_STRUCTURE_INVALID" }) }));
  await page.goto("/");
  await page.getByRole("button", { name: /经历证据库/ }).click();
  await page.getByRole("tab", { name: "项目梳理" }).click();
  await page.getByText("经历/项目名称").locator("..").getByRole("textbox").fill("AI 简历平台");
  await page.getByText("现有背景与已知事实").locator("..").getByRole("textbox").fill("系统学习过心理学，做了一个 AI 简历平台");
  await page.getByRole("button", { name: "开始项目梳理" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "项目梳理未写入任何数据" })).toContainText("本次未保存会话、事实或指标");
  await expect(page.getByRole("button", { name: "重新尝试" })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开 AI 设置" })).toBeVisible();
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

test("downloads searchable ATS and visual A4 PDFs", async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript((value) => localStorage.setItem("resume-expert-library", JSON.stringify(value)), paginationBoundaryState());
  await page.goto("/");
  await page.getByRole("button", { name: /ATS 与导出 4\.2/ }).click();
  const paginationPreview = page.locator(".resume-paginated-view").last();
  await expect(paginationPreview).toHaveAttribute("data-pagination-status", "ready");
  const expectedPageCount = Number(await paginationPreview.getAttribute("data-page-count"));
  expect(expectedPageCount).toBeGreaterThan(1);

  const docxDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 DOCX" }).click();
  const docxDownload = await docxDownloadPromise;
  const docxPath = path.join(process.cwd(), "test-results", "v1.10-pagination.docx");
  await docxDownload.saveAs(docxPath);
  const docxArchive = await JSZip.loadAsync(await fs.promises.readFile(docxPath));
  const documentXml = await docxArchive.file("word/document.xml")!.async("string");
  expect(documentXml.match(/w:pageBreakBefore/g) ?? []).toHaveLength(expectedPageCount - 1);

  const atsDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 ATS 文字版" }).click();
  const atsDownload = await atsDownloadPromise;
  expect(atsDownload.suggestedFilename()).toMatch(/^张明-产品经理-\d{8}-ATS\.pdf$/);
  const atsPath = path.join(process.cwd(), "test-results", "v1.10-ats.pdf");
  await atsDownload.saveAs(atsPath);

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const atsBytes = new Uint8Array(await fs.promises.readFile(atsPath));
  const atsPdf = await pdfjs.getDocument({ data: atsBytes }).promise;
  expect(atsPdf.numPages).toBe(expectedPageCount);
  const atsPage = await atsPdf.getPage(1);
  const atsViewport = atsPage.getViewport({ scale: 1 });
  expect(atsViewport.width).toBeCloseTo(595.28, 1);
  expect(atsViewport.height).toBeCloseTo(841.89, 1);
  const atsText = await atsPage.getTextContent();
  expect(atsText.items.map((item) => "str" in item ? item.str : "").join(" ")).toContain("张明");

  const visualDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载视觉还原版" }).click();
  const visualDownload = await visualDownloadPromise;
  expect(visualDownload.suggestedFilename()).toMatch(/^张明-产品经理-\d{8}-视觉版\.pdf$/);
  const visualPath = path.join(process.cwd(), "test-results", "v1.10-visual.pdf");
  await visualDownload.saveAs(visualPath);
  const visualBytes = new Uint8Array(await fs.promises.readFile(visualPath));
  const visualPdf = await pdfjs.getDocument({ data: visualBytes }).promise;
  expect(visualPdf.numPages).toBe(expectedPageCount);
  const visualViewport = (await visualPdf.getPage(1)).getViewport({ scale: 1 });
  expect(visualViewport.width).toBeCloseTo(595.28, 1);
  expect(visualViewport.height).toBeCloseTo(841.89, 1);

  const previewPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "打开 A4 预览" }).click();
  const preview = await previewPromise;
  await expect(preview).toHaveURL(/\/print\?documentId=e2e-document$/);
  await expect(preview.locator(".resume-document").first()).toBeVisible();
  await expect(preview.getByRole("button", { name: "下载 ATS PDF" })).toBeEnabled();
  await expect(preview.getByRole("button", { name: "下载视觉 PDF" })).toBeEnabled();
  await expect(preview.getByRole("button", { name: "系统打印" })).toBeEnabled();
  await expect(preview.getByRole("button", { name: "返回" })).toBeEnabled();
  await expect(preview.getByRole("button", { name: "关闭窗口" })).toBeEnabled();
});

test("uses one measured A4 pagination plan in final preview and template studio", async ({ page }) => {
  await page.addInitScript((value) => localStorage.setItem("resume-expert-library", JSON.stringify(value)), paginationBoundaryState());

  await page.goto("/");
  const finalPreview = page.locator(".resume-paginated-view").first();
  await expect(finalPreview).toHaveAttribute("data-pagination-status", "ready");
  const initialPageCount = Number(await finalPreview.getAttribute("data-page-count"));
  expect(initialPageCount).toBeGreaterThan(1);

  await page.getByRole("button", { name: "模板与排版" }).click();
  const studio = page.getByRole("dialog", { name: "模板与统一排版" });
  const studioPreview = studio.locator(".resume-paginated-view");
  await expect(studioPreview).toHaveAttribute("data-pagination-status", "ready");
  await expect(studioPreview).toHaveAttribute("data-page-count", String(initialPageCount));
  await expect(studio.getByText(`共 ${initialPageCount} 页`, { exact: true })).toBeVisible();

  await studio.getByRole("button", { name: "一键适配 1 页" }).click();
  await expect(studioPreview).toHaveAttribute("data-page-count", "1", { timeout: 20_000 });
  await expect(studio.getByText("已适配为 1 页", { exact: false })).toBeVisible();
});

test("persists custom style and only finalizes a user-confirmed keyword enhancement", async ({ page }) => {
  const state = stateFor();
  state.state.documents[0].analysisResult!.optimizedItems = [{
    id: "opt-keyword-e2e", section: "职业摘要", before: "原摘要", after: "优化摘要", reason: "对齐岗位", riskWarning: "核对事实",
  }];
  await page.addInitScript((value) => { if (!localStorage.getItem("resume-expert-library")) localStorage.setItem("resume-expert-library", JSON.stringify(value)); }, state);

  let optimizeRequest: Record<string, unknown> | null = null;
  let finalizeRequest: { optimizedItems?: Array<{ after?: string }> } | null = null;
  await page.route("**/api/optimize", async (route) => {
    optimizeRequest = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "mock", optimizedItems: [{ id: "opt-keyword-e2e", section: "职业摘要", before: "原摘要", after: "优化摘要", reason: "对齐岗位", riskWarning: "核对事实" }] }) });
  });
  await page.route("**/api/optimize/keyword-enhance", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ mode: "mock", enhancements: [{
      id: "keyword-draft-e2e", itemId: "opt-keyword-e2e", selectedKeywords: ["产品规划"], enhancedText: "负责企业服务产品规划与交付", sourceAfter: "优化摘要",
      evidenceStatus: "missing", evidenceClaimIds: [], evidenceCorrectionSourceIds: [], foundEvidence: [], missingEvidence: ["缺少直接项目证据"], riskWarnings: ["请核验岗位职责边界"], adoptionStatus: "unverified", generatedAt: "2026-08-26T00:00:00.000Z", verifiedAt: null,
    }] }),
  }));
  await page.route("**/api/finalize", async (route) => {
    finalizeRequest = route.request().postDataJSON() as typeof finalizeRequest;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ finalResume: resume, mode: "mock" }) });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /AI 优化 3\.1/ }).click();
  await page.getByRole("button", { name: "自定义", exact: true }).click();
  await page.getByLabel("自定义优化风格").fill("突出平台化能力，语气稳健");
  await page.getByRole("button", { name: "应用自定义风格并生成" }).click();
  await expect.poll(() => optimizeRequest).toMatchObject({ style: "custom", customInstruction: "突出平台化能力，语气稳健" });
  await page.reload();
  await expect(page.getByLabel("自定义优化风格")).toHaveValue("突出平台化能力，语气稳健");

  await page.locator("label").filter({ hasText: "产品规划" }).click();
  await page.getByRole("button", { name: "批量 AI 增强" }).click();
  await expect(page.getByText("负责企业服务产品规划与交付", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "补正证据后采用" }).click();
  const correctionDialog = page.getByRole("dialog", { name: "补正证据后采用" });
  await correctionDialog.getByPlaceholder("例如：智能知识库项目").fill("企业服务规划项目");
  await correctionDialog.getByPlaceholder("只填写你真实做过、可以解释或验证的内容").fill("独立完成企业服务产品规划并推动交付");
  await correctionDialog.getByRole("checkbox").check();
  await correctionDialog.getByRole("button", { name: "保存真实证据并重新增强" }).click();
  await expect(correctionDialog).toBeHidden();
  await expect.poll(async () => page.evaluate(async () => {
    const request = indexedDB.open("resume-expert-career", 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const transaction = database.transaction("claims", "readonly");
    const values = await new Promise<Array<{ sourceReference?: { referenceId?: string } }>>((resolve, reject) => {
      const getAll = transaction.objectStore("claims").getAll();
      getAll.onsuccess = () => resolve(getAll.result); getAll.onerror = () => reject(getAll.error);
    });
    database.close();
    return values.some((value) => value.sourceReference?.referenceId?.startsWith("keyword-enhancement:e2e-document:opt-keyword-e2e:产品规划"));
  })).toBe(true);
  await page.getByRole("button", { name: "暂不采用" }).click();
  await expect(page.getByRole("button", { name: "重新生成最终简历" })).toBeEnabled();
  await page.getByRole("button", { name: "重新核验" }).click();
  const verificationDialog = page.getByRole("dialog", { name: "核验关键词增强稿" });
  await verificationDialog.getByRole("checkbox").check();
  await verificationDialog.getByRole("button", { name: "确认采用" }).click();
  await expect(page.getByText("已核验采用", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "重新生成最终简历" }).click();
  await expect(page.getByRole("heading", { name: "最终简历" })).toBeVisible();
  expect((finalizeRequest as unknown as { optimizedItems: Array<{ after: string }> }).optimizedItems[0].after).toBe("负责企业服务产品规划与交付");
});

test("prints with one 16 mm margin and no empty multi-page output", async ({ page }) => {
  await seed(page);
  await page.goto("/print?documentId=e2e-document");
  await expect(page.locator(".resume-document").first()).toBeVisible();
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
  await expect(page.locator(".resume-document").first()).toBeVisible();
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
    const firstA4Page = page.locator("[data-pdf-page]").first();
    await expect(firstA4Page).toBeVisible();
    await expect(firstA4Page).toHaveScreenshot(`${templateId}-a4.png`, { animations: "disabled" });
  });
}
