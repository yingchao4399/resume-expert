import fs from "node:fs/promises";
import path from "node:path";

const RESOURCE_DIRECTORIES = {
  cmaps: "cmaps",
  "standard-fonts": "standard_fonts",
} as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ resource: string; file: string }> }
) {
  const { resource, file } = await context.params;
  const directory = RESOURCE_DIRECTORIES[resource as keyof typeof RESOURCE_DIRECTORIES];
  if (!directory || path.basename(file) !== file || !/^[\w.-]+$/.test(file)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const data = await fs.readFile(path.join(process.cwd(), "node_modules", "pdfjs-dist", directory, file));
    return new Response(data, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
