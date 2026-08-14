import { listSourceCatalog, SourceCatalogError } from "@/lib/studio/source-catalog.server";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ sources: await listSourceCatalog() });
  } catch (error) {
    const status = error instanceof SourceCatalogError ? error.status : 500;
    return Response.json({ error: error instanceof Error ? error.message : "无法读取底层文件目录" }, { status });
  }
}
