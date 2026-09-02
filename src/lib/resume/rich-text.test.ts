import { describe, expect, it } from "vitest";
import { normalizeRichText, plainTextToRichText, richTextToSafeHtml } from "@/lib/resume/rich-text";

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
});
