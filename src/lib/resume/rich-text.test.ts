import { describe, expect, it } from "vitest";
import {
  applyInlineFormat,
  clearRichTextFormatting,
  normalizeRichText,
  plainTextToRichText,
  richTextToSafeHtml,
  setParagraphLayout,
} from "@/lib/resume/rich-text";

describe("resume rich text", () => {
  it("normalizes paragraph controls and preserves inline marks", () => {
    const value = normalizeRichText({
      runs: [{ text: "重点", bold: true }, { text: "说明", italic: true, underline: true }],
      alignment: "justify",
      firstLineIndent: 40,
      hangingIndent: -4,
    });
    expect(value).toMatchObject({ alignment: "justify", firstLineIndent: 24, hangingIndent: -4 });
    expect(richTextToSafeHtml(value)).toContain("<strong>重点</strong>");
    expect(richTextToSafeHtml(value)).toContain("<u><em>说明</em></u>");
  });

  it("escapes user text instead of interpreting HTML", () => {
    const value = plainTextToRichText("<script>alert(1)</script>");
    expect(richTextToSafeHtml(value)).not.toContain("<script>");
    expect(richTextToSafeHtml(value)).toContain("&lt;script&gt;");
  });

  it("applies inline marks to an exact character range without changing text", () => {
    const source = plainTextToRichText("负责产品规划与交付");
    const result = applyInlineFormat(source, 2, 6, "bold");
    expect(result.runs).toEqual([
      { text: "负责" },
      { text: "产品规划", bold: true },
      { text: "与交付" },
    ]);
    expect(result.runs.map((run) => run.text).join("")).toBe("负责产品规划与交付");
  });

  it("updates paragraph layout and can clear all formatting", () => {
    const formatted = setParagraphLayout(plainTextToRichText("段落"), {
      alignment: "right",
      firstLineIndent: 1,
      hangingIndent: 1.5,
    });
    expect(formatted).toMatchObject({ alignment: "right", firstLineIndent: 1, hangingIndent: 1.5 });
    expect(clearRichTextFormatting({ ...formatted, runs: [{ text: "段落", italic: true }] })).toEqual(plainTextToRichText("段落"));
  });
});
