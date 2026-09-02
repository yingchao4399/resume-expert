import { test, expect } from "@playwright/test";
import { createEmptyDocument } from "../src/store/resume-store-document";
import { buildJDAnalysisDocument, confirmJDAnalysisDocument, confirmSafeRequirements, parseJDSourceSpans } from "../src/lib/jd/decision-map";

function legacy56() {
  const document = createEmptyDocument("jd-56-synthetic");
  const text = Array.from({ length: 56 }, (_, i) => `必须完成第${Math.floor(i / 2) + 1}号测试任务`).join("\n");
  const spans = parseJDSourceSpans(text);
  const map = confirmJDAnalysisDocument(confirmSafeRequirements(buildJDAnalysisDocument({ sourceText: text, materialRevision: 1, spans,
    drafts: spans.map(span => ({ sourceSpanId: span.id, sourceQuote: span.text, normalizedText: span.text, kind: "task", modality: "required", priority: "high", priorityBasis: ["合成原文"] })) })));
  document.schemaVersion = 11;
  document.userInput = { ...document.userInput, targetRole: "合成产品岗位", jobDescription: text, originalResume: "合成材料：曾协助完成测试任务，无额外业绩声明。" };
  document.jdAnalysisDocument = { ...map, schemaVersion: 1 };
  document.materialRevision = 1;
  document.currentStep = "jd-analysis";
  return { version: 12, state: { schemaVersion: 12, activeDocumentId: document.id, documents: [document], careerEvidence: [], jobApplications: [], interviewReviews: [] } };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(value => { if (!localStorage.getItem("resume-expert-library")) localStorage.setItem("resume-expert-library", JSON.stringify(value)); }, legacy56());
  await page.route("**/api/analyze/**", route => route.continue({ headers: { ...route.request().headers(), "X-Workflow-Provider": "mock" } }));
  await page.route("**/api/interview/prepare/stream", route => route.continue({ headers: { ...route.request().headers(), "X-Workflow-Provider": "mock" } }));
});

test("migrates 56 requirements, previews and reverts merges, then matches the full map", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await expect(page.getByText(/独立细则 56 条/)).toBeVisible();
  await page.getByRole("button", { name: "重新整理需求", exact: true }).click();
  await expect(page.getByRole("heading", { name: "原要求 → 合并结果" })).toBeVisible();
  await expect(page.getByText(/56 条 → 28 条独立细则/)).toBeVisible();
  const firstMerge = page.getByRole("checkbox", { name: /采用此项合并/ }).first();
  await firstMerge.uncheck();
  await expect(page.getByText(/56 条 → 29 条独立细则/)).toBeVisible();
  await firstMerge.check();
  await page.getByRole("button", { name: "应用选中整理结果" }).click();
  await expect(page.getByText(/独立细则 28 条/)).toBeVisible();
  await expect(page.getByRole("button", { name: "匹配真实经历", exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByText(/独立细则 28 条/)).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "恢复整理前地图" }).click();
  await expect(page.getByText(/独立细则 56 条/)).toBeVisible();
  await page.getByRole("button", { name: "确认需求地图", exact: true }).click();
  await page.getByRole("button", { name: "匹配真实经历", exact: true }).click();
  await expect(page.getByRole("heading", { name: "岗位准备情况", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /面试准备/ }).click();
  await page.getByRole("button", { name: "生成面试策略", exact: true }).click();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("resume-expert-library")!).state.documents[0].analysisResult.interviewPrep.requirementStrategies?.length)).toBe(56);
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("resume-expert-library")!));
  expect(saved.version).toBe(16);
  expect(saved.state.archives).toEqual([]);
  expect(saved.state.documents[0].schemaVersion).toBe(14);
  expect(saved.state.documents[0].jdAnalysisDocument.schemaVersion).toBe(3);
  expect(saved.state.documents[0].analysisResult.matchItems).toHaveLength(56);
});

test("cancels a pending consolidation without overwriting the original map", async ({ page }) => {
  await page.route("**/api/analyze/consolidate/stream", async route => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "合成失败" }) }).catch(() => {});
  });
  await page.goto("/");
  await page.getByRole("button", { name: "重新整理需求", exact: true }).click();
  await page.getByRole("button", { name: "取消整理", exact: true }).click();
  await expect(page.getByText("整理已取消，原地图未改变。")).toBeVisible();
  await expect(page.getByText(/独立细则 56 条/)).toBeVisible();
  await expect(page.getByRole("button", { name: "匹配真实经历", exact: true })).toBeEnabled();
});
