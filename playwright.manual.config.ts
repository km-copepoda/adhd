import { defineConfig } from "@playwright/test";
import { config } from "dotenv";
import { getE2EBaseUrl } from "./e2e/baseUrl";

// 利用マニュアル（docs/manual）用のスクショ撮影専用の設定。通常の E2E とは別に手動で実行する。
//   npx playwright test -c playwright.manual.config.ts
// 撮影用の家族を作ってデータを入れ、docs/manual/images/ に撮影し、最後に家族ごと削除する。
config({ path: ".env.test" });

export default defineConfig({
  testDir: "./e2e/manual",
  workers: 1,
  retries: 0,
  timeout: 15 * 60 * 1000,
  reporter: "list",
  use: {
    baseURL: getE2EBaseUrl(),
    browserName: "chromium",
  },
});
