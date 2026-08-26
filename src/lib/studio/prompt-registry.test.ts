import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertPromptRegistry, PROMPT_REGISTRY } from "@/lib/studio/prompt-registry";
import { CALLABLE_PROMPT_IDS } from "@/lib/studio/prompt-types";
import { PROMPT_BASELINE } from "@/config/prompt-baseline";
import { createHash } from "node:crypto";

describe("prompt registry", () => {
  it("has unique definitions for every callable prompt", () => {
    expect(() => assertPromptRegistry()).not.toThrow();
    const callable = PROMPT_REGISTRY.filter((item) => item.callable).map((item) => item.id);
    expect(callable).toEqual(expect.arrayContaining([...CALLABLE_PROMPT_IDS]));
    expect(new Set(callable).size).toBe(callable.length);
  });

  it("points only to existing source files and declares evaluation coverage", () => {
    for (const definition of PROMPT_REGISTRY) {
      expect(definition.sourceRefs.length).toBeGreaterThan(0);
      expect(definition.evaluation.suites.length).toBeGreaterThan(0);
      for (const sourceRef of definition.sourceRefs) {
        expect(existsSync(path.resolve(process.cwd(), sourceRef.path)), `${definition.id}: ${sourceRef.path}`).toBe(true);
      }
    }
  });

  it("matches the approved V1.10.0 prompt manifest", () => {
    expect(createHash("sha256").update(JSON.stringify(PROMPT_REGISTRY)).digest("hex")).toBe(PROMPT_BASELINE.manifestHash);
  });
});
