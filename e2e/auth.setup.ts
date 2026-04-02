/**
 * 認証セットアップ
 * 各テストプロジェクトが使う storageState を生成する。
 * 実行順: setup project → as-parent / as-child projects
 */
import { test as setup } from "./fixtures";
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
  await page.goto("/app/parent/login");
  await page.fill('input[placeholder="メールアドレス"]', PARENT_EMAIL);
  await page.fill('input[placeholder="パスワード"]', PARENT_PASSWORD);
  await page.click('button:has-text("ログイン")');
  await page.waitForURL("**/app/parent/tasks", { timeout: 15000 });
  await page.context().storageState({ path: path.join(AUTH_DIR, "parent.json") });
});

setup("authenticate as child (light)", async ({ page }) => {
  await page.goto("/app/child/login");
  await page.fill('input[placeholder="ABC123"]', FAMILY_CODE);
  await page.fill('input[placeholder="1234"]', CHILD_CODE_LIGHT);
  await page.click('button:has-text("ログイン")');
  await page.waitForURL("**/app/child/quests", { timeout: 15000 });
  await page.context().storageState({ path: path.join(AUTH_DIR, "child-light.json") });
});

setup("authenticate as child (dark)", async ({ page }) => {
  await page.goto("/app/child/login");
  await page.fill('input[placeholder="ABC123"]', FAMILY_CODE);
  await page.fill('input[placeholder="1234"]', CHILD_CODE_DARK);
  await page.click('button:has-text("ログイン")');
  await page.waitForURL("**/app/child/quests", { timeout: 15000 });
  await page.context().storageState({ path: path.join(AUTH_DIR, "child-dark.json") });
});
