import type { ResumeRenderModel } from "@/lib/export/resume-render-model";
import type {
  ResumeLayoutConfig,
  ResumePaginationPage,
  ResumePaginationPlan,
} from "@/types/resume";

export const RESUME_PAGE_COMPATIBILITY_RATIO = 0.94;

export interface ResumePaginationMeasurements {
  pageContentHeight: number;
  headerHeight: number;
  blockHeights: Record<string, number>;
}

export function createResumePaginationPlan(
  model: ResumeRenderModel,
  measurements: ResumePaginationMeasurements,
  compatibilityRatio = RESUME_PAGE_COMPATIBILITY_RATIO,
): ResumePaginationPlan {
  const pageBudget = Math.max(1, measurements.pageContentHeight * compatibilityRatio);
  const pages: ResumePaginationPage[] = [];
  let overflow = false;
  let current = createPage(0, true, Math.max(1, pageBudget - measurements.headerHeight));

  const pushPage = () => {
    pages.push(current);
    current = createPage(pages.length, false, pageBudget);
  };

  for (let index = 0; index < model.blocks.length; index += 1) {
    const block = model.blocks[index];
    const height = normalizeHeight(measurements.blockHeights[block.id]);
    const next = model.blocks[index + 1];
    const nextHeight = next ? normalizeHeight(measurements.blockHeights[next.id]) : 0;
    const keepWithNext = block.kind === "section-heading" || block.kind === "experience-heading";
    const required = height + (keepWithNext ? nextHeight : 0);

    if (current.blockIds.length > 0 && current.usedHeight + required > current.availableHeight) {
      pushPage();
    }
    if (keepWithNext && next && required > current.availableHeight) {
      current.blockIds.push(block.id, next.id);
      current.usedHeight += required;
      overflow = true;
      index += 1;
      continue;
    }
    if (height > current.availableHeight) overflow = true;
    current.blockIds.push(block.id);
    current.usedHeight += height;
  }

  if (current.blockIds.length || pages.length === 0) pages.push(current);
  return {
    contentHash: hashResumeRenderModel(model),
    pageCount: pages.length,
    pages,
    overflow,
    compatibilityRatio,
    measuredAt: new Date().toISOString(),
  };
}

export function hashResumeRenderModel(model: ResumeRenderModel): string {
  const serialized = JSON.stringify({
    name: model.name,
    contactLine: model.contactLine,
    blocks: model.blocks,
    layout: model.layout,
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `resume-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function isPaginationPlanCurrent(plan: ResumePaginationPlan | null | undefined, model: ResumeRenderModel): plan is ResumePaginationPlan {
  return Boolean(plan && plan.contentHash === hashResumeRenderModel(model));
}

export function buildOnePageFitCandidates(layout: ResumeLayoutConfig): ResumeLayoutConfig[] {
  const candidates: ResumeLayoutConfig[] = [];
  let current = { ...layout };
  const add = (patch: Partial<ResumeLayoutConfig>) => {
    current = { ...current, ...patch };
    candidates.push(current);
  };

  for (let value = Math.floor(layout.sectionSpacing - 1); value >= 6; value -= 1) add({ sectionSpacing: value });
  for (let value = Math.floor(current.pageMargin - 1); value >= 10; value -= 1) add({ pageMargin: value });
  for (let value = roundStep(current.lineHeight - 0.05, 0.05); value >= 1.15 - Number.EPSILON; value = roundStep(value - 0.05, 0.05)) {
    add({ lineHeight: Math.max(1.15, value) });
  }
  for (let value = roundStep(current.baseFontSize - 0.5, 0.5); value >= 8.5 - Number.EPSILON; value = roundStep(value - 0.5, 0.5)) {
    add({ baseFontSize: Math.max(8.5, value) });
  }
  return candidates;
}

function createPage(index: number, includeHeader: boolean, availableHeight: number): ResumePaginationPage {
  return { index, includeHeader, blockIds: [], usedHeight: 0, availableHeight };
}

function normalizeHeight(value: number | undefined): number {
  return Number.isFinite(value) && value! > 0 ? value! : 1;
}

function roundStep(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(2));
}
