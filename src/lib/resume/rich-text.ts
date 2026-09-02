import type { ResumeFormattedText, ResumeTextAlignment, ResumeTextRun } from "@/types/resume";

export const DEFAULT_PARAGRAPH_FORMAT: Omit<ResumeFormattedText, "runs"> = {
  alignment: "left",
  firstLineIndent: 0,
  hangingIndent: 0,
};

export function plainTextToRichText(text: string, format: Partial<Omit<ResumeFormattedText, "runs">> = {}): ResumeFormattedText {
  return {
    runs: text ? [{ text }] : [],
    ...DEFAULT_PARAGRAPH_FORMAT,
    ...format,
  };
}

export function normalizeRichText(value: ResumeFormattedText | null | undefined, fallbackText = ""): ResumeFormattedText {
  const runs = (value?.runs ?? []).map((run) => ({
    text: typeof run.text === "string" ? run.text : "",
    ...(run.bold ? { bold: true } : {}),
    ...(run.italic ? { italic: true } : {}),
    ...(run.underline ? { underline: true } : {}),
  })).filter((run) => run.text);
  return {
    runs: runs.length ? mergeAdjacentRuns(runs) : (fallbackText ? [{ text: fallbackText }] : []),
    alignment: isAlignment(value?.alignment) ? value!.alignment : "left",
    firstLineIndent: clampIndent(value?.firstLineIndent),
    hangingIndent: clampIndent(value?.hangingIndent),
  };
}

export function richTextToPlainText(value: ResumeFormattedText | null | undefined, fallbackText = ""): string {
  const text = (value?.runs ?? []).map((run) => run.text).join("");
  return text || fallbackText;
}

export function richTextToSafeHtml(value: ResumeFormattedText | null | undefined, fallbackText = ""): string {
  const normalized = normalizeRichText(value, fallbackText);
  return normalized.runs.map((run) => {
    let text = escapeHtml(run.text).replace(/\n/g, "<br>");
    if (run.bold) text = `<strong>${text}</strong>`;
    if (run.italic) text = `<em>${text}</em>`;
    if (run.underline) text = `<u>${text}</u>`;
    return text;
  }).join("");
}

/** Serialize only the small, safe formatting subset exposed by the editor toolbar. */
export function serializeEditableElement(element: HTMLElement): ResumeFormattedText {
  const runs: ResumeTextRun[] = [];
  const visit = (node: Node, marks: Pick<ResumeTextRun, "bold" | "italic" | "underline"> = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) runs.push({ text, ...marks });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const current = node as HTMLElement;
    const tag = current.tagName.toLowerCase();
    if (tag === "br") { runs.push({ text: "\n", ...marks }); return; }
    const next = {
      bold: marks.bold || tag === "b" || tag === "strong" || current.style.fontWeight === "bold",
      italic: marks.italic || tag === "i" || tag === "em" || current.style.fontStyle === "italic",
      underline: marks.underline || tag === "u" || current.style.textDecoration.includes("underline"),
    };
    current.childNodes.forEach((child) => visit(child, next));
  };
  element.childNodes.forEach((child) => visit(child));
  const style = window.getComputedStyle(element);
  return normalizeRichText({
    runs,
    alignment: isAlignment(style.textAlign) ? style.textAlign : "left",
    firstLineIndent: readIndent(element.dataset.firstLineIndent),
    hangingIndent: readIndent(element.dataset.hangingIndent),
  });
}

function mergeAdjacentRuns(runs: ResumeTextRun[]): ResumeTextRun[] {
  return runs.reduce<ResumeTextRun[]>((result, run) => {
    const previous = result.at(-1);
    const sameMarks = previous && Boolean(previous.bold) === Boolean(run.bold) && Boolean(previous.italic) === Boolean(run.italic) && Boolean(previous.underline) === Boolean(run.underline);
    if (previous && sameMarks) previous.text += run.text;
    else result.push({ ...run });
    return result;
  }, []);
}

function isAlignment(value: string | undefined): value is ResumeTextAlignment {
  return value === "left" || value === "center" || value === "right" || value === "justify";
}

function clampIndent(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(-24, Math.min(24, Number(value))) : 0;
}

function readIndent(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clampIndent(parsed) : 0;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
