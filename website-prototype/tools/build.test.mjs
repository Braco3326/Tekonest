import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, frenchTypography, NNBSP } from "./build.mjs";

const ROOT = new URL("../", import.meta.url);
const normalise = (text) => text.replace(/\r\n/g, "\n");

test("Node build output equals the committed pages", () => {
  const outDir = mkdtempSync(join(tmpdir(), "tekonest-build-"));
  const built = build({ outDir });
  const fragments = readdirSync(new URL("src/pages/", ROOT)).filter((f) => f.endsWith(".html")).sort();
  assert.deepEqual([...built].sort(), fragments);
  for (const name of fragments) {
    const fresh = normalise(readFileSync(join(outDir, name), "utf8"));
    const committed = normalise(readFileSync(new URL(name, ROOT), "utf8"));
    assert.equal(fresh, committed, `${name} differs from the committed page`);
  }
});

test("frenchTypography puts a narrow no-break space before ; : ! ? and around « »", () => {
  assert.equal(NNBSP, " ");
  assert.equal(
    frenchTypography("Bonjour : « oui » ?"),
    "Bonjour : « oui » ?"
  );
});
