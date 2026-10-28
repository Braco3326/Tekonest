// Write a generated file only when its bytes differ from what is on disk. An up-to-date tree is then never touched, so tests
// and servers reading it in parallel never see a half-written file, and mtimes only move when content does.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

/** @returns {boolean} true if the file was written. */
export function writeIfChanged(file, data) {
  const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  if (existsSync(file) && readFileSync(file).equals(bytes)) return false;
  writeFileSync(file, bytes);
  return true;
}
