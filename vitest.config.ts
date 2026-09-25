import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["lcov"],
      include: ["src/**/*"],
    },
  },
});
