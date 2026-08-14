import { readSourceCatalogContent, SourceCatalogError } from "@/lib/studio/source-catalog.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const sourcePath = new URL(request.url).searchParams.get("path")?.trim();
    if (!sourcePath) return Response.json({ error: "缺少文件路径" }, { status: 400 });
    return Response.json(await readSourceCatalogContent(sourcePath));
  } catch (error) {
    const status = error instanceof SourceCatalogError ? error.status : 500;
    return Response.json({ error: error instanceof Error ? error.message : "无法读取底层文件" }, { status });
  }
}

