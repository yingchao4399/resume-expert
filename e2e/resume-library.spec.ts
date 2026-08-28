import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { syntheticLibraryDocument } from "../src/test-fixtures/library";
import { createEmptyDocument } from "../src/store/resume-store-document";
import { createArchive } from "../src/lib/library/resume-archives";

function seed() {
  const document = syntheticLibraryDocument();
  const other = createEmptyDocument("other-draft");
  other.title = "运营草稿"; other.userInput.targetRole = "运营";
  return { version: 13, state: { schemaVersion: 13, documents: [document, other], activeDocumentId: document.id, careerEvidence: [], jobApplications: [], interviewReviews: [] } };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(value => { if (!localStorage.getItem("resume-expert-library")) localStorage.setItem("resume-expert-library", JSON.stringify(value)); }, seed());
});

test("lists existing versions without switching, archives a finished resume and restores after refresh", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("link", { name: "我的简历库", exact: true }).click();
  await expect(page).toHaveURL(/\/library$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "我的简历库" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByLabel("搜索简历").fill("运营");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "查看", exact: true }).click();
  await expect(page.getByText("此版本还没有已确认的最终简历，以下为材料记录。")).toBeVisible();
  await expect(page.getByLabel("当前简历版本", { exact: true })).toHaveValue("library-synthetic");
  await page.getByRole("button", { name: "关闭对话框" }).click();
  await page.getByLabel("搜索简历").fill("");
  const card = page.getByRole("article", { name: "合成产品经理简历", exact: true });
  await card.getByRole("button", { name: "存档当前成品" }).click();
  await page.getByLabel("存档名称", { exact: true }).fill("投递留底第一版");
  await page.getByLabel("备注（可选）").fill("仅合成数据");
  await page.getByRole("button", { name: "确认存档", exact: true }).click();
  await expect(page.getByText("存档已保存到当前浏览器。")).toBeVisible();
  await page.getByRole("link", { name: "查看存档", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "投递留底第一版" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "投递留底第一版" })).toBeVisible();
  await page.getByRole("button", { name: "关闭对话框" }).click();
  await page.getByRole("tab", { name: /岗位版本/ }).click();
  await card.getByRole("button", { name: "存档当前成品" }).click();
  await page.getByRole("button", { name: "确认存档", exact: true }).click();
  await expect(page.getByText("已有相同内容的存档，未重复保存。")).toBeVisible();
  await page.getByRole("button", { name: "关闭对话框" }).click();
  await page.getByRole("tab", { name: /历史存档/ }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.screenshot({ path: "output/playwright/v1.11.0-library.png", fullPage: true });
  await page.getByRole("button", { name: "复制为新草稿" }).click();
  await expect(page.getByText(/已复制为新草稿，请重新核验材料/)).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(3);
});

test("downloads immutable A4 archives after source deletion, including dated PDF and Word", async ({ page }) => {
  test.setTimeout(180_000);
  const archive = createArchive(syntheticLibraryDocument(), "历史下载测试", "", "2026-01-02T00:00:00.000Z");
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "我的简历库" })).toBeVisible();
  await page.evaluate(archive => { const data = JSON.parse(localStorage.getItem("resume-expert-library")!); data.state.archives = [archive]; data.state.documents = data.state.documents.filter((item: { id: string }) => item.id !== archive.sourceDocumentId); data.state.activeDocumentId = "other-draft"; localStorage.setItem("resume-expert-library", JSON.stringify(data)); }, archive);
  await page.goto(`/print?archiveId=${archive.id}`);
  await expect(page.getByText(/来源版本已删除或不在当前文档库中/)).toBeVisible();
  await expect(page.getByRole("button", { name: "下载 ATS PDF" })).toBeEnabled({ timeout: 30_000 });
  const pageCount = await page.locator("[data-pdf-page]").count();
  expect(pageCount).toBeGreaterThan(0);
  for (const name of ["下载 ATS PDF", "下载视觉 PDF", "下载 Word"]) {
    const promise = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const download = await promise;
    expect(download.suggestedFilename()).toContain("20260102");
    const bytes = fs.readFileSync((await download.path())!);
    if (name.includes("PDF")) expect((await PDFDocument.load(bytes)).getPageCount()).toBe(pageCount);
    else {
      const zip = await JSZip.loadAsync(bytes);
      const xml = await zip.file("word/document.xml")!.async("string");
      expect(xml).toContain("合成候选人");
      expect((xml.match(/w:type="page"/g) ?? []).length).toBe(pageCount - 1);
    }
  }
  await page.goto("/print?documentId=missing");
  await expect(page.locator("main").getByRole("alert")).toContainText("不存在");
  await expect(page.locator("[data-pdf-page]")).toHaveCount(0);
  await page.goto("/print?archiveId=missing");
  await expect(page.locator("main").getByRole("alert")).toContainText("不存在");
});

