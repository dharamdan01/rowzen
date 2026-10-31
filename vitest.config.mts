import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
    // Auth imports and esbuild checks compete for RAM when the default follows CPU count.
    maxWorkers: 1,
  },
});
