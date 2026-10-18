import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { environment: "edge-runtime", include: ["convex/**/*.test.{ts,tsx}", "app/api/**/*.test.ts"], testTimeout: 30000 },
});
