import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { PROMPT_REGISTRY, registeredSourcePaths } from "@/lib/studio/prompt-registry";
import type { SourceCatalogContent, SourceCatalogEntry, SourceCatalogKind, SourceGitStatus } from "@/lib/studio/prompt-types";

const execFileAsync = promisify(execFile);
const EXCLUDED_DIRECTORIES = new Set([".git", ".next", "node_modules", "coverage", "playwright-report", "test-results", ".cache", ".flowise"]);
const MAX_SOURCE_BYTES = 2_000_000;

export async function listSourceCatalog(projectRoot = process.cwd()): Promise<SourceCatalogEntry[]> {
  const root = await fs.realpath(projectRoot);
  const markdownPaths = await findMarkdownFiles(root);
  const sourcePaths = [...registeredSourcePaths()];
  const relativePaths = [...new Set([...markdownPaths, ...sourcePaths])].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const gitStatuses = await readGitStatuses(root, relativePaths);
  const entries = await Promise.all(relativePaths.map(async (relativePath) => {
    try {
      const absolutePath = await resolveAllowedSource(root, relativePath, new Set(relativePaths));
      const [stat, content] = await Promise.all([fs.stat(absolutePath), fs.readFile(absolutePath)]);
      return {
        path: normalizeRelative(relativePath),
        name: path.basename(relativePath),
        kind: sourceKind(relativePath),
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        hash: sha256(content),
        gitStatus: gitStatuses.get(normalizeRelative(relativePath)) ?? "unknown",
        promptIds: PROMPT_REGISTRY.filter((item) => item.sourceRefs.some((sourceRef) => sourceRef.path === normalizeRelative(relativePath))).map((item) => item.id),
      } satisfies SourceCatalogEntry;
    } catch {
      return null;
    }
  }));
  return entries.filter((entry): entry is SourceCatalogEntry => entry !== null);
}

export async function readSourceCatalogContent(relativePath: string, projectRoot = process.cwd()): Promise<SourceCatalogContent> {
  const root = await fs.realpath(projectRoot);
  const catalog = await listSourceCatalog(root);
  const entry = catalog.find((item) => item.path === normalizeRelative(relativePath));
  if (!entry) throw new SourceCatalogError("文件不在只读目录允许范围内", 403);
  if (entry.size > MAX_SOURCE_BYTES) throw new SourceCatalogError("文件超过 2MB，不能在浏览器中打开", 413);
  const absolutePath = await resolveAllowedSource(root, entry.path, new Set(catalog.map((item) => item.path)));
  return { entry, content: await fs.readFile(absolutePath, "utf8") };
}

export class SourceCatalogError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "SourceCatalogError";
  }
}

async function findMarkdownFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) await visit(path.join(directory, entry.name));
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        results.push(normalizeRelative(path.relative(root, path.join(directory, entry.name))));
      }
    }
  }
  await visit(root);
  return results;
}

async function resolveAllowedSource(root: string, relativePath: string, allowedPaths: Set<string>): Promise<string> {
  const normalized = normalizeRelative(relativePath);
  if (!normalized || path.isAbsolute(relativePath) || normalized.startsWith("../") || !allowedPaths.has(normalized)) {
    throw new SourceCatalogError("非法文件路径", 400);
  }
  const absolutePath = path.resolve(root, normalized);
  const realPath = await fs.realpath(absolutePath);
  if (realPath !== root && !realPath.startsWith(`${root}${path.sep}`)) throw new SourceCatalogError("文件路径越出项目目录", 403);
  return realPath;
}

function sourceKind(relativePath: string): SourceCatalogKind {
  const normalized = normalizeRelative(relativePath);
  if (normalized.toLowerCase().endsWith(".md")) return "markdown";
  const refs = PROMPT_REGISTRY.flatMap((item) => item.sourceRefs).filter((item) => item.path === normalized);
  if (refs.some((item) => item.kind === "output-schema")) return "schema-source";
  if (refs.some((item) => item.kind === "model-policy")) return "model-policy";
  return "prompt-source";
}

async function readGitStatuses(root: string, relativePaths: string[]): Promise<Map<string, SourceGitStatus>> {
  const result = new Map<string, SourceGitStatus>();
  try {
    const [{ stdout: trackedOutput }, { stdout: statusOutput }] = await Promise.all([
      execFileAsync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 10_000_000 }),
      execFileAsync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: root, encoding: "utf8", maxBuffer: 10_000_000 }),
    ]);
    const tracked = new Set(trackedOutput.split("\0").filter(Boolean).map(normalizeRelative));
    for (const relativePath of relativePaths) result.set(normalizeRelative(relativePath), tracked.has(normalizeRelative(relativePath)) ? "tracked" : "untracked");
    for (const record of statusOutput.split("\0").filter(Boolean)) {
      const code = record.slice(0, 2);
      const file = normalizeRelative(record.slice(3));
      result.set(file, code === "??" ? "untracked" : "modified");
    }
  } catch {
    for (const relativePath of relativePaths) result.set(normalizeRelative(relativePath), "unknown");
  }
  return result;
}

function normalizeRelative(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
