import { cn } from "@/lib/utils";
import type { ResumeRenderBlock, ResumeRenderModel, ResumeTypographyTokens } from "@/lib/export/resume-render-model";
import type { ResumeFormattedText, ResumeLayoutConfig } from "@/types/resume";
import { getFontStack, getTypographyConfig } from "@/lib/templates/resume-templates";

export function ResumeRenderHeader({ model }: { model: ResumeRenderModel }) {
  const nameStyle = model.typography.h1;
  const contactStyle = model.typography.body;
  return <div data-resume-header>
    <header className={model.layout.templateId === "modern-clean" ? "resume-header text-left" : "resume-header text-center"}>
      <h2 className="font-semibold" style={{ fontFamily: getFontStack(nameStyle.fontFamily), fontSize: `${nameStyle.fontSize}pt`, color: model.layout.templateId === "modern-clean" ? nameStyle.color : undefined }}>{model.name}</h2>
      {model.contactLine && <p className="mt-1" style={{ fontFamily: getFontStack(contactStyle.fontFamily), fontSize: `${contactStyle.fontSize}pt`, color: contactStyle.color }}>{model.contactLine}</p>}
    </header>
    <div className="resume-header-rule h-px" style={{ marginTop: `${model.tokens.headerRuleBeforePt}pt`, backgroundColor: model.layout.accentColor }} />
  </div>;
}

function formattedRuns(value: ResumeFormattedText | undefined, fallback: string) {
  const runs = value?.runs?.length ? value.runs : [{ text: fallback }];
  return runs.map((run, index) => <span key={`${run.text}-${index}`} className={run.bold ? "font-bold" : undefined} style={{ fontStyle: run.italic ? "italic" : undefined, textDecoration: run.underline ? "underline" : undefined }}>{run.text}</span>);
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
  const typography = getTypographyConfig(layout);
  const level = block.kind === "section-heading" ? typography.h2 : block.kind === "experience-heading" ? typography.h3 : block.sectionId === "jobIntent" ? typography.h4 : block.sectionId === "summary" ? typography.h5 : block.sectionId === "coreSkills" ? typography.h6 : block.kind === "paragraph" ? typography.h7 : typography.body;
  const textStyle = { fontFamily: getFontStack(level.fontFamily), fontSize: `${level.fontSize}pt`, color: level.color };
  if (block.kind === "section-heading") return <div data-resume-block-id={block.id} data-resume-block-kind={block.kind} style={{ paddingTop: `${tokens.sectionSpacingPt}pt`, paddingBottom: `${tokens.headingAfterPt}pt` }}>
    <h3
      className={cn("font-semibold", layout.templateId === "modern-clean" ? "border-l-[3px] pl-2 text-[1.05em]" : "border-b pb-1 text-[0.95em] tracking-wide")}
      style={{ ...textStyle, borderColor: layout.accentColor }}
    >{block.text}</h3>
  </div>;
  if (block.kind === "experience-heading") return <div data-resume-block-id={block.id} data-resume-block-kind={block.kind} style={{ paddingTop: `${tokens.experienceBeforePt}pt`, paddingBottom: `${tokens.experienceAfterPt}pt` }}>
    <div className="flex items-baseline justify-between gap-3 font-medium" style={textStyle}>
      <p>{block.text}</p><span className="text-[0.88em] font-normal opacity-70">{block.secondaryText}</span>
    </div>
  </div>;
  if (block.kind === "bullet") {
    const bullet = layout.bulletStyle === "dash" ? "-" : layout.bulletStyle === "square" ? "▪" : "•";
    const formatting = block.formattedText;
    return <div data-resume-block-id={block.id} data-resume-block-kind={block.kind} style={{ paddingBottom: `${tokens.bulletAfterPt}pt` }}>
      <p className="flex gap-2" style={{ ...textStyle, textAlign: formatting?.alignment, textIndent: `${formatting?.firstLineIndent ?? 0}em`, paddingLeft: `${formatting?.hangingIndent ?? 0}em` }}><span aria-hidden="true">{bullet}</span><span>{formattedRuns(formatting, block.text)}</span></p>
    </div>;
  }
  if (block.kind === "ordered-item") return <div data-resume-block-id={block.id} data-resume-block-kind={block.kind} style={{ paddingBottom: `${tokens.bulletAfterPt}pt` }}>
    <p className="grid grid-cols-[1.5rem_minmax(0,1fr)]" style={textStyle}><span className="text-right font-medium" aria-hidden="true">{block.ordinal}.</span><span className="pl-2">{formattedRuns(block.formattedText, block.text)}</span></p>
  </div>;
  return <div data-resume-block-id={block.id} data-resume-block-kind={block.kind} style={{ paddingBottom: `${tokens.paragraphAfterPt}pt` }}>
    <p style={{ ...textStyle, textAlign: block.formattedText?.alignment, textIndent: `${block.formattedText?.firstLineIndent ?? 0}em`, paddingLeft: `${block.formattedText?.hangingIndent ?? 0}em` }}>{formattedRuns(block.formattedText, block.text)}</p>
  </div>;
}
