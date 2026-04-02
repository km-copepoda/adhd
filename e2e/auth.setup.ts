/**
 * 認証セットアップ
 * 各テストプロジェクトが使う storageState を生成する。
 * 実行順: setup project → as-parent / as-child projects
 */
import { test as setup, expect } from "./fixtures";
import path from "path";
import fs from "fs";

const AUTH_DIR = path.join(process.cwd(), "playwright/.auth");

setup.beforeAll(() => {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
});

const PARENT_EMAIL = "qb@example.com";
const PARENT_PASSWORD = "password";
const FAMILY_CODE = "VJZQSH";
const CHILD_CODE_LIGHT = "0321"; // ライトモード（Side: LIGHT）
const CHILD_CODE_DARK = "5334";  // ダークモード（Side: DARK）

setup("authenticate as parent", async ({ page }) => {
  await page.goto("/parent/login");
  await page.fill('input[placeholder="メールアドレス"]', PARENT_EMAIL);
  await page.fill('input[placeholder="パスワード"]', PARENT_PASSWORD);
  await page.click('button:has-text("ログイン")');
  await page.waitForURL("**/parent/tasks", { timeout: 15000 });
  await page.context().storageState({ path: path.join(AUTH_DIR, "parent.json") });
});

async function loginAsChild(page: Parameters<typeof setup>[1]["page"], childCode: string, authFile: string) {
  // Supabase API のレスポンスをキャプチャしてデバッグ情報を出力
  const supabaseResponses: string[] = [];
  page.on("response", async (res) => {
    if (res.url().includes("supabase") && res.url().includes("/auth/")) {
      try {
        const body = await res.text();
        supabaseResponses.push(`[${res.status()}] ${res.url()}: ${body.slice(0, 300)}`);
      } catch {
        supabaseResponses.push(`[${res.status()}] ${res.url()}: (failed to read body)`);
      }
    }
  });

  await page.goto("/child/login");
  await page.fill('input[placeholder="ABC123"]', FAMILY_CODE);
  await page.fill('input[placeholder="1234"]', childCode);
  await page.click('button:has-text("ログイン")');

  try {
    await page.waitForURL("**/child/quests", { timeout: 20000 });
  } catch (e) {
    // デバッグ情報を出力
    const errorText = await page.locator("p.text-red-400").textContent().catch(() => "not found");
    console.log("==== Child login debug ====");
    console.log("Error on page:", errorText);
    console.log("Supabase responses:", supabaseResponses);
    console.log("Current URL:", page.url());
    throw e;
  }

  await page.context().storageState({ path: path.join(AUTH_DIR, authFile) });
}

setup("authenticate as child (light)", async ({ page }) => {
  await loginAsChild(page, CHILD_CODE_LIGHT, "child-light.json");
});

setup("authenticate as child (dark)", async ({ page }) => {
  await loginAsChild(page, CHILD_CODE_DARK, "child-dark.json");
});
