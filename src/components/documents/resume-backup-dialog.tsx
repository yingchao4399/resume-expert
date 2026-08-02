"use client";

import { useRef, useState } from "react";
import { Download, FileJson, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  downloadResumeBackup,
  readResumeBackup,
  type ResumeBackup,
} from "@/lib/backup/resume-backup";
import { useResumeStore } from "@/store/resume-store";

interface ResumeBackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResumeBackupDialog({ open, onOpenChange }: ResumeBackupDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { documents, activeDocumentId, careerEvidence, jobApplications, interviewReviews, importDocuments } = useResumeStore();
  const [pending, setPending] = useState<ResumeBackup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = documents.find((document) => document.id === activeDocumentId) ?? documents[0];

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      setPending(await readResumeBackup(file));
    } catch (nextError) {
      setPending(null);
      setError(nextError instanceof Error ? nextError.message : "备份读取失败");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const finishImport = (mode: "merge" | "replace") => {
    if (!pending) return;
    importDocuments(pending.documents, mode, pending.careerEvidence, pending.jobApplications, pending.interviewReviews);
    setPending(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>备份与恢复</DialogTitle>
          <DialogDescription>
            JSON 仅包含简历业务数据，不包含 API Key、录音、加载状态或本地缓存。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" disabled={!active} onClick={() => active && downloadResumeBackup([active], careerEvidence.filter((item) => item.sourceDocumentId === null || item.sourceDocumentId === active.id), jobApplications.filter((item) => item.resumeDocumentId === active.id), interviewReviews.filter((item) => item.resumeDocumentId === active.id), "resume-expert-current.json")}>
            <Download className="h-4 w-4" /> 导出当前版本
          </Button>
          <Button variant="outline" onClick={() => downloadResumeBackup(documents, careerEvidence, jobApplications, interviewReviews)}>
            <FileJson className="h-4 w-4" /> 导出全部版本
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <Button variant="outline" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" /> 读取 JSON 备份
        </Button>

        {pending && (
          <div className="space-y-3 rounded-md border bg-neutral-50 p-3 text-sm">
            <p>已验证 {pending.documents.length} 份简历、{pending.careerEvidence.length} 条证据、{pending.jobApplications.length} 条投递和 {pending.interviewReviews.length} 条复盘，导出时间：{new Date(pending.exportedAt).toLocaleString("zh-CN")}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => finishImport("merge")}>合并为副本</Button>
              <Button variant="destructive" onClick={() => finishImport("replace")}>替换当前文档库</Button>
            </div>
          </div>
        )}

        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      </DialogContent>
    </Dialog>
  );
}
