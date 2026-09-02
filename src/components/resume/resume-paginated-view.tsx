"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ResumeRenderBlocks, ResumeRenderHeader } from "@/components/resume/resume-render-content";
import { createResumePaginationPlan, hashResumeRenderModel } from "@/lib/export/resume-pagination";
import { buildResumeRenderModel, type ResumeRenderBlock } from "@/lib/export/resume-render-model";
import { getDefaultLayoutConfig, getFontStack, getTypographyConfig } from "@/lib/templates/resume-templates";
import { cn } from "@/lib/utils";
import type {
  FinalResume,
  ResumeLayoutConfig,
  ResumePaginationPlan,
  ResumePaginationStatus,
} from "@/types/resume";

export function ResumePaginatedView({
  resume,
  layoutConfig = getDefaultLayoutConfig(),
  className,
  onPaginationPlanChange,
  showPageCount = true,
}: {
  resume: FinalResume;
  layoutConfig?: ResumeLayoutConfig;
  className?: string;
  onPaginationPlanChange?: (plan: ResumePaginationPlan | null, status: ResumePaginationStatus) => void;
  showPageCount?: boolean;
}) {
  const model = useMemo(() => buildResumeRenderModel(resume, layoutConfig), [resume, layoutConfig]);
  const contentHash = useMemo(() => hashResumeRenderModel(model), [model]);
  const measurementRef = useRef<HTMLElement>(null);
  const [plan, setPlan] = useState<ResumePaginationPlan | null>(null);
  const [status, setStatus] = useState<ResumePaginationStatus>("measuring");
  const body = getTypographyConfig(model.layout).body;
  const style = {
    fontFamily: getFontStack(body.fontFamily),
    fontSize: `${body.fontSize}pt`,
    lineHeight: model.layout.lineHeight,
    "--resume-accent": model.layout.accentColor,
  } as CSSProperties;

  useEffect(() => {
    let cancelled = false;
    setPlan(null);
    setStatus("measuring");
    const measure = async () => {
      try {
        await document.fonts.ready;
        await afterTwoFrames();
        const page = measurementRef.current;
        if (cancelled || !page) return;
        const computed = window.getComputedStyle(page);
        const pageContentHeight = page.getBoundingClientRect().height
          - Number.parseFloat(computed.paddingTop)
          - Number.parseFloat(computed.paddingBottom);
        const header = page.querySelector<HTMLElement>("[data-resume-header]");
        const blocks = page.querySelector<HTMLElement>("[data-resume-blocks]");
        const blockHeights = Object.fromEntries(
          Array.from(page.querySelectorAll<HTMLElement>("[data-resume-block-id]"))
            .map((element) => [element.dataset.resumeBlockId!, element.getBoundingClientRect().height]),
        );
        const headerHeight = (header?.getBoundingClientRect().height ?? 0)
          + Number.parseFloat(blocks ? window.getComputedStyle(blocks).paddingTop : "0");
        const nextPlan = createResumePaginationPlan(model, { pageContentHeight, headerHeight, blockHeights });
        if (!cancelled) {
          setPlan(nextPlan);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };
    void measure();
    return () => { cancelled = true; };
  }, [contentHash, model]);

  useEffect(() => {
    onPaginationPlanChange?.(plan, status);
  }, [onPaginationPlanChange, plan, status]);

  const blocksById = useMemo(() => new Map(model.blocks.map((block) => [block.id, block])), [model.blocks]);

  return <div
    className={cn("resume-paginated-view", className)}
    data-page-count={plan?.pageCount ?? 0}
    data-pagination-status={status}
    data-content-hash={contentHash}
  >
    {showPageCount && <p className="mb-3 text-center text-xs text-neutral-500 print:hidden" aria-live="polite">
      {status === "measuring" ? "正在计算 A4 分页…" : status === "error" ? "A4 分页失败" : `共 ${plan?.pageCount ?? 0} 页`}
    </p>}
    <div className="space-y-5 print:space-y-0">
      {plan?.pages.map((page) => <article
        key={page.index}
        className={cn("a4-resume-page resume-document mx-auto bg-white text-neutral-900 shadow-sm print:shadow-none", `resume-template-${model.layout.templateId}`)}
        style={{ ...style, padding: `${model.layout.pageMargin}mm` }}
        data-pdf-page={page.index + 1}
        data-content-hash={contentHash}
      >
        {page.includeHeader && <ResumeRenderHeader model={model} />}
        <ResumeRenderBlocks
          blocks={page.blockIds.map((id) => blocksById.get(id)).filter(isResumeRenderBlock)}
          layout={model.layout}
          tokens={model.tokens}
          withTopSpacing={page.includeHeader}
        />
      </article>)}
    </div>
    <article
      ref={measurementRef}
      aria-hidden="true"
      className={cn("a4-resume-page resume-document pointer-events-none fixed left-[-20000px] top-0 bg-white text-neutral-900", `resume-template-${model.layout.templateId}`)}
      style={{ ...style, padding: `${model.layout.pageMargin}mm` }}
    >
      <ResumeRenderHeader model={model} />
      <ResumeRenderBlocks blocks={model.blocks} layout={model.layout} tokens={model.tokens} />
    </article>
  </div>;
}

function isResumeRenderBlock(value: ResumeRenderBlock | undefined): value is ResumeRenderBlock {
  return Boolean(value);
}

function afterTwoFrames(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
