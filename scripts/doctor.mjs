import process from "node:process";

const baseUrl = process.env.RESUME_EXPERT_URL ?? "http://127.0.0.1:3000";
const checks = [];
const record = (name, ok, detail) => checks.push({ name, ok, detail });

const major = Number(process.versions.node.split(".")[0]);
record("Node.js 24", major === 24, `当前 ${process.versions.node}`);

try {
  const response = await fetch(baseUrl, { headers: { Origin: baseUrl }, signal: AbortSignal.timeout(10_000) });
  const html = await response.text();
  record("首页", response.ok, `HTTP ${response.status}`);
  const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+\.js[^"']*)["']/g)]
    .map((match) => match[1])
    .filter((path) => path.startsWith("/_next/"))
    .map((path) => new URL(path, baseUrl).href);
  const uniqueScripts = [...new Set(scripts)];
  const assets = await Promise.all(uniqueScripts.map(async (url) => {
    const asset = await fetch(url, { headers: { Origin: baseUrl }, signal: AbortSignal.timeout(10_000) });
    return asset.ok;
  }));
  record("前端脚本", uniqueScripts.length > 0 && assets.every(Boolean), `${assets.filter(Boolean).length}/${uniqueScripts.length} 可访问`);
  for (const route of ["/api/ai/status", "/api/ai/config"]) {
    const api = await fetch(new URL(route, baseUrl), { signal: AbortSignal.timeout(10_000) });
    const body = await api.text();
    const leaksCredential = /"(?:apiKey|authorization|password|credential)"\s*:/i.test(body);
    record(route, api.ok && !leaksCredential, `HTTP ${api.status}${leaksCredential ? "，响应疑似包含凭证字段" : ""}`);
  }

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
    const storageOK = await page.evaluate(() => {
      const key = "resume-expert-doctor";
      localStorage.setItem(key, "ok");
      const result = localStorage.getItem(key) === "ok";
      localStorage.removeItem(key);
      return result && typeof indexedDB !== "undefined";
    });
    record("浏览器存储", storageOK, storageOK ? "localStorage 与 IndexedDB 可用" : "站点存储不可用");
    await browser.close();
  } catch (error) {
    record("浏览器存储", false, error instanceof Error ? error.message : "无法启动浏览器检查");
  }
} catch (error) {
  record("本机服务", false, error instanceof Error ? error.message : "无法连接");
}

for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
if (checks.some((check) => !check.ok)) {
  console.error(`\n诊断未通过。请先运行 npm run app:local，再重新执行 npm run doctor。`);
  process.exitCode = 1;
}
