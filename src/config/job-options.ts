import type { CompanyType, JobStage } from "@/types/resume";

export const COMPANY_TYPES = ["大厂", "中型公司", "创业公司", "外企", "国企"] as const satisfies readonly CompanyType[];
export const JOB_STAGES = ["校招", "社招-初级", "社招-中级", "社招-高级", "转行"] as const satisfies readonly JobStage[];

export function isCompanyType(value: string): value is CompanyType {
  return COMPANY_TYPES.includes(value as CompanyType);
}

export function isJobStage(value: string): value is JobStage {
  return JOB_STAGES.includes(value as JobStage);
}
