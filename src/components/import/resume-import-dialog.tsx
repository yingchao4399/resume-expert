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
import type { FinalResume, ImportedResumeItem, ImportedResumeProfile, ResumeImportMetadata } from "@/types/resume";

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
  const [notice, setNotice] = useState<string | null>(null);
  const [unmappedTargets, setUnmappedTargets] = useState<Record<string, UnmappedTarget>>({});

  const reset = () => {
    setExtracted(null);
    setText("");
    setDraft(null);
    setImportedProfile(null);
    setView("structured");
    setMode(null);
    setError(null);
    setNotice(null);
    setUnmappedTargets({});
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
      setNotice("结构化结果已生成，请逐项核对后确认导入。");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "AI 整理失败");
    } finally {
      setStructuring(false);
    }
  };

  const handleConfirm = () => {
    if (!extracted || text.trim().length < 20) return;
    const synchronizedDraft = draft && importedProfile ? synchronizeDraftWithProfile(draft, importedProfile) : draft;
    onConfirm(text.trim(), synchronizedDraft, {
      sourceType: extracted.fileType,
      fileName: extracted.fileName,
      importedAt: new Date().toISOString(),
      warnings: extracted.warnings,
    }, importedProfile ? confirmImportedProfile(importedProfile) : null);
    reset();
    onOpenChange(false);
  };

  const handleTextChange = (nextText: string) => {
    setText(nextText);
    if (draft || importedProfile) {
      setDraft(null);
      setImportedProfile(null);
      setMode(null);
      setView("structured");
      setNotice("原始文本已修改。为避免保存旧识别结果，请重新点击“AI 整理结构”。");
    }
  };

  const updateImportedProfile = (nextProfile: ImportedResumeProfile) => {
    setImportedProfile(nextProfile);
    setDraft((current) => current ? synchronizeDraftWithProfile(current, nextProfile) : current);
  };

  const resolveUnmapped = (segment: ImportedResumeItem, action: "categorize" | "keep" | "delete") => {
    if (!importedProfile) return;
    if (action === "delete") {
      updateImportedProfile({ ...importedProfile, unmappedSegments: importedProfile.unmappedSegments.filter((item) => item.id !== segment.id) });
      return;
    }
    const target = action === "keep" ? "otherSections" : (unmappedTargets[segment.id] ?? "skillsAndTools");
    const nextProfile = categorizeUnmapped(importedProfile, segment, target);
    updateImportedProfile(nextProfile);
    if (target === "workExperience") {
      setDraft((current) => current ? { ...current, workExperience: [...current.workExperience, { company: "", role: "", period: "", bullets: [segment.text] }] } : current);
    } else if (target === "projectExperience") {
      setDraft((current) => current ? { ...current, projectExperience: [...current.projectExperience, { name: "", role: "", period: "", bullets: [segment.text] }] } : current);
    }
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
              <Textarea className="min-h-56 font-mono text-xs leading-relaxed" value={text} onChange={(event) => handleTextChange(event.target.value)} />
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
                  <Textarea className="min-h-56 font-mono text-xs leading-relaxed" value={text} onChange={(event) => handleTextChange(event.target.value)} />
                ) : view === "unmapped" && importedProfile ? (
                  <div className="space-y-2 text-sm">
                    <p className="text-xs text-neutral-500">这些片段没有被自动写入可信资料，请确认后再整理。</p>
                    {importedProfile.unmappedSegments.length ? importedProfile.unmappedSegments.map((segment) => (
                      <div key={segment.id} className="space-y-2 rounded border bg-amber-50 p-3">
                        <p>{segment.text}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="sr-only" htmlFor={`unmapped-target-${segment.id}`}>归入区块</label>
                          <select
                            id={`unmapped-target-${segment.id}`}
                            className="h-8 rounded-md border bg-white px-2 text-xs"
                            value={unmappedTargets[segment.id] ?? "skillsAndTools"}
                            onChange={(event) => setUnmappedTargets((current) => ({ ...current, [segment.id]: event.target.value as UnmappedTarget }))}
                          >
                            {UNMAPPED_TARGETS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <Button type="button" size="sm" onClick={() => resolveUnmapped(segment, "categorize")}>归类</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => resolveUnmapped(segment, "keep")}>保留为其他信息</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => resolveUnmapped(segment, "delete")}>删除</Button>
                        </div>
                      </div>
                    )) : <p className="text-neutral-500">没有待确认片段。</p>}
                  </div>
                ) : (
                  <>
                <div className="mb-4">
                  <p className="text-sm font-medium">结构化结果</p>
                  <p className="text-xs text-neutral-500">
                    {mode === "mock" ? "当前为 Mock 流程验证：仅按原文确定性整理，不会补造事实；请人工核对后确认。" : "请核对所有事实，保存后作为当前岗位版本的源简历。"}
                  </p>
                </div>
                    <ResumeEditor value={draft} onChange={setDraft} />
                    {importedProfile && <ImportedProfileEditor profile={importedProfile} onChange={updateImportedProfile} />}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {notice && <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700" role="status">{notice}</div>}
        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}

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
type UnmappedTarget = ImportedItemKey | "workExperience" | "projectExperience" | "educationHistory";

const UNMAPPED_TARGETS: Array<[UnmappedTarget, string]> = [
  ["workExperience", "工作经历"], ["projectExperience", "项目经历"], ["educationHistory", "教育经历"],
  ["skillsAndTools", "技能与工具"], ["certifications", "证书"], ["languages", "语言"],
  ["awards", "奖项与荣誉"], ["links", "链接"], ["otherSections", "其他信息"],
];

function categorizeUnmapped(profile: ImportedResumeProfile, segment: ImportedResumeItem, target: UnmappedTarget): ImportedResumeProfile {
  const unmappedSegments = profile.unmappedSegments.filter((item) => item.id !== segment.id);
  const sourceQuote = segment.sourceQuote || segment.text;
  const baseItem = { ...segment, sourceQuote, status: "candidate" as const, confidence: "medium" as const };
  if (target === "workExperience" || target === "projectExperience") {
    const entry = {
      id: `manual-${target}-${segment.id}`, organization: "", name: "", role: "", period: "",
      summary: segment.text, bullets: [baseItem], sourceQuote, status: "candidate" as const, confidence: "medium" as const,
    };
    return { ...profile, [target]: [...profile[target], entry], unmappedSegments };
  }
  if (target === "educationHistory") {
    const entry = { id: `manual-education-${segment.id}`, school: segment.text, degree: "", period: "", details: [], sourceQuote, status: "candidate" as const, confidence: "medium" as const };
    return { ...profile, educationHistory: [...profile.educationHistory, entry], unmappedSegments };
  }
  return { ...profile, [target]: [...profile[target], baseItem], unmappedSegments };
}

function synchronizeDraftWithProfile(draft: FinalResume, profile: ImportedResumeProfile): FinalResume {
  const visible = <T extends { status: "candidate" | "confirmed" | "needs-review" }>(values: T[]) => values.filter((item) => item.status !== "needs-review");
  const skills = visible(profile.skillsAndTools);
  const educationHistory = visible(profile.educationHistory);
  const firstEducation = educationHistory[0];
  return {
    ...draft,
    coreSkills: skills.map((item) => item.text),
    skillsAndTools: skills.map((item) => item.text),
    education: firstEducation ? { school: firstEducation.school, degree: firstEducation.degree, period: firstEducation.period } : draft.education,
    educationHistory,
    certifications: visible(profile.certifications), languages: visible(profile.languages), awards: visible(profile.awards),
    links: visible(profile.links), otherSections: visible(profile.otherSections),
  };
}

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
    const next = { id: `manual-import-${key}-${crypto.randomUUID()}`, text, sourceQuote: "", status: "needs-review" as const, confidence: "low" as const };
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
