"use client";

import { useMemo, useState, type MouseEvent, type ReactElement } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Eraser, IndentDecrease, IndentIncrease, Italic, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResumePaginatedView } from "@/components/resume/resume-paginated-view";
import { mapResumeBullets, normalizeResumeBullet } from "@/lib/evidence/resume-evidence";
import { applyInlineFormat, clearRichTextFormatting, normalizeRichText, setParagraphLayout, type ResumeInlineMark } from "@/lib/resume/rich-text";
import type { FinalResume, ResumeEditableTarget, ResumeEditorSelection, ResumeFormattedText, ResumeLayoutConfig } from "@/types/resume";
import { cn } from "@/lib/utils";

export function ResumeA4FormatEditor({ resume, layoutConfig, onChange }: {
  resume: FinalResume;
  layoutConfig: ResumeLayoutConfig;
  onChange: (resume: FinalResume) => void;
}) {
  const [selection, setSelection] = useState<ResumeEditorSelection | null>(null);
  const current = useMemo(() => selection ? getFormatting(resume, selection.target) : null, [resume, selection]);
  const hasTextSelection = Boolean(selection && selection.end > selection.start);

  const updateTarget = (updater: (value: ResumeFormattedText) => ResumeFormattedText) => {
    if (!selection) return;
    if (selection.target.kind === "summary") {
      const next = updater(normalizeRichText(resume.summaryFormatting, resume.summary));
      onChange({ ...resume, summary: next.runs.map((run) => run.text).join(""), summaryFormatting: next });
      return;
    }
    const bulletId = selection.target.bulletId;
    onChange(mapResumeBullets(resume, (bullet) => bullet.id === bulletId
      ? { ...normalizeResumeBullet(bullet), richText: updater(normalizeRichText(bullet.richText, bullet.text)) }
      : bullet));
  };

  const toggleMark = (mark: ResumeInlineMark) => {
    if (!selection || !hasTextSelection) return;
    const enabled = !selectionHasMark(current, selection.start, selection.end, mark);
    updateTarget((value) => applyInlineFormat(value, selection.start, selection.end, mark, enabled));
  };

  const setAlignment = (alignment: ResumeFormattedText["alignment"]) => updateTarget((value) => setParagraphLayout(value, { alignment }));
  const updateIndent = (kind: "firstLineIndent" | "hangingIndent", delta: number) => updateTarget((value) => setParagraphLayout(value, { [kind]: Math.round((value[kind] + delta) * 2) / 2 }));

  return <div className="space-y-3">
    <div className="sticky top-0 z-20 rounded-lg border bg-white/95 p-3 shadow-sm backdrop-blur" role="toolbar" aria-label="A4 段落格式工具栏">
      <div className="flex flex-wrap items-center gap-1.5">
        <ToolButton label="加粗" pressed={selectionHasMark(current, selection?.start ?? 0, selection?.end ?? 0, "bold")} disabled={!hasTextSelection} onClick={() => toggleMark("bold")}><Bold /></ToolButton>
        <ToolButton label="斜体" pressed={selectionHasMark(current, selection?.start ?? 0, selection?.end ?? 0, "italic")} disabled={!hasTextSelection} onClick={() => toggleMark("italic")}><Italic /></ToolButton>
        <ToolButton label="下划线" pressed={selectionHasMark(current, selection?.start ?? 0, selection?.end ?? 0, "underline")} disabled={!hasTextSelection} onClick={() => toggleMark("underline")}><Underline /></ToolButton>
        <span className="mx-1 h-6 w-px bg-neutral-200" />
        {([ ["left", "左对齐", AlignLeft], ["center", "居中", AlignCenter], ["right", "右对齐", AlignRight], ["justify", "两端对齐", AlignJustify] ] as const).map(([alignment, label, Icon]) =>
          <ToolButton key={alignment} label={label} pressed={current?.alignment === alignment} disabled={!selection} onClick={() => setAlignment(alignment)}><Icon /></ToolButton>)}
        <span className="mx-1 h-6 w-px bg-neutral-200" />
        <ToolButton label="减少首行缩进" disabled={!selection} onClick={() => updateIndent("firstLineIndent", -0.5)}><IndentDecrease /></ToolButton>
        <ToolButton label="增加首行缩进" disabled={!selection} onClick={() => updateIndent("firstLineIndent", 0.5)}><IndentIncrease /></ToolButton>
        <ToolButton label="减少悬挂缩进" disabled={!selection} onClick={() => updateIndent("hangingIndent", -0.5)}><IndentDecrease /></ToolButton>
        <ToolButton label="增加悬挂缩进" disabled={!selection} onClick={() => updateIndent("hangingIndent", 0.5)}><IndentIncrease /></ToolButton>
        <ToolButton label="清除当前段落格式" disabled={!selection} onClick={() => updateTarget(clearRichTextFormatting)}><Eraser /></ToolButton>
      </div>
      <p className="mt-2 text-xs text-neutral-500" aria-live="polite">
        {!selection ? "请在下方 A4 页面点击职业摘要或任意成果段落。" : `当前：${selection.target.kind === "summary" ? "职业摘要" : "成果段落"}；首行缩进 ${current?.firstLineIndent ?? 0}em，悬挂缩进 ${current?.hangingIndent ?? 0}em${hasTextSelection ? `；已选 ${selection.end - selection.start} 个字符` : "。拖选文字后可设置加粗、斜体或下划线。"}`}
      </p>
    </div>
    <div
      className="overflow-x-auto rounded-lg bg-neutral-100 p-4 [&_[data-resume-editable-kind]]:cursor-text [&_[data-resume-editable-kind]]:rounded-sm [&_[data-resume-editable-kind]]:outline-offset-2 [&_[data-resume-editable-kind]:focus]:outline [&_[data-resume-editable-kind]:focus]:outline-2 [&_[data-resume-editable-kind]:focus]:outline-blue-400"
      onClick={captureSelection}
      onMouseUp={captureSelection}
    >
      <ResumePaginatedView resume={resume} layoutConfig={layoutConfig} />
    </div>
  </div>;

  function captureSelection(event: MouseEvent<HTMLDivElement>) {
    const element = (event.target as HTMLElement).closest<HTMLElement>("[data-resume-editable-kind]");
    if (!element) return;
    const content = element.querySelector<HTMLElement>("[data-resume-text-content]") ?? element;
    const kind = element.dataset.resumeEditableKind;
    const target: ResumeEditableTarget = kind === "summary"
      ? { kind: "summary" }
      : { kind: "bullet", bulletId: element.dataset.resumeEditableId ?? "", textOffset: Number(element.dataset.resumeTextOffset ?? 0) };
    const browserSelection = window.getSelection();
    let start = 0;
    let end = 0;
    if (browserSelection?.rangeCount && browserSelection.anchorNode && content.contains(browserSelection.anchorNode) && browserSelection.focusNode && content.contains(browserSelection.focusNode)) {
      const range = browserSelection.getRangeAt(0);
      const beforeStart = document.createRange();
      beforeStart.selectNodeContents(content);
      beforeStart.setEnd(range.startContainer, range.startOffset);
      const beforeEnd = document.createRange();
      beforeEnd.selectNodeContents(content);
      beforeEnd.setEnd(range.endContainer, range.endOffset);
      start = beforeStart.toString().length;
      end = beforeEnd.toString().length;
    }
    const offset = target.kind === "bullet" ? target.textOffset ?? 0 : 0;
    setSelection({ target, start: Math.min(start, end) + offset, end: Math.max(start, end) + offset });
    element.focus({ preventScroll: true });
  }
}

