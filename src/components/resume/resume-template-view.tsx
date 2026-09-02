import type { CSSProperties } from "react";
import { ResumeRenderBlocks, ResumeRenderHeader } from "@/components/resume/resume-render-content";
import { buildResumeRenderModel } from "@/lib/export/resume-render-model";
import { getDefaultLayoutConfig, getFontStack, getTypographyConfig } from "@/lib/templates/resume-templates";
import { cn } from "@/lib/utils";
import type { FinalResume, ResumeLayoutConfig } from "@/types/resume";

interface ResumeTemplateViewProps {
  resume: FinalResume;
  layoutConfig?: ResumeLayoutConfig;
  className?: string;
}

export function ResumeTemplateView({ resume, layoutConfig, className }: ResumeTemplateViewProps) {
  const model = buildResumeRenderModel(resume, layoutConfig ?? getDefaultLayoutConfig());
  const body = getTypographyConfig(model.layout).body;
  const style = {
    fontFamily: getFontStack(body.fontFamily),
    fontSize: `${body.fontSize}pt`,
    lineHeight: model.layout.lineHeight,
    "--resume-accent": model.layout.accentColor,
    "--resume-section-gap": `${model.layout.sectionSpacing}px`,
  } as CSSProperties;

  return <article
    className={cn("resume-document bg-white text-neutral-900", `resume-template-${model.layout.templateId}`, className)}
    style={style}
    data-template={model.layout.templateId}
  >
    <ResumeRenderHeader model={model} />
    <ResumeRenderBlocks blocks={model.blocks} layout={model.layout} tokens={model.tokens} />
  </article>;
}
