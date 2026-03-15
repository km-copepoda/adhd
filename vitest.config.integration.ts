import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./src/__tests__/integration/global-setup.ts"],
    setupFiles: ["./src/__tests__/integration/setup.ts"],
    include: ["src/__tests__/integration/**/*.test.ts"],
    // 統合テストは順次実行（DB状態に依存するため）
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
