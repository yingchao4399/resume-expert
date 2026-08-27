/** Whole-document limits are deliberately separate from per-request batch limits. */
export const JD_MAX_REQUIREMENTS = 120;
export const JD_MAX_CANDIDATES = 240;
export const JD_CAPACITY_MESSAGE = "独立岗位要求超过 120 条，请拆分 JD 后分别分析；系统不会删除或截断要求。";
export const JD_CANDIDATE_MESSAGE = "原子候选超过 240 条，请拆分 JD；已有材料未改变。";
export const JD_BATCH_SIZE = 16;
export const MATCH_BATCH_SIZE = 12;
export const INTERVIEW_BATCH_SIZE = 5;
export const JD_TASK_TIMEOUT_MS = 360_000;
export const JD_CLIENT_TIMEOUT_MS = JD_TASK_TIMEOUT_MS + 5_000;
