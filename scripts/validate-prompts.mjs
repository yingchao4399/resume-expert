import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const typeSource = readFileSync(resolve(root, "src/lib/studio/prompt-types.ts"), "utf8");
const registrySource = readFileSync(resolve(root, "src/lib/studio/prompt-registry.ts"), "utf8");
const callableBlock = typeSource.match(/CALLABLE_PROMPT_IDS\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1] ?? "";
const callableIds = [...callableBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
const registryIds = new Set([...registrySource.matchAll(/definition\("([^"]+)"/g)].map((match) => match[1]));
const missingDefinitions = callableIds.filter((id) => !registryIds.has(id));
if (missingDefinitions.length) throw new Error(`缺少提示词注册：${missingDefinitions.join(", ")}`);

const sourceFiles = [
  "src/services/ai/resumeAgent.llm.ts",
  "src/services/ai/interviewAgent.llm.ts",
  "src/services/ai/importResume.server.ts",
  "src/lib/career/interview.server.ts",
  "src/lib/flowise/client.server.ts",
];
for (const sourceFile of sourceFiles) {
  if (!existsSync(resolve(root, sourceFile))) throw new Error(`提示词源文件不存在：${sourceFile}`);
  const content = readFileSync(resolve(root, sourceFile), "utf8");
  for (const call of content.matchAll(/chatCompletionJSON\s*\(\s*\{([\s\S]*?)(?=\n\s*\}\))/g)) {
    const promptId = call[1].match(/promptId:\s*"([^"]+)"/)?.[1];
    if (!promptId) throw new Error(`${sourceFile} 存在未绑定 promptId 的正式 AI 调用`);
    if (!registryIds.has(promptId)) throw new Error(`${sourceFile} 使用了未注册 promptId：${promptId}`);
  }
}
console.log(`Prompt registry valid: ${callableIds.length} callable prompts.`);

