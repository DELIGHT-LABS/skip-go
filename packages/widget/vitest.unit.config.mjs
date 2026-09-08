import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

export default {
  root: fileURLToPath(new URL("./", import.meta.url)),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      react: dirname(require.resolve("react/package.json")),
      "react-dom": dirname(require.resolve("react-dom/package.json")),
    },
  },
  test: {
    environment: "jsdom",
    include: [
      "src/hooks/useAutoSetAddress.test.tsx",
      "src/pages/SwapExecutionPage/useSwapExecutionState.test.tsx",
      "src/pages/SwapPage/useConnectToMissingCosmosChain.test.tsx",
      "src/state/swapPage.test.ts",
    ],
  },
};
