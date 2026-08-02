import type {
  ResumeLayoutConfig,
  ResumeSectionId,
  ResumeTemplateId,
} from "@/types/resume";

export const RESUME_SECTION_ORDER: ResumeSectionId[] = [
  "jobIntent",
  "summary",
  "coreSkills",
  "workExperience",
  "projectExperience",
  "skillsAndTools",
  "education",
];

export const RESUME_SECTION_LABELS: Record<ResumeSectionId, string> = {
  jobIntent: "求职意向",
  summary: "职业摘要",
  coreSkills: "核心能力",
  workExperience: "工作经历",
  projectExperience: "项目经历",
  skillsAndTools: "技能工具",
  education: "教育背景",
};

export interface ResumeTemplateDefinition {
  id: ResumeTemplateId;
  name: string;
  description: string;
  defaults: ResumeLayoutConfig;
}

const common = {
  sectionOrder: RESUME_SECTION_ORDER,
  hiddenSections: [],
  bulletStyle: "disc" as const,
};

export const RESUME_TEMPLATES: ResumeTemplateDefinition[] = [
  {
    id: "ats-classic",
    name: "ATS 经典",
    description: "居中姓名、传统分隔线，适合正式岗位。",
    defaults: {
      ...common,
      templateId: "ats-classic",
      fontFamily: "microsoft-yahei",
      baseFontSize: 10,
      lineHeight: 1.5,
      sectionSpacing: 18,
      pageMargin: 16,
      accentColor: "#525252",
    },
  },
  {
    id: "modern-clean",
    name: "现代简洁",
    description: "左对齐标题和克制强调色，适合互联网与产品岗位。",
    defaults: {
      ...common,
      templateId: "modern-clean",
      fontFamily: "arial",
      baseFontSize: 10,
      lineHeight: 1.45,
      sectionSpacing: 16,
      pageMargin: 16,
      accentColor: "#1D4ED8",
    },
  },
  {
    id: "compact-professional",
    name: "紧凑专业",
    description: "更高信息密度，适合经历较多或希望控制页数的简历。",
    defaults: {
      ...common,
      templateId: "compact-professional",
      fontFamily: "calibri",
      baseFontSize: 9,
      lineHeight: 1.3,
      sectionSpacing: 10,
      pageMargin: 12,
      accentColor: "#374151",
      bulletStyle: "dash",
    },
  },
];

export function getTemplateDefinition(id: ResumeTemplateId): ResumeTemplateDefinition {
  return RESUME_TEMPLATES.find((template) => template.id === id) ?? RESUME_TEMPLATES[0];
}

export function getDefaultLayoutConfig(id: ResumeTemplateId = "ats-classic"): ResumeLayoutConfig {
  return structuredClone(getTemplateDefinition(id).defaults);
}

export function sanitizeLayoutConfig(value?: Partial<ResumeLayoutConfig> | null): ResumeLayoutConfig {
  const templateId = RESUME_TEMPLATES.some((template) => template.id === value?.templateId)
    ? value!.templateId!
    : "ats-classic";
  const defaults = getDefaultLayoutConfig(templateId);
  const order = Array.from(
    new Set([...(value?.sectionOrder ?? []), ...RESUME_SECTION_ORDER])
  ).filter((item): item is ResumeSectionId => RESUME_SECTION_ORDER.includes(item as ResumeSectionId));
  const hidden = (value?.hiddenSections ?? []).filter((item) => order.includes(item));
  const accent = normalizeColor(value?.accentColor);

  return {
    ...defaults,
    ...value,
    templateId,
    baseFontSize: clamp(value?.baseFontSize, 8.5, 12, defaults.baseFontSize),
    lineHeight: clamp(value?.lineHeight, 1.15, 1.7, defaults.lineHeight),
    sectionSpacing: clamp(value?.sectionSpacing, 6, 24, defaults.sectionSpacing),
    pageMargin: clamp(value?.pageMargin, 10, 24, defaults.pageMargin),
    accentColor: accent && contrastAgainstWhite(accent) >= 4.5 ? accent : defaults.accentColor,
    sectionOrder: order,
    hiddenSections: Array.from(new Set(hidden)),
  };
}

export function getFontStack(font: ResumeLayoutConfig["fontFamily"]): string {
  const stacks = {
    "microsoft-yahei": '"Microsoft YaHei", "PingFang SC", sans-serif',
    songti: 'SimSun, "Songti SC", serif',
    arial: 'Arial, "Microsoft YaHei", sans-serif',
    calibri: 'Calibri, "Microsoft YaHei", sans-serif',
  };
  return stacks[font];
}

export function getDocxFont(font: ResumeLayoutConfig["fontFamily"]): string {
  return {
    "microsoft-yahei": "Microsoft YaHei",
    songti: "SimSun",
    arial: "Arial",
    calibri: "Calibri",
  }[font];
}

function clamp(value: number | undefined, min: number, max: number, fallback: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value! : fallback));
}

function normalizeColor(value?: string): string | null {
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) return null;
  return value.toUpperCase();
}

function contrastAgainstWhite(hex: string): number {
  const rgb = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = rgb.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return 1.05 / (luminance + 0.05);
}