test("protects unsaved final edits when entering the library", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "编辑简历", exact: true }).click();
  const nameInput = page.getByLabel("姓名", { exact: true });
  await nameInput.fill("未保存合成人名");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("link", { name: "我的简历库", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(nameInput).toHaveValue("未保存合成人名");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("link", { name: "我的简历库", exact: true }).click();
  await expect(page).toHaveURL(/\/library$/);
});

test("reports quota failure without creating a phantom archive", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("article", { name: "合成产品经理简历", exact: true }).getByRole("button", { name: "存档当前成品" }).click();
  await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === "resume-expert-library") throw new DOMException("quota", "QuotaExceededError"); original.call(this, key, value); }; });
  await page.getByRole("button", { name: "确认存档", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("未生效");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("resume-expert-library")!).state.archives)).toEqual([]);
});

test("keeps a running task on cancelled navigation and aborts it before entering the library", async ({ page }) => {
  let release: (() => void) | undefined;
  await page.route("**/api/interview/prepare/stream", async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.abort().catch(() => undefined);
  });
  try {
    await page.goto("/");
    await page.getByRole("button", { name: /面试准备 2/ }).click();
    const request = page.waitForRequest("**/api/interview/prepare/stream");
    await page.getByRole("button", { name: "生成面试策略", exact: true }).click();
    await request;
    page.once("dialog", dialog => dialog.dismiss());
    await page.getByRole("link", { name: "我的简历库", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "生成中", exact: true })).toBeVisible();
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("link", { name: "我的简历库", exact: true }).click();
    await expect(page).toHaveURL(/\/library$/, { timeout: 30_000 });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("resume-expert-library")!));
    expect(stored.state.documents[0].analysisResult.interviewPrep.likelyQuestions).toEqual([]);
  } finally { release?.(); }
});

test("isolates a corrupt archive while keeping valid records visible across refresh", async ({ page }) => {
  const archive = createArchive(syntheticLibraryDocument(), "可恢复历史", "");
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "我的简历库" })).toBeVisible();
  await page.evaluate(archive => {
    const data = JSON.parse(localStorage.getItem("resume-expert-library")!);
    data.state.archives = [archive, { id: "corrupt-archive", finalResume: null }];
    localStorage.setItem("resume-expert-library", JSON.stringify(data));
  }, archive);
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByRole("tab", { name: "历史存档（1）" }).click();
  await expect(page.getByRole("article", { name: "可恢复历史" })).toBeVisible();
  const recovery = await page.evaluate(() => localStorage.getItem("resume-expert-library-recovery"));
  expect(recovery).toContain("corrupt-archive");
  await page.reload();
  await expect(page.getByRole("tab", { name: "历史存档（1）" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("resume-expert-library-recovery"))).toBe(recovery);
});

test("exports, merges and replaces V10 archives with explicit confirmation", async ({ page }) => {
  const archive = createArchive(syntheticLibraryDocument(), "备份历史", "");
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "我的简历库" })).toBeVisible();
  await page.evaluate(archive => { const data = JSON.parse(localStorage.getItem("resume-expert-library")!); data.state.archives = [archive]; localStorage.setItem("resume-expert-library", JSON.stringify(data)); }, archive);
  await page.reload();
  await page.getByRole("button", { name: "备份与恢复", exact: true }).last().click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出全部版本" }).click();
  const download = await downloadPromise;
  const file = (await download.path())!;
  const backup = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(backup.backupVersion).toBe(10); expect(backup.archives).toHaveLength(1);
  await page.getByRole("dialog").locator('input[type="file"]').setInputFiles(file);
  await page.getByRole("button", { name: "合并为副本" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "历史存档（2）" })).toBeVisible();
  await page.getByRole("button", { name: "备份与恢复", exact: true }).last().click();
  await page.getByRole("dialog").locator('input[type="file"]').setInputFiles(file);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "替换当前文档库" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "历史存档（1）" })).toBeVisible();
});
