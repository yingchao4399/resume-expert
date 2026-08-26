import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { listSourceCatalog, readSourceCatalogContent, SourceCatalogError } from "@/lib/studio/source-catalog.server";

const roots: string[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (root.startsWith(path.join(os.tmpdir(), "resume-expert-source-"))) await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}, 15_000);

describe("studio source catalog", () => {
  it("includes tracked-style and untracked Markdown while excluding dependency folders", async () => {
    const root = await createRoot();
    await fs.mkdir(path.join(root, "prd"), { recursive: true });
    await fs.mkdir(path.join(root, "node_modules", "demo"), { recursive: true });
    await fs.writeFile(path.join(root, "README.md"), "# Read me", "utf8");
    await fs.writeFile(path.join(root, "prd", "draft.md"), "# Draft", "utf8");
    await fs.writeFile(path.join(root, "node_modules", "demo", "hidden.md"), "hidden", "utf8");
    const entries = await listSourceCatalog(root);
    expect(entries.map((entry) => entry.path)).toEqual(expect.arrayContaining(["README.md", "prd/draft.md"]));
    expect(entries.map((entry) => entry.path)).not.toContain("node_modules/demo/hidden.md");
  }, 15_000);

  it("returns source content and rejects traversal or non-catalog files", async () => {
    const root = await createRoot();
    await fs.writeFile(path.join(root, "README.md"), "<script>alert(1)</script>\n# Safe text", "utf8");
    await fs.writeFile(path.join(root, "secret.txt"), "not allowed", "utf8");
    await expect(readSourceCatalogContent("README.md", root)).resolves.toMatchObject({ content: expect.stringContaining("Safe text") });
    await expect(readSourceCatalogContent("../secret.md", root)).rejects.toBeInstanceOf(SourceCatalogError);
    await expect(readSourceCatalogContent("secret.txt", root)).rejects.toBeInstanceOf(SourceCatalogError);
  }, 15_000);
});

async function createRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "resume-expert-source-"));
  roots.push(root);
  return root;
}
