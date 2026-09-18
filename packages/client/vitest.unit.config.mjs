import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

import config from "./vitest.config.mjs";

const widgetUnitTests = "../widget/src/{hooks,pages,state}/**/*.test.{ts,tsx}";

export default defineConfig({
  ...config,
  root: fileURLToPath(new URL("./", import.meta.url)),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../widget/src/", import.meta.url)),
    },
  },
  test: {
    ...config.test,
    include: [...configDefaults.include, widgetUnitTests],
    exclude: [...configDefaults.exclude, "**/e2e/**"],
    environmentMatchGlobs: [[widgetUnitTests, "jsdom"]],
    restoreMocks: true,
  },
});
