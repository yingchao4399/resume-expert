import { cn } from "@/lib/utils";
import type { ResumeRenderBlock, ResumeRenderModel, ResumeTypographyTokens } from "@/lib/export/resume-render-model";
import type { ResumeLayoutConfig } from "@/types/resume";

export function ResumeRenderHeader({ model }: { model: ResumeRenderModel }) {
  return <div data-resume-header>
    <header className={model.layout.templateId === "modern-clean" ? "resume-header text-left" : "resume-header text-center"}>
      <h2 className="font-semibold" style={{ fontSize: `${model.tokens.nameFontSizePt}pt`, color: model.layout.templateId === "modern-clean" ? model.layout.accentColor : undefined }}>{model.name}</h2>
      {model.contactLine && <p className="mt-1 text-neutral-600" style={{ fontSize: `${model.tokens.contactFontSizePt}pt` }}>{model.contactLine}</p>}
    </header>
    <div className="resume-header-rule h-px" style={{ marginTop: `${model.tokens.headerRuleBeforePt}pt`, backgroundColor: model.layout.accentColor }} />
  </div>;
}

export function ResumeRenderBlocks({ blocks, layout, tokens, withTopSpacing = true }: {
  blocks: ResumeRenderBlock[];
  layout: ResumeLayoutConfig;
  tokens: ResumeTypographyTokens;
  withTopSpacing?: boolean;
}) {
  return <div className="resume-blocks" data-resume-blocks style={{ paddingTop: withTopSpacing ? `${tokens.headerToContentPt}pt` : 0 }}>
    {blocks.map((block) => <ResumeRenderBlockView key={block.id} block={block} layout={layout} tokens={tokens} />)}
  </div>;
}

function ResumeRenderBlockView({ block, layout, tokens }: { block: ResumeRenderBlock; layout: ResumeLayoutConfig; tokens: ResumeTypographyTokens }) {
  if (block.kind === "section-heading") return <div data-resume-block-id={block.id} data-resume-block-kind={block.kind} style={{ paddingTop: `${tokens.sectionSpacingPt}pt`, paddingBottom: `${tokens.headingAfterPt}pt` }}>
    <h3
      className={cn("font-semibold", layout.templateId === "modern-clean" ? "border-l-[3px] pl-2 text-[1.05em]" : "border-b pb-1 text-[0.95em] tracking-wide")}
      style={{ borderColor: layout.accentColor, color: layout.accentColor, fontSize: `${tokens.headingFontSizePt}pt` }}
    >{block.text}</h3>
  </div>;
  if (block.kind === "experience-heading") return <div data-resume-block-id={block.id} data-resume-block-kind={block.kind} style={{ paddingTop: `${tokens.experienceBeforePt}pt`, paddingBottom: `${tokens.experienceAfterPt}pt` }}>
    <div className="flex items-baseline justify-between gap-3 font-medium">
      <p>{block.text}</p><span className="text-[0.88em] font-normal text-neutral-500">{block.secondaryText}</span>
    </div>
  </div>;
  if (block.kind === "bullet") {
    const bullet = layout.bulletStyle === "dash" ? "-" : layout.bulletStyle === "square" ? "▪" : "•";
    return <div data-resume-block-id={block.id} data-resume-block-kind={block.kind} style={{ paddingBottom: `${tokens.bulletAfterPt}pt` }}>
      <p className="flex gap-2 text-neutral-700"><span aria-hidden="true">{bullet}</span><span>{block.text}</span></p>
    </div>;
  }
  return <div data-resume-block-id={block.id} data-resume-block-kind={block.kind} style={{ paddingBottom: `${tokens.paragraphAfterPt}pt` }}>
    <p className="text-neutral-700">{block.text}</p>
  </div>;
}
