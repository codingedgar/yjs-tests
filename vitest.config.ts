import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      // https://vitest.dev/guide/browser/playwright
      instances: [{ browser: "chromium" }],
      provider: "playwright",
    },
  },
});
