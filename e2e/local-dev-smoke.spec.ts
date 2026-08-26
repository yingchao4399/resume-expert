import { expect, test } from "@playwright/test";

test("local dev page hydrates with examples, company types, and AI settings", async ({ page }) => {
  const assetFailures: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/_next/") && response.status() >= 400) {
      assetFailures.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/");
  await page.locator("#companyType").click();
  await expect(page.getByRole("option")).toHaveText(["大厂", "中型公司", "创业公司", "外企", "国企"]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "使用示例数据" }).click();
  await expect(page.getByLabel("目标岗位")).toHaveValue("AI 产品经理");
  await expect(page.getByRole("button", { name: "生成 JD 需求地图" })).toBeEnabled();
  await page.getByRole("button", { name: "AI 设置" }).click();
  await expect(page.getByRole("dialog", { name: "AI 模型设置" })).toBeVisible();
  expect(assetFailures).toEqual([]);
});
