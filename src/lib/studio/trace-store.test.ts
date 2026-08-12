import { describe, expect, it } from "vitest";
import { redactTraceValue } from "@/lib/studio/trace-store";

describe("studio trace privacy", () => {
  it("redacts credentials recursively", () => {
    expect(redactTraceValue({ apiKey: "secret", nested: { Authorization: "Bearer x", value: 1 } })).toEqual({ apiKey: "[REDACTED]", nested: { Authorization: "[REDACTED]", value: 1 } });
  });
});
