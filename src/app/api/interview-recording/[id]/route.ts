import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { parseByteRange } from "@/lib/recordings";

const UPLOAD_DIR = path.join(process.cwd(), "data", "recordings");
const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac",
  ".ogg": "audio/ogg", ".webm": "audio/webm", ".flac": "audio/flac", ".amr": "audio/amr",
};

function findRecording(id: string): string | null {
  if (!/^rec-[a-zA-Z0-9-]+$/.test(id) || !fs.existsSync(UPLOAD_DIR)) return null;
  const name = fs.readdirSync(UPLOAD_DIR).find((entry) => entry.startsWith(`${id}.`));
  return name ? path.join(UPLOAD_DIR, name) : null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const filePath = findRecording(id);
  if (!filePath) return NextResponse.json({ error: "录音不存在" }, { status: 404 });
  const stat = fs.statSync(filePath);
  const mime = MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
  const range = request.headers.get("range");
  let start = 0;
  let end = stat.size - 1;
  let status = 200;
  if (range) {
    const parsed = parseByteRange(range, stat.size);
    if (!parsed) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    ({ start, end } = parsed);
    status = 206;
  }
  const stream = fs.createReadStream(filePath, { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Type": mime,
      "Content-Length": String(end - start + 1),
      ...(status === 206 ? { "Content-Range": `bytes ${start}-${end}/${stat.size}` } : {}),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const filePath = findRecording(id);
  if (!filePath) return NextResponse.json({ error: "录音不存在" }, { status: 404 });
  fs.unlinkSync(filePath);
  return NextResponse.json({ deleted: true, id });
}
