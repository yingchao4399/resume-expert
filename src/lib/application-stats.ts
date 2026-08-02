import type { JobApplication, JobApplicationStatus } from "@/types/resume";

export interface ApplicationStats {
  total: number;
  counts: Record<JobApplicationStatus, number>;
  interviewRate: number;
  offerRate: number;
}

export const JOB_APPLICATION_STATUSES: JobApplicationStatus[] = [
  "准备中", "已投递", "笔试", "面试", "Offer", "结束",
];

export function calculateApplicationStats(applications: JobApplication[]): ApplicationStats {
  const counts = Object.fromEntries(JOB_APPLICATION_STATUSES.map((status) => [status, 0])) as Record<JobApplicationStatus, number>;
  applications.forEach((item) => { counts[item.status] += 1; });
  const submitted = applications.filter((item) => item.status !== "准备中");
  const interview = submitted.filter((item) => item.status === "面试" || item.status === "Offer").length;
  const offers = submitted.filter((item) => item.status === "Offer").length;
  return {
    total: applications.length,
    counts,
    interviewRate: submitted.length ? Math.round((interview / submitted.length) * 100) : 0,
    offerRate: submitted.length ? Math.round((offers / submitted.length) * 100) : 0,
  };
}
