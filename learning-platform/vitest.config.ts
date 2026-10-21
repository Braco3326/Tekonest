import { defineConfig } from "vitest/config";
import path from "node:path";
import { existsSync } from "node:fs";

// Load .env.local (same file Next.js uses) so the live integration tests
// pick up GEMINI_API_KEY / ANTHROPIC_API_KEY without exporting them manually.
const envLocal = path.resolve(__dirname, ".env.local");
if (existsSync(envLocal)) {
  (process as unknown as { loadEnvFile(p: string): void }).loadEnvFile(envLocal);
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
