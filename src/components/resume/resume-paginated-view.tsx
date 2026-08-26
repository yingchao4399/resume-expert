import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { buildResumeRenderModel, paginateResumeRenderModel } from "@/lib/export/resume-render-model";
import { ResumeRenderBlocks, ResumeRenderHeader } from "@/components/resume/resume-render-content";
import { getDefaultLayoutConfig, getFontStack } from "@/lib/templates/resume-templates";
import type { FinalResume, ResumeLayoutConfig } from "@/types/resume";

export function ResumePaginatedView({
  resume,
  layoutConfig = getDefaultLayoutConfig(),
  className,
}: {
  resume: FinalResume;
  layoutConfig?: ResumeLayoutConfig;
  className?: string;
}) {
  const model = buildResumeRenderModel(resume, layoutConfig);
  const pages = paginateResumeRenderModel(model);
  const style = {
    fontFamily: getFontStack(model.layout.fontFamily),
    fontSize: `${model.layout.baseFontSize}pt`,
    lineHeight: model.layout.lineHeight,
    "--resume-accent": model.layout.accentColor,
    "--resume-section-gap": `${model.layout.sectionSpacing}px`,
  } as CSSProperties;

  return <div className={cn("resume-paginated-view space-y-5 print:space-y-0", className)} data-page-count={pages.length}>
    {pages.map((page) => <article
      key={page.index}
      className={cn("a4-resume-page resume-document mx-auto bg-white text-neutral-900 shadow-sm print:shadow-none", `resume-template-${model.layout.templateId}`)}
      style={{ ...style, padding: `${model.layout.pageMargin}mm` }}
      data-pdf-page={page.index + 1}
    >
      {page.includeHeader && <ResumeRenderHeader model={model} />}
      <ResumeRenderBlocks blocks={page.blocks} layout={model.layout} withTopSpacing={page.includeHeader} />
    </article>)}
  </div>;
}
