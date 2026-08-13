const baseUrl = (process.env.RESUME_EXPERT_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

async function fetchChecked(url, origin) {
  const response = await fetch(url, {
    headers: origin ? { Origin: origin, Referer: `${origin}/` } : undefined,
  });
  if (!response.ok) {
    throw new Error(`${url} 返回 HTTP ${response.status}`);
  }
  return response;
}

const homepage = await fetchChecked(`${baseUrl}/`);
const html = await homepage.text();
const scriptPaths = [...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)]
  .map((match) => match[1])
  .filter((path) => path.startsWith("/_next/"));

if (!scriptPaths.length) {
  throw new Error("首页未发现任何 Next.js 脚本，页面可能只返回了未激活的 HTML");
}

const failures = [];
for (const path of [...new Set(scriptPaths)]) {
  try {
    await fetchChecked(new URL(path, baseUrl).toString(), baseUrl);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

if (failures.length) {
  throw new Error(`本地页面未完成激活：\n${failures.join("\n")}`);
}

console.log(`本地页面验证通过：${baseUrl}/（${new Set(scriptPaths).size} 个关键脚本）`);
