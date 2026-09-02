import { spawn } from "node:child_process";
import process from "node:process";

const url = "http://127.0.0.1:3000";
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
  const html = await response.text();
  if (response.ok && html.includes("简历专家") && html.includes("/_next/")) {
    console.log(`简历专家已在 ${url} 运行。`);
    process.exit(0);
  }
  console.error(`3000 端口已被其他或不完整的服务占用，请先关闭该进程。`);
  process.exit(1);
} catch { /* Start a new local process below. */ }

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npmCommand, ["run", "dev"], { stdio: "inherit", env: process.env });
child.on("error", (error) => { console.error(`启动失败：${error.message}`); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 0; });
