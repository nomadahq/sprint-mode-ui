// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const tokens = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");

describe("product token contracts", () => {
  it("defines the complete Hub accent contract used by shared controls", () => {
    const hubRule = tokens.match(/\[data-product="hub"\]\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(hubRule).toMatch(/--accent:\s*#4f5d93/);
    expect(hubRule).toMatch(/--accent-hover:/);
    expect(hubRule).toMatch(/--accent-foreground:/);
  });
});
