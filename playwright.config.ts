import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// .env.test から E2E 専用の環境変数を読み込む
config({ path: ".env.test" });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "https://adhd-git-develop-km-copepodas-projects.vercel.app",
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
    // 未認証テスト（ランディング・ログインフォーム検証）
    {
      name: "no-auth",
      testMatch: /\/(s1|s2|s3)-.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // 親アカウントで実行するテスト
    {
      name: "as-parent",
      testMatch: /\/(s4|s6|s9)-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/parent.json",
      },
      dependencies: ["setup"],
    },
    // 子供アカウント（ライトモード / userCode: 0321）で実行するテスト
    {
      name: "as-child",
      testMatch: /\/(s5|s7|s8)-.*\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
        storageState: "playwright/.auth/child-light.json",
      },
      dependencies: ["setup"],
    },
  ],
});
