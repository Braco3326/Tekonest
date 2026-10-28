import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { serveStatic } from "./static-server.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

test("two static servers can run at once on different free ports", async () => {
  const a = await serveStatic(ROOT);
  const b = await serveStatic(ROOT);
  try {
    assert.notEqual(a.port, b.port);
    for (const s of [a, b]) {
      const res = await fetch(`${s.url}/index.html`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type"), /^text\/html/);
    }
  } finally {
    await a.close();
    await b.close();
  }
});

test("a missing file answers 404 and a directory serves its index.html", async () => {
  const s = await serveStatic(ROOT);
  try {
    assert.equal((await fetch(`${s.url}/nope.html`)).status, 404);
    assert.equal((await fetch(`${s.url}/tekpractice/jouer/`)).status, 200);
  } finally {
    await s.close();
  }
});
