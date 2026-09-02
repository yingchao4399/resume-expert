import { beforeEach, describe, expect, it } from "vitest";
import {
  beginTask,
  cancelTask,
  failTask,
  getTaskRunState,
  hasRunningTask,
  resetTaskRuntime,
} from "@/lib/tasks/task-runtime";

describe("task runtime isolation", () => {
  beforeEach(() => resetTaskRuntime());

  it("keeps an unrelated operation usable when one operation fails", () => {
    beginTask("doc-1", "jd-analysis");
    beginTask("doc-1", "export");
    failTask("doc-1", "jd-analysis", {
      code: "MODEL_TIMEOUT",
      category: "timeout",
      userMessage: "模型响应超时",
      retryable: true,
      requestId: "request-1",
    });

    expect(getTaskRunState("doc-1", "jd-analysis").status).toBe("failed");
    expect(getTaskRunState("doc-1", "export").status).toBe("running");
    expect(hasRunningTask("doc-1")).toBe(true);
  });

  it("cancels only the selected document operation", () => {
    beginTask("doc-1", "requirement-match");
    beginTask("doc-2", "requirement-match");

    cancelTask("doc-1", "requirement-match");

    expect(getTaskRunState("doc-1", "requirement-match").status).toBe("cancelled");
    expect(getTaskRunState("doc-2", "requirement-match").status).toBe("running");
  });
});
