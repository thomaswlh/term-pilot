import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Surface measurement lines from passing tests (`Recall@5=...`) in default `npm test` output.
    disableConsoleIntercept: true,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
