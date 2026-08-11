import { describe, expect, it } from "vitest";
import {
  getAPIKeyValidationError,
  isValidAPIKey,
  normalizeAPIKey,
  validateAIConfigFields,
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

  it("validates provider, model and Base URL before saving", () => {
    const valid = { provider: "deepseek", model: "deepseek-chat", baseUrl: "https://api.deepseek.com/v1", apiKey: "sk-abcdef1234567890", useMock: false };
    expect(validateAIConfigFields(valid)).toBeNull();
    expect(validateAIConfigFields({ ...valid, baseUrl: "not-a-url" })).toContain("Base URL");
    expect(validateAIConfigFields({ ...valid, model: "" })).toContain("模型名称");
    expect(validateAIConfigFields({ ...valid, provider: "" })).toContain("提供商");
  });
});
