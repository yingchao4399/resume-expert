import { describe, expect, it } from "vitest";
import { parseByteRange } from "@/lib/recordings";

describe("recording byte ranges", () => {
  it("supports seeking ranges and suffix ranges", () => {
    expect(parseByteRange("bytes=100-199", 1000)).toEqual({ start: 100, end: 199 });
    expect(parseByteRange("bytes=900-", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseByteRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
  });

  it("rejects invalid or unsatisfiable ranges", () => {
    expect(parseByteRange("bytes=1000-", 1000)).toBeNull();
    expect(parseByteRange("items=0-1", 1000)).toBeNull();
  });
});
