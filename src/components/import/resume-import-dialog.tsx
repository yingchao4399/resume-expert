"use client";

import { useRef, useState } from "react";
import { AlertTriangle, FileUp, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ResumeEditor } from "@/components/resume/resume-editor";
import { extractResumeText, type ExtractedResumeText } from "@/lib/import/resume-import";
import { structureImportedResume } from "@/services/ai/resumeAgent";
import type { FinalResume, ResumeImportMetadata } from "@/types/resume";

interface ResumeImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    text: string,
    sourceResume: FinalResume | null,
    metadata: ResumeImportMetadata
  ) => void;
}

export function ResumeImportDialog({ open, onOpenChange, onConfirm }: ResumeImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [extracted, setExtracted] = useState<ExtractedResumeText | null>(null);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<FinalResume | null>(null);
  const [loading, setLoading] = useState(false);
  const [structuring, setStructuring] = useState(false);
  const [mode, setMode] = useState<"mock" | "llm" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setExtracted(null);
    setText("");
    setDraft(null);
    setMode(null);
    setError(null);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setDraft(null);
    try {
      const result = await extractResumeText(file);
      setExtracted(result);
      setText(result.text);
    } catch (nextError) {
      setExtracted(null);
      setText("");
      setError(nextError instanceof Error ? nextError.message : "文件解析失败");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleStructure = async () => {
    if (text.trim().length < 20) return;
    setStructuring(true);
    setError(null);
    try {
      const result = await structureImportedResume(text);
      setDraft(result.finalResume);
      setMode(result.mode);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "AI 整理失败");
    } finally {
      setStructuring(false);
    }
  };

  const handleConfirm = () => {
    if (!extracted || text.trim().length < 20) return;
    onConfirm(text.trim(), draft, {
      sourceType: extracted.fileType,
      fileName: extracted.fileName,
      importedAt: new Date().toISOString(),
      warnings: extracted.warnings,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>导入已有简历</DialogTitle>
          <DialogDescription>
            PDF/DOCX 只在当前浏览器提取文字；仅点击“AI 整理”后，文本才会发送给已配置的模型服务商。
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />

        {!extracted ? (
          <button
            type="button"
            className="flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-600 hover:bg-neutral-100"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
          >
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
            <span>{loading ? "正在本地提取文字…" : "选择 PDF 或 DOCX（最大 10 MB）"}</span>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-neutral-50 px-3 py-2 text-xs">
              <span>{extracted.fileName}</span>
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                更换文件
              </Button>
            </div>

            {extracted.warnings.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <div className="mb-1 flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" /> 提取提示
                </div>
                {extracted.warnings.slice(0, 5).map((warning) => <p key={warning}>{warning}</p>)}
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">提取原文</p>
                <Button variant="outline" size="sm" disabled={structuring || text.trim().length < 20} onClick={handleStructure}>
                  {structuring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {structuring ? "整理中…" : "AI 整理结构"}
                </Button>
              </div>
              <Textarea className="min-h-56 font-mono text-xs leading-relaxed" value={text} onChange={(event) => setText(event.target.value)} />
            </div>

            {draft && (
              <div className="rounded-lg border p-4">
                <div className="mb-4">
                  <p className="text-sm font-medium">结构化结果</p>
                  <p className="text-xs text-neutral-500">
                    {mode === "mock" ? "当前为 Mock，本地仅整理基础信息；请人工补充后确认。" : "请核对所有事实，保存后作为当前岗位版本的源简历。"}
                  </p>
                </div>
                <ResumeEditor value={draft} onChange={setDraft} />
              </div>
            )}
          </div>
        )}

        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!extracted || text.trim().length < 20 || loading || structuring} onClick={handleConfirm}>
            确认导入
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
