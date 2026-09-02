import { describe, expect, it } from "vitest";
import { createAppErrorPayload, redactDiagnosticValue } from "@/lib/errors/app-error";

describe("application error protocol", () => {
  it("returns retry metadata without leaking credentials or resume content", () => {
    const payload = createAppErrorPayload(new Error("provider timeout"), {
      code: "MODEL_TIMEOUT",
      category: "timeout",
      retryable: true,
      requestId: "request-1",
      userMessage: "模型响应超时，请重试。",
      diagnostic: {
        apiKey: "secret-key",
        Authorization: "Bearer secret",
        originalResume: "张三的真实简历",
        stage: "JD 需求解析",
      },
    });

    expect(payload).toMatchObject({ code: "MODEL_TIMEOUT", category: "timeout", retryable: true, requestId: "request-1" });
    expect(JSON.stringify(payload)).not.toContain("secret-key");
    expect(JSON.stringify(payload)).not.toContain("张三的真实简历");
    expect(payload.diagnostic).toEqual({ apiKey: "[REDACTED]", Authorization: "[REDACTED]", originalResume: "[REDACTED]", stage: "JD 需求解析" });
  });

  it("redacts nested sensitive fields", () => {
    expect(redactDiagnosticValue({ body: { jobDescription: "private", model: "qwen" } })).toEqual({ body: { jobDescription: "[REDACTED]", model: "qwen" } });
  });
});
