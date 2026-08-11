"use client";

import { useEffect, useMemo, useState } from "react";
import { ArchiveRestore, CopyPlus, FilePlus2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useResumeStore } from "@/store/resume-store";
import { ResumeBackupDialog } from "@/components/documents/resume-backup-dialog";

export function ResumeDocumentMenu() {
  const {
    documents,
    activeDocumentId,
    jobApplications,
    hasHydrated,
    createDocument,
    duplicateDocument,
    renameDocument,
    deleteDocument,
    selectDocument,
  } = useResumeStore();
  const active = useMemo(
    () => documents.find((document) => document.id === activeDocumentId),
    [activeDocumentId, documents]
  );
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [title, setTitle] = useState(active?.title ?? "");
  const referenceCount = jobApplications.filter((item) => item.resumeDocumentId === activeDocumentId).length;

  useEffect(() => {
    setTitle(active?.title ?? "");
  }, [active?.title]);

  const handleRename = () => {
    if (!title.trim()) return;
    renameDocument(title);
    setRenameOpen(false);
  };

  return (
    <>
      <div className="flex min-w-0 items-center gap-1">
        <select
          aria-label="当前简历版本"
          className="h-8 min-w-0 max-w-[220px] rounded-md border border-neutral-200 bg-white px-2 text-xs text-neutral-700 outline-none focus:ring-2 focus:ring-neutral-300"
          value={activeDocumentId}
          disabled={!hasHydrated}
          onChange={(event) => selectDocument(event.target.value)}
        >
          {documents.map((document) => (
            <option key={document.id} value={document.id}>
              {document.title}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="新建简历"
          aria-label="新建简历"
          onClick={createDocument}
        >
          <FilePlus2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden h-8 w-8 p-0 sm:inline-flex"
          title="复制当前版本"
          aria-label="复制当前版本"
          onClick={duplicateDocument}
        >
          <CopyPlus className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden h-8 w-8 p-0 sm:inline-flex"
          title="备份与恢复"
          aria-label="备份与恢复"
          onClick={() => setBackupOpen(true)}
        >
          <ArchiveRestore className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden h-8 w-8 p-0 sm:inline-flex"
          title="重命名"
          aria-label="重命名当前简历版本"
          onClick={() => setRenameOpen(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden h-8 w-8 p-0 text-red-600 hover:text-red-700 sm:inline-flex"
          title="删除当前版本"
          aria-label="删除当前简历版本"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ResumeBackupDialog open={backupOpen} onOpenChange={setBackupOpen} />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>重命名简历版本</DialogTitle>
            <DialogDescription>名称仅保存在当前浏览器中。</DialogDescription>
          </DialogHeader>
          <Input
            id="resume-version-title"
            aria-label="简历版本名称"
            value={title}
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleRename();
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              取消
            </Button>
            <Button disabled={!title.trim()} onClick={handleRename}>
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除当前简历版本？</DialogTitle>
            <DialogDescription>
              “{active?.title ?? "当前版本"}”及其分析结果会从浏览器中永久删除。{referenceCount > 0 ? `该版本正被 ${referenceCount} 条投递记录引用；确认后投递记录会保留，但简历关联将解除。` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteDocument();
                setDeleteOpen(false);
              }}
            >
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
