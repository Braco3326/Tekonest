// Minimal static file server for local checks. Binds a free port so two runs never collide.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg",
  ".png": "image/png", ".json": "application/json", ".glb": "model/gltf-binary",
};

/** Serve `root` on 127.0.0.1 at a free port. Resolves to { server, port, url, close() }. */
export function serveStatic(root) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://localhost").pathname)).replace(/^[/\\]+/, "");
    let file = join(root, path);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        server,
        port,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => { server.close(() => done()); server.closeAllConnections?.(); }),
      });
    });
  });
}
