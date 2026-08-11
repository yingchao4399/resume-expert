"use client";

import { useEffect, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResumeTemplateView } from "@/components/resume/resume-template-view";
import {
  getDefaultLayoutConfig,
  RESUME_SECTION_LABELS,
  RESUME_TEMPLATES,
  sanitizeLayoutConfig,
} from "@/lib/templates/resume-templates";
import { cn } from "@/lib/utils";
import type {
  FinalResume,
  ResumeLayoutConfig,
  ResumeSectionId,
  ResumeTemplateId,
} from "@/types/resume";
import { useResumeStore } from "@/store/resume-store";

interface ResumeTemplateStudioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resume: FinalResume;
  value: ResumeLayoutConfig;
  onSave: (config: ResumeLayoutConfig) => void;
}

export function ResumeTemplateStudio({ open, onOpenChange, resume, value, onSave }: ResumeTemplateStudioProps) {
  const [draft, setDraft] = useState(value);
  const { dirtyScope, setDirtyScope } = useResumeStore();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (open) setDraft(structuredClone(value));
  }, [open, value]);

  const safeDraft = useMemo(() => sanitizeLayoutConfig(draft), [draft]);

  const changeTemplate = (templateId: ResumeTemplateId) => {
    if (templateId === draft.templateId) return;
    if (!window.confirm("切换模板会恢复该模板的视觉默认值，但保留区块顺序和显隐。是否继续？")) return;
    setDirtyScope("layout");
    setDraft({
      ...getDefaultLayoutConfig(templateId),
      sectionOrder: draft.sectionOrder,
      hiddenSections: draft.hiddenSections,
    });
  };

  const update = (patch: Partial<ResumeLayoutConfig>) => {
    setDirtyScope("layout");
    setDraft((current) => ({ ...current, ...patch }));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setDirtyScope("layout");
    setDraft((current) => {
      const from = current.sectionOrder.indexOf(active.id as ResumeSectionId);
      const to = current.sectionOrder.indexOf(over.id as ResumeSectionId);
      return { ...current, sectionOrder: arrayMove(current.sectionOrder, from, to) };
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && dirtyScope === "layout" && !window.confirm("排版设置还有未保存修改，确定关闭吗？")) return;
      if (!nextOpen) setDirtyScope(null);
      onOpenChange(nextOpen);
    }}>
      <DialogContent className="max-h-[94vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>模板与统一排版</DialogTitle>
          <DialogDescription>
            设置仅影响当前岗位版本，并同步用于网页预览、打印/PDF 和 DOCX。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className="grid gap-2">
              {RESUME_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={cn(
                    "rounded-lg border p-3 text-left",
                    draft.templateId === template.id ? "border-neutral-900 bg-neutral-50" : "hover:bg-neutral-50"
                  )}
                  onClick={() => changeTemplate(template.id)}
                >
                  <p className="text-sm font-medium">{template.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">{template.description}</p>
                </button>
              ))}
            </div>

            <div className="grid gap-3 rounded-lg border p-3">
              <label className="grid gap-1 text-xs">
                字体
                <select className="h-9 rounded-md border bg-white px-2 text-sm" value={draft.fontFamily} onChange={(event) => update({ fontFamily: event.target.value as ResumeLayoutConfig["fontFamily"] })}>
                  <option value="microsoft-yahei">微软雅黑</option>
                  <option value="songti">宋体</option>
                  <option value="arial">Arial</option>
                  <option value="calibri">Calibri</option>
                </select>
              </label>
              <RangeField label="正文字号" value={draft.baseFontSize} min={8.5} max={12} step={0.5} suffix="pt" onChange={(baseFontSize) => update({ baseFontSize })} />
              <RangeField label="行距" value={draft.lineHeight} min={1.15} max={1.7} step={0.05} onChange={(lineHeight) => update({ lineHeight })} />
              <RangeField label="区块间距" value={draft.sectionSpacing} min={6} max={24} step={1} suffix="px" onChange={(sectionSpacing) => update({ sectionSpacing })} />
              <RangeField label="A4 页边距" value={draft.pageMargin} min={10} max={24} step={1} suffix="mm" onChange={(pageMargin) => update({ pageMargin })} />
              <label className="flex items-center justify-between text-xs">
                强调色
                <input type="color" value={draft.accentColor} onChange={(event) => update({ accentColor: event.target.value })} />
              </label>
              {safeDraft.accentColor.toLowerCase() !== draft.accentColor.toLowerCase() && (
                <p className="text-xs text-amber-700">所选颜色对比度不足，保存时将恢复模板默认强调色。</p>
              )}
              <label className="grid gap-1 text-xs">
                项目符号
                <select className="h-9 rounded-md border bg-white px-2 text-sm" value={draft.bulletStyle} onChange={(event) => update({ bulletStyle: event.target.value as ResumeLayoutConfig["bulletStyle"] })}>
                  <option value="disc">圆点 •</option>
                  <option value="dash">短横 –</option>
                  <option value="square">方块 ▪</option>
                </select>
              </label>
            </div>

            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-medium">区块顺序与显隐</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={draft.sectionOrder} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {draft.sectionOrder.map((id) => (
                      <SortableSectionRow
                        key={id}
                        id={id}
                        hidden={draft.hiddenSections.includes(id)}
                        onHiddenChange={(hidden) =>
                          update({
                            hiddenSections: hidden
                              ? [...draft.hiddenSections, id]
                              : draft.hiddenSections.filter((item) => item !== id),
                          })
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setDirtyScope("layout");
                setDraft({
                  ...getDefaultLayoutConfig(draft.templateId),
                  sectionOrder: draft.sectionOrder,
                  hiddenSections: draft.hiddenSections,
                });
              }}
            >
              <RotateCcw className="h-4 w-4" /> 恢复视觉默认值
            </Button>
          </div>

          <div className="overflow-auto rounded-lg bg-neutral-100 p-4">
            <div
              className="mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white shadow-sm"
              style={{ padding: `${safeDraft.pageMargin}mm` }}
            >
              <ResumeTemplateView resume={resume} layoutConfig={safeDraft} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => {
            if (dirtyScope === "layout" && !window.confirm("排版设置还有未保存修改，确定取消吗？")) return;
            setDirtyScope(null);
            onOpenChange(false);
          }}>取消</Button>
          <Button
            onClick={() => {
              onSave(safeDraft);
              setDirtyScope(null);
              onOpenChange(false);
            }}
          >
            保存排版
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="flex justify-between"><span>{label}</span><span>{value}{suffix}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function SortableSectionRow({
  id,
  hidden,
  onHiddenChange,
}: {
  id: ResumeSectionId;
  hidden: boolean;
  onHiddenChange: (hidden: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className="flex items-center gap-2 rounded-md border bg-white px-2 py-2 text-xs"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button type="button" className="cursor-grab text-neutral-400" aria-label={`拖动${RESUME_SECTION_LABELS[id]}`} {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1">{RESUME_SECTION_LABELS[id]}</span>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={!hidden} onChange={(event) => onHiddenChange(!event.target.checked)} />
        显示
      </label>
    </div>
  );
}
