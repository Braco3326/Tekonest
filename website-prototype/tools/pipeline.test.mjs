import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Every file under assets/ plus the root pages, as { relative path: sha1 of the content with LF endings }. */
function snapshot() {
  const out = {};
  const add = (file) => {
    const bytes = readFileSync(file);
    const body = /\.(html|css|js|svg)$/.test(file) ? Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n")) : bytes;
    out[relative(ROOT, file).replace(/\\/g, "/")] = createHash("sha1").update(body).digest("hex");
  };
  const walk = (dir) => { for (const name of readdirSync(dir)) { const p = join(dir, name); statSync(p).isDirectory() ? walk(p) : add(p); } };
  walk(join(ROOT, "assets"));
  for (const name of readdirSync(ROOT)) if (name.endsWith(".html")) add(join(ROOT, name));
  return out;
}

/** mtime of every file snapshot() covers. */
function mtimes() {
  const out = {};
  const walk = (dir) => { for (const name of readdirSync(dir)) { const p = join(dir, name); statSync(p).isDirectory() ? walk(p) : (out[relative(ROOT, p)] = statSync(p).mtimeMs); } };
  walk(join(ROOT, "assets"));
  for (const name of readdirSync(ROOT)) if (name.endsWith(".html")) out[name] = statSync(join(ROOT, name)).mtimeMs;
  return out;
}

test("the page build never rewrites an up-to-date file (other tests read these files in parallel)", { timeout: 120000 }, () => {
  const before = mtimes();
  for (const tool of ["build.mjs"]) {
    execFileSync(process.execPath, [join(ROOT, "tools", tool)], { cwd: ROOT, stdio: "pipe" });
  }
  const after = mtimes();
  const touched = Object.keys(before).filter((f) => before[f] !== after[f]);
  assert.deepEqual(touched, [], `rewritten although unchanged: ${touched.join(", ")}`);
});

test("the page build regenerates nothing new", { timeout: 120000 }, () => {
  const before = snapshot();
  for (const tool of ["build.mjs"]) {
    execFileSync(process.execPath, [join(ROOT, "tools", tool)], { cwd: ROOT, stdio: "pipe" });
  }
  const after = snapshot();
  const changed = Object.keys({ ...before, ...after }).filter((f) => before[f] !== after[f]);
  assert.deepEqual(changed, [], `a generated file is stale: ${changed.join(", ")}. Run npm run build and commit.`);
});
