// @vitest-environment node
import { readFileSync, existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

// FEAT-2997: the '@sprintmode/ui/site' entry must build to a chunk with NO
// session code, so a marketing site that imports it never pulls the auth bundle.
// This asserts it at the package boundary by grepping site.js and every dist
// chunk it transitively imports (SiteHeader lands in a shared chunk). The
// sm-capital adoption carries the consumer-side chunk grep as its own evidence.

const distDir = new URL("../../dist/", import.meta.url);

function readSiteSubgraph() {
  const seen = new Set();
  const out = [];
  const queue = ["site.js"];
  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    seen.add(rel);
    const src = readFileSync(new URL(rel, distDir), "utf8");
    out.push(src);
    const re = /(?:import|export)[^'"]*from\s*["'](\.\/[^"']+)["']/g;
    let m;
    while ((m = re.exec(src))) queue.push(m[1].replace(/^\.\//, ""));
  }
  return out.join("\n");
}

describe("committed /site distribution", () => {
  it("built dist/site.js exists", () => {
    expect(existsSync(new URL("site.js", distDir))).toBe(true);
  });

  it("contains no session code across the whole /site subgraph", () => {
    const src = readSiteSubgraph();
    for (const marker of [
      "getSession",
      "SessionContext",
      "/api/auth/me",
      "clearSession",
      "AccountSwitcher",
      "useSession",
    ]) {
      expect(src.includes(marker), `/site subgraph must not contain "${marker}"`).toBe(false);
    }
  });
});
