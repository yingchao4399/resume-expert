import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playwrightBin = require.resolve("@playwright/test/cli");
const child = spawn(process.execPath, [playwrightBin, "test", "e2e/local-dev-smoke.spec.ts"], {
  stdio: "inherit",
  env: { ...process.env, PLAYWRIGHT_BASE_URL: process.env.RESUME_EXPERT_URL ?? "http://127.0.0.1:3000" },
});
child.on("exit", (code) => process.exit(code ?? 1));
