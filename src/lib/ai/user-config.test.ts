import { describe, expect, it } from "vitest";
import {
  getAPIKeyValidationError,
  isValidAPIKey,
  normalizeAPIKey,
} from "@/lib/ai/user-config";

describe("API Key validation", () => {
  it("normalizes a pasted Bearer prefix and quotes", () => {
    expect(normalizeAPIKey('Bearer "sk-abcdef1234567890"')).toBe(
      "sk-abcdef1234567890"
    );
  });

  it("rejects Chinese labels and whitespace before an HTTP header is built", () => {
    expect(isValidAPIKey("【DeepSeek API Key】 示例内容")).toBe(false);
    expect(getAPIKeyValidationError("【DeepSeek API Key】 示例内容")).toContain(
      "不能包含中文"
    );
  });

  it("accepts a printable ASCII provider key", () => {
    expect(isValidAPIKey("sk-abcdef1234567890")).toBe(true);
  });
});
