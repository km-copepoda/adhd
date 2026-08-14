import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import { getE2EBaseUrl } from "./e2e/baseUrl";

// .env.test から E2E 専用の環境変数を読み込む
config({ path: ".env.test" });

const baseURL = getE2EBaseUrl();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    // Vercel bypass ヘッダーは fixtures.ts の route 注入で Vercel ドメイン限定に付与
    // extraHTTPHeaders は使わない（Supabase 等の外部 API の CORS に影響するため）
  },
  projects: [
    // 認証セットアップ（no-auth の後に実行：S3 が child-rejoin で supabaseId を上書きするため）
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      dependencies: ["no-auth"],
    },
    // 未認証テスト（ランディング・ログインフォーム検証・アカウント登録フォーム）
    {
      name: "no-auth",
      testMatch: /\/(s1|s2|s3|s14)-.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // 親アカウントで実行するテスト（全フロー・スキップ承認・期限設定・履歴・完了・宝箱プールを含む）
    {
      name: "as-parent",
      testMatch: /\/(s4|s6|s9|s10|s12|s13|s16|s17|s18|s22|s23)-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/parent.json",
      },
      dependencies: ["setup"],
    },
    // 子供アカウント（ライトモード）で実行するテスト（育成画面・宝箱・コレクション・ひろばを含む）
    {
      name: "as-child",
      testMatch: /\/(s5|s7|s8|s11|s15|s19|s20|s21)-.*\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
        storageState: "playwright/.auth/child-light.json",
      },
      dependencies: ["setup"],
    },
  ],
});
