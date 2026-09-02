"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResumeFormattedText, ResumeTextAlignment } from "@/types/resume";
import { normalizeRichText, richTextToSafeHtml, serializeEditableElement } from "@/lib/resume/rich-text";

export function RichTextEditor({ id, value, onChange, minHeight = "min-h-24", label = "富文本编辑" }: { id?: string; value: ResumeFormattedText; onChange: (value: ResumeFormattedText) => void; minHeight?: string; label?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || focusedRef.current) return;
    const next = normalizeRichText(value);
    editor.innerHTML = richTextToSafeHtml(next);
    editor.style.textAlign = next.alignment;
    editor.dataset.firstLineIndent = String(next.firstLineIndent);
    editor.dataset.hangingIndent = String(next.hangingIndent);
    applyIndentStyle(editor, next.firstLineIndent, next.hangingIndent);
  }, [value]);

  const emit = () => { if (editorRef.current) onChange(serializeEditableElement(editorRef.current)); };
  const command = (name: "bold" | "italic" | "underline") => {
    editorRef.current?.focus();
    document.execCommand(name);
    emit();
  };
  const alignment = (next: ResumeTextAlignment) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.style.textAlign = next;
    emit();
  };
  const indent = (field: "firstLineIndent" | "hangingIndent", delta: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const current = Number(editor.dataset[field] ?? 0);
    editor.dataset[field] = String(Math.max(0, Math.min(24, current + delta)));
    applyIndentStyle(editor, Number(editor.dataset.firstLineIndent ?? 0), Number(editor.dataset.hangingIndent ?? 0));
    emit();
  };

  return <div className="rounded-md border bg-white">
    <div className="flex flex-wrap items-center gap-1 border-b bg-neutral-50 p-1.5" aria-label={`${label}工具栏`}>
      <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="加粗" title="加粗" onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")}><Bold className="h-4 w-4" /></Button>
      <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="斜体" title="斜体" onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")}><Italic className="h-4 w-4" /></Button>
      <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="下划线" title="下划线" onMouseDown={(event) => event.preventDefault()} onClick={() => command("underline")}><Underline className="h-4 w-4" /></Button>
      <span className="mx-1 h-5 w-px bg-neutral-200" />
      {(["left", "center", "right", "justify"] as const).map((next) => <Button key={next} type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" aria-label={`段落${next === "left" ? "左对齐" : next === "center" ? "居中" : next === "right" ? "右对齐" : "两端对齐"}`} onMouseDown={(event) => event.preventDefault()} onClick={() => alignment(next)}>{next === "left" ? "左对齐" : next === "center" ? "居中" : next === "right" ? "右对齐" : "两端"}</Button>)}
      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => indent("firstLineIndent", 0.5)}>首行缩进 +</Button>
      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => indent("hangingIndent", 0.5)}>悬挂缩进 +</Button>
      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => indent("firstLineIndent", -0.5)}>首行缩进 −</Button>
      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => indent("hangingIndent", -0.5)}>悬挂缩进 −</Button>
    </div>
    <div id={id} ref={editorRef} role="textbox" aria-label={label} aria-multiline="true" contentEditable suppressContentEditableWarning className={`${minHeight} whitespace-pre-wrap px-3 py-2 text-sm outline-none`} onFocus={() => { focusedRef.current = true; }} onBlur={() => { focusedRef.current = false; emit(); }} onInput={emit} />
    <p className="border-t px-3 py-1 text-[11px] text-neutral-400">选中文字后可加粗、斜体或下划线；段落工具只影响当前段落样式。</p>
  </div>;
}

function applyIndentStyle(editor: HTMLElement, firstLineIndent: number, hangingIndent: number) {
  const hanging = Math.max(0, hangingIndent);
  editor.style.paddingLeft = `${hanging}em`;
  editor.style.textIndent = `${firstLineIndent - hanging}em`;
}
