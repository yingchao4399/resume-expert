import { describe, expect, it } from "vitest";
import {
  getDefaultLayoutConfig,
  getTypographyConfig,
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

  it("keeps independent body and heading typography within safe bounds", () => {
    const config = sanitizeLayoutConfig({
      ...getDefaultLayoutConfig("ats-classic"),
      typography: {
        body: { fontFamily: "songti", fontSize: 7, color: "#FFFFFF" },
        h1: { fontFamily: "arial", fontSize: 40, color: "#222222" },
        h7: { fontFamily: "calibri", fontSize: 14, color: "#222222" },
      },
    });
    const typography = getTypographyConfig(config);
    expect(typography.body).toMatchObject({ fontFamily: "songti", fontSize: 8.5 });
    expect(typography.h1.fontSize).toBe(36);
    expect(typography.h7).toMatchObject({ fontFamily: "calibri", fontSize: 14 });
    expect(typography.body.color).not.toBe("#FFFFFF");
  });
});
