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
import { Input } from "@/components/ui/input";
import { ResumeEditor } from "@/components/resume/resume-editor";
import { extractResumeText, type ExtractedResumeText } from "@/lib/import/resume-import";
import { structureImportedResume } from "@/services/ai/resumeAgent";
import type { FinalResume, ImportedResumeProfile, ResumeImportMetadata } from "@/types/resume";

interface ResumeImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    text: string,
    sourceResume: FinalResume | null,
    metadata: ResumeImportMetadata,
    importedResume?: ImportedResumeProfile | null
  ) => void;
}

export function ResumeImportDialog({ open, onOpenChange, onConfirm }: ResumeImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [extracted, setExtracted] = useState<ExtractedResumeText | null>(null);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<FinalResume | null>(null);
  const [importedProfile, setImportedProfile] = useState<ImportedResumeProfile | null>(null);
  const [view, setView] = useState<"structured" | "unmapped" | "source">("structured");
  const [loading, setLoading] = useState(false);
  const [structuring, setStructuring] = useState(false);
  const [mode, setMode] = useState<"mock" | "llm" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setExtracted(null);
    setText("");
    setDraft(null);
    setImportedProfile(null);
    setView("structured");
    setMode(null);
    setError(null);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    setError(null);
      setDraft(null);
      setImportedProfile(null);
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
      setImportedProfile(result.importedResume ?? null);
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
    }, importedProfile ? confirmImportedProfile(importedProfile) : null);
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
              <Textarea className="min-h-56 font-mono text-xs leading-relaxed" value={text} onChange={(event) => { setText(event.target.value); if (importedProfile) setImportedProfile(markImportedProfileNeedsReview(importedProfile)); }} />
            </div>

            {draft && (
              <div className="rounded-lg border p-4">
                {importedProfile && (
                  <div className="mb-4 flex flex-wrap items-center gap-2 border-b pb-3 text-xs">
                    {(["structured", "unmapped", "source"] as const).map((tab) => (
                      <Button key={tab} type="button" size="sm" variant={view === tab ? "default" : "outline"} onClick={() => setView(tab)}>
                        {tab === "structured" ? "结构化结果" : tab === "unmapped" ? `待确认内容（${importedProfile.unmappedSegments.length}）` : "原始文本"}
                      </Button>
                    ))}
                    <span className="ml-auto text-neutral-500">
                      已识别 {importedProfile.workExperience.length + importedProfile.internshipExperience.length + importedProfile.projectExperience.length + importedProfile.educationHistory.length + importedProfile.certifications.length + importedProfile.languages.length + importedProfile.awards.length + importedProfile.links.length} 项
                    </span>
                  </div>
                )}
                {view === "source" ? (
                  <Textarea className="min-h-56 font-mono text-xs leading-relaxed" value={text} onChange={(event) => { setText(event.target.value); if (importedProfile) setImportedProfile(markImportedProfileNeedsReview(importedProfile)); }} />
                ) : view === "unmapped" && importedProfile ? (
                  <div className="space-y-2 text-sm">
                    <p className="text-xs text-neutral-500">这些片段没有被自动写入可信资料，请确认后再整理。</p>
                    {importedProfile.unmappedSegments.length ? importedProfile.unmappedSegments.map((segment) => <div key={segment.id} className="rounded border bg-amber-50 p-2">{segment.text}</div>) : <p className="text-neutral-500">没有待确认片段。</p>}
                  </div>
                ) : (
                  <>
                <div className="mb-4">
                  <p className="text-sm font-medium">结构化结果</p>
                  <p className="text-xs text-neutral-500">
                    {mode === "mock" ? "当前为 Mock，本地仅整理基础信息；请人工补充后确认。" : "请核对所有事实，保存后作为当前岗位版本的源简历。"}
                  </p>
                </div>
                    <ResumeEditor value={draft} onChange={setDraft} />
                    {importedProfile && <ImportedProfileEditor profile={importedProfile} onChange={setImportedProfile} />}
                  </>
                )}
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

function markImportedProfileNeedsReview(profile: ImportedResumeProfile): ImportedResumeProfile {
  const mark = <T extends { status: "candidate" | "confirmed" | "needs-review" }>(value: T): T => ({ ...value, status: "needs-review" });
  return {
    ...profile,
    workExperience: profile.workExperience.map((entry) => ({ ...entry, status: "needs-review", bullets: entry.bullets.map(mark) })),
    internshipExperience: profile.internshipExperience.map((entry) => ({ ...entry, status: "needs-review", bullets: entry.bullets.map(mark) })),
    projectExperience: profile.projectExperience.map((entry) => ({ ...entry, status: "needs-review", bullets: entry.bullets.map(mark) })),
    educationHistory: profile.educationHistory.map((entry) => ({ ...entry, status: "needs-review", details: entry.details.map(mark) })),
    skillsAndTools: profile.skillsAndTools.map(mark), certifications: profile.certifications.map(mark), languages: profile.languages.map(mark), awards: profile.awards.map(mark), links: profile.links.map(mark), otherSections: profile.otherSections.map(mark),
  };
}

function confirmImportedProfile(profile: ImportedResumeProfile): ImportedResumeProfile {
  const confirm = <T extends { status: "candidate" | "confirmed" | "needs-review" }>(value: T): T =>
    value.status === "needs-review" ? value : { ...value, status: "confirmed" };
  return {
    ...profile,
    workExperience: profile.workExperience.map((entry) => ({ ...confirm(entry), bullets: entry.bullets.map(confirm) })),
    internshipExperience: profile.internshipExperience.map((entry) => ({ ...confirm(entry), bullets: entry.bullets.map(confirm) })),
    projectExperience: profile.projectExperience.map((entry) => ({ ...confirm(entry), bullets: entry.bullets.map(confirm) })),
    educationHistory: profile.educationHistory.map((entry) => ({ ...confirm(entry), details: entry.details.map(confirm) })),
    skillsAndTools: profile.skillsAndTools.map(confirm),
    certifications: profile.certifications.map(confirm),
    languages: profile.languages.map(confirm),
    awards: profile.awards.map(confirm),
    links: profile.links.map(confirm),
    otherSections: profile.otherSections.map(confirm),
  };
}

type ImportedItemKey = "skillsAndTools" | "certifications" | "languages" | "awards" | "links" | "otherSections";

function ImportedProfileEditor({ profile, onChange }: { profile: ImportedResumeProfile; onChange: (profile: ImportedResumeProfile) => void }) {
  const sections: Array<[ImportedItemKey, string]> = [
    ["skillsAndTools", "技能与工具"],
    ["certifications", "证书"],
    ["languages", "语言"],
    ["awards", "奖项与荣誉"],
    ["links", "链接"],
    ["otherSections", "其他信息"],
  ];
  const updateItem = (key: ImportedItemKey, index: number, text: string) => {
    const values = [...profile[key]];
    values[index] = { ...values[index], text, status: "candidate" };
    onChange({ ...profile, [key]: values });
  };
  const removeItem = (key: ImportedItemKey, index: number) => {
    onChange({ ...profile, [key]: profile[key].filter((_, itemIndex) => itemIndex !== index) });
  };
  const addItem = (key: ImportedItemKey) => {
    const text = "";
    const next = { id: `manual-import-${key}-${profile[key].length + 1}`, text, sourceQuote: "", status: "needs-review" as const, confidence: "low" as const };
    onChange({ ...profile, [key]: [...profile[key], next] });
  };
  return (
    <div className="mt-5 space-y-4 border-t pt-4">
      <div>
        <p className="text-sm font-medium">完整导入资料</p>
        <p className="text-xs text-neutral-500">点击“确认导入”后，已映射内容会标记为已核对；待确认片段仍保持隔离。</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(([key, label]) => (
          <div key={key} className="rounded border p-3">
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium">{label}</span><Button type="button" size="sm" variant="ghost" onClick={() => addItem(key)}>添加</Button></div>
            <div className="space-y-2">
              {profile[key].map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Input value={item.text} placeholder="原文内容" onChange={(event) => updateItem(key, index, event.target.value)} />
                  <Button type="button" size="sm" variant="ghost" aria-label={`删除${label}`} onClick={() => removeItem(key, index)}>删除</Button>
                </div>
              ))}
              {!profile[key].length && <p className="text-xs text-neutral-400">暂无内容</p>}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded border p-3">
        <p className="mb-2 text-xs font-medium">多段教育经历</p>
        <div className="space-y-2">
          {profile.educationHistory.map((education, index) => (
            <div key={education.id} className="grid gap-2 md:grid-cols-3">
              <Input value={education.school} placeholder="学校" onChange={(event) => { const values = [...profile.educationHistory]; values[index] = { ...education, school: event.target.value, status: "candidate" }; onChange({ ...profile, educationHistory: values }); }} />
              <Input value={education.degree} placeholder="学历/专业" onChange={(event) => { const values = [...profile.educationHistory]; values[index] = { ...education, degree: event.target.value, status: "candidate" }; onChange({ ...profile, educationHistory: values }); }} />
              <Input value={education.period} placeholder="时间" onChange={(event) => { const values = [...profile.educationHistory]; values[index] = { ...education, period: event.target.value, status: "candidate" }; onChange({ ...profile, educationHistory: values }); }} />
            </div>
          ))}
          {!profile.educationHistory.length && <p className="text-xs text-neutral-400">暂无内容</p>}
        </div>
      </div>
    </div>
  );
}