function ToolButton({ label, pressed, disabled, onClick, children }: { label: string; pressed?: boolean; disabled?: boolean; onClick: () => void; children: ReactElement }) {
  return <Button type="button" variant={pressed ? "default" : "outline"} size="sm" className={cn("h-8 w-8 p-0 [&_svg]:h-4 [&_svg]:w-4")} aria-label={label} aria-pressed={pressed} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>{children}</Button>;
}

function getFormatting(resume: FinalResume, target: ResumeEditableTarget): ResumeFormattedText | null {
  if (target.kind === "summary") return normalizeRichText(resume.summaryFormatting, resume.summary);
  for (const item of [...resume.workExperience, ...resume.projectExperience]) {
    for (const value of item.bullets) {
      const bullet = normalizeResumeBullet(value);
      if (bullet.id === target.bulletId) return normalizeRichText(bullet.richText, bullet.text);
    }
  }
  return null;
}

function selectionHasMark(value: ResumeFormattedText | null, start: number, end: number, mark: ResumeInlineMark): boolean {
  if (!value || start === end) return false;
  let offset = 0;
  const selected = value.runs.filter((run) => {
    const runStart = offset;
    offset += run.text.length;
    return offset > start && runStart < end;
  });
  return selected.length > 0 && selected.every((run) => Boolean(run[mark]));
}
