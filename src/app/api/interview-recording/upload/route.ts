import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "data", "recordings");
const MAX_SIZE = 100 * 1024 * 1024; // 100MB

// 允许的音频扩展名
const ALLOWED_EXT = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm", ".flac", ".amr"];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "未收到文件" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "文件过大，最大支持 100MB" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json(
        { error: `不支持的格式 ${ext}，支持：${ALLOWED_EXT.join(", ")}` },
        { status: 400 }
      );
    }

    // 确保目录存在
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    // 生成唯一 id 与文件名
    const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const safeName = file.name.replace(/[^\w.-]/g, "_");
    const storedName = `${id}${ext}`;
    const filePath = path.join(UPLOAD_DIR, storedName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      id,
      fileName: safeName,
      fileSize: file.size,
      storedName,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[upload]", error);
    return NextResponse.json(
      { error: `上传失败：${error instanceof Error ? error.message : "未知错误"}` },
      { status: 500 }
    );
  }
}

// 列出已上传录音
export async function GET() {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      return NextResponse.json({ recordings: [] });
    }
    const files = fs.readdirSync(UPLOAD_DIR);
    const stats = files.map((name) => {
      const filePath = path.join(UPLOAD_DIR, name);
      const stat = fs.statSync(filePath);
      return {
        id: name.replace(/\.[^.]+$/, ""),
        storedName: name,
        fileSize: stat.size,
        uploadedAt: stat.mtime.toISOString(),
      };
    });
    return NextResponse.json({ recordings: stats });
  } catch (error) {
    return NextResponse.json(
      { error: `读取列表失败：${error instanceof Error ? error.message : ""}` },
      { status: 500 }
    );
  }
}
