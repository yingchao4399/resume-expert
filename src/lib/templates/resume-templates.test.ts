import { describe, expect, it } from "vitest";
import {
  getDefaultLayoutConfig,
  RESUME_SECTION_ORDER,
  sanitizeLayoutConfig,
} from "@/lib/templates/resume-templates";

describe("resume templates", () => {
  it("provides independent defaults for every document", () => {
    const first = getDefaultLayoutConfig("modern-clean");
    const second = getDefaultLayoutConfig("modern-clean");
    first.sectionOrder.reverse();
    expect(second.sectionOrder).toEqual(RESUME_SECTION_ORDER);
  });

  it("restores missing sections and clamps unsafe values", () => {
    const config = sanitizeLayoutConfig({
      ...getDefaultLayoutConfig("ats-classic"),
      baseFontSize: 50,
      pageMargin: 2,
      sectionOrder: ["education"],
    });
    expect(config.baseFontSize).toBe(12);
    expect(config.pageMargin).toBe(10);
    expect(config.sectionOrder).toEqual([
      "education",
      ...RESUME_SECTION_ORDER.filter((item) => item !== "education"),
    ]);
  });

  it("rejects low contrast accent colors", () => {
    const config = sanitizeLayoutConfig({
      ...getDefaultLayoutConfig("modern-clean"),
      accentColor: "#FFFFFF",
    });
    expect(config.accentColor).toBe("#1D4ED8");
  });
});
