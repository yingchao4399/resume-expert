"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ResumePaginatedView } from "@/components/resume/resume-paginated-view";
import {
  getDefaultLayoutConfig,
  getTypographyConfig,
  RESUME_SECTION_LABELS,
  RESUME_TEMPLATES,
  sanitizeLayoutConfig,
} from "@/lib/templates/resume-templates";
import { buildOnePageFitCandidates, hashResumeRenderModel } from "@/lib/export/resume-pagination";
import { buildResumeRenderModel } from "@/lib/export/resume-render-model";
import { cn } from "@/lib/utils";
import type {
  FinalResume,
  ResumeLayoutConfig,
  ResumeFitResult,
  ResumePaginationPlan,
  ResumePaginationStatus,
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
  const [paginationPlan, setPaginationPlan] = useState<ResumePaginationPlan | null>(null);
  const [paginationStatus, setPaginationStatus] = useState<ResumePaginationStatus>("measuring");
  const [fitSession, setFitSession] = useState<{ candidates: ResumeLayoutConfig[]; index: number; initial: ResumeLayoutConfig } | null>(null);
  const [fitResult, setFitResult] = useState<ResumeFitResult | null>(null);
  const { dirtyScope, setDirtyScope } = useResumeStore();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (open) {
      setDraft(structuredClone(value));
      setFitSession(null);
      setFitResult(null);
    }
  }, [open, value]);

  const safeDraft = useMemo(() => sanitizeLayoutConfig(draft), [draft]);
  const expectedContentHash = useMemo(() => hashResumeRenderModel(buildResumeRenderModel(resume, safeDraft)), [resume, safeDraft]);

  const changeTemplate = (templateId: ResumeTemplateId) => {
    if (templateId === draft.templateId) return;
    if (!window.confirm("切换模板会恢复该模板的视觉默认值，但保留区块顺序和显隐。是否继续？")) return;
    setDirtyScope("layout");
    setFitSession(null);
    setFitResult(null);
    setDraft({
      ...getDefaultLayoutConfig(templateId),
      sectionOrder: draft.sectionOrder,
      hiddenSections: draft.hiddenSections,
    });
  };

  const update = (patch: Partial<ResumeLayoutConfig>) => {
    setDirtyScope("layout");
    setFitSession(null);
    setFitResult(null);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const handlePaginationPlanChange = useCallback((plan: ResumePaginationPlan | null, status: ResumePaginationStatus) => {
    setPaginationPlan(plan);
    setPaginationStatus(status);
  }, []);

  const startOnePageFit = () => {
    if (paginationPlan?.pageCount === 1 && !paginationPlan.overflow) {
      setFitResult({ status: "fitted", layoutConfig: safeDraft, pageCount: 1, changedFields: [], message: "当前排版已经是 1 页，无需调整。" });
      return;
    }
    const candidates = buildOnePageFitCandidates(safeDraft);
    if (!candidates.length) {
      setFitResult({ status: "cannot-fit", layoutConfig: safeDraft, pageCount: paginationPlan?.pageCount ?? 0, changedFields: [], message: "当前已达到排版护栏下限，仍无法安全适配为 1 页。" });
      return;
    }
    setDirtyScope("layout");
    setFitResult({ status: "running", layoutConfig: safeDraft, pageCount: paginationPlan?.pageCount ?? 0, changedFields: [], message: "正在按可读性优先顺序适配 1 页…" });
    setFitSession({ candidates, index: 0, initial: safeDraft });
    setDraft(candidates[0]);
  };

  useEffect(() => {
    if (!fitSession || paginationStatus !== "ready" || !paginationPlan || paginationPlan.contentHash !== expectedContentHash) return;
    if (paginationPlan.pageCount === 1 && !paginationPlan.overflow) {
      const changedFields = (["sectionSpacing", "pageMargin", "lineHeight", "baseFontSize"] as const)
        .filter((field) => fitSession.initial[field] !== safeDraft[field]);
      setFitResult({ status: "fitted", layoutConfig: safeDraft, pageCount: 1, changedFields, message: `已适配为 1 页：${changedFields.map((field) => FIT_FIELD_LABELS[field]).join("、") || "无需调整"}。你仍可继续手动微调。` });
      setFitSession(null);
      return;
    }
    const nextIndex = fitSession.index + 1;
    if (nextIndex < fitSession.candidates.length) {
      setFitSession({ ...fitSession, index: nextIndex });
      setDraft(fitSession.candidates[nextIndex]);
      return;
    }
    setFitResult({ status: "cannot-fit", layoutConfig: safeDraft, pageCount: paginationPlan.pageCount, changedFields: ["sectionSpacing", "pageMargin", "lineHeight", "baseFontSize"], message: `已达到字号 8.5pt、行距 1.15、页边距 10mm 等安全下限，仍为 ${paginationPlan.pageCount} 页。请精简内容或隐藏非必要区块。` });
    setFitSession(null);
  }, [expectedContentHash, fitSession, paginationPlan, paginationStatus, safeDraft]);

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
              <div className="rounded-md bg-neutral-50 p-3" aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium">A4 分页</p>
                    <p className="text-xs text-neutral-500">{paginationStatus === "ready" ? `当前共 ${paginationPlan?.pageCount ?? 0} 页${paginationPlan?.overflow ? "，存在内容溢出" : ""}` : "正在测量真实 A4 版面…"}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" disabled={fitResult?.status === "running" || paginationStatus !== "ready"} onClick={startOnePageFit}>
                    {fitResult?.status === "running" ? "正在适配…" : "一键适配 1 页"}
                  </Button>
                </div>
                {fitResult && fitResult.status !== "running" && <p className={cn("mt-2 text-xs", fitResult.status === "cannot-fit" ? "text-amber-700" : "text-emerald-700")}>{fitResult.message}</p>}
              </div>
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
              <div className="rounded-md border bg-neutral-50 p-3">
                <p className="mb-2 text-xs font-medium">正文与标题层级</p>
                <p className="mb-3 text-[11px] text-neutral-500">每一级可独立设置字体、字号和颜色；旧文档会自动使用模板默认值。</p>
                <div className="space-y-2">
                  {TYPOGRAPHY_LEVELS.map((level) => {
                    const typography = getTypographyConfig(safeDraft)[level.id];
                    return <TypographyField key={level.id} label={level.label} value={typography} onChange={(next) => update({ typography: { ...getTypographyConfig(safeDraft), [level.id]: next } })} />;
                  })}
                </div>
              </div>
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
            <ResumePaginatedView resume={resume} layoutConfig={safeDraft} onPaginationPlanChange={handlePaginationPlanChange} />
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

const FIT_FIELD_LABELS = {
  sectionSpacing: "区块间距",
  pageMargin: "页边距",
  lineHeight: "行距",
  baseFontSize: "正文字号",
} as const;

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

const TYPOGRAPHY_LEVELS = [
  { id: "body", label: "正文" }, { id: "h1", label: "一级标题（姓名）" }, { id: "h2", label: "二级标题（区块）" },
  { id: "h3", label: "三级标题（经历）" }, { id: "h4", label: "四级标题" }, { id: "h5", label: "五级标题" },
  { id: "h6", label: "六级标题" }, { id: "h7", label: "七级标题" },
] as const;

function TypographyField({ label, value, onChange }: { label: string; value: { fontFamily: ResumeLayoutConfig["fontFamily"]; fontSize: number; color: string }; onChange: (value: { fontFamily: ResumeLayoutConfig["fontFamily"]; fontSize: number; color: string }) => void }) {
  return <div className="grid grid-cols-[1fr_88px_42px] items-center gap-2">
    <label className="text-[11px]">{label}<select className="mt-1 h-7 w-full rounded border bg-white px-1 text-xs" value={value.fontFamily} onChange={(event) => onChange({ ...value, fontFamily: event.target.value as ResumeLayoutConfig["fontFamily"] })}><option value="microsoft-yahei">微软雅黑</option><option value="songti">宋体</option><option value="arial">Arial</option><option value="calibri">Calibri</option></select></label>
    <label className="text-[11px]">字号<input className="mt-1 h-7 w-full rounded border bg-white px-1 text-xs" type="number" min={8} max={36} step={0.5} value={value.fontSize} onChange={(event) => onChange({ ...value, fontSize: Number(event.target.value) })} /></label>
    <label className="text-[11px]">颜色<input className="mt-1 h-7 w-10 rounded border bg-white p-0.5" type="color" value={value.color} onChange={(event) => onChange({ ...value, color: event.target.value })} /></label>
  </div>;
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
