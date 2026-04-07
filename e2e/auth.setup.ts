/**
 * 認証セットアップ（QA アカウント新規作成版）
 *
 * 実行ごとに QA_yyyymmddhhmmss@example.com で新規登録し、
 * 子供ユーザーを作成した上で storageState と qa-credentials.json を生成する。
 * s1-s3（ログイン周り）のテストは固定アカウントを使うためここでは作らない。
 */
import { test as setup, expect } from "./fixtures";
import path from "path";
import fs from "fs";
import { AUTH_DIR, VERCEL_BASE_URL, createBrowserContext, getBypassHeaders } from "./credentials";

const CREDENTIALS_FILE = path.join(AUTH_DIR, "qa-credentials.json");

setup.beforeAll(() => {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
});

setup("create QA account and child", async ({ page, browser }) => {
  // タイムスタンプベースのメール生成（QA_yyyymmddhhmmss@example.com）
  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const email = `QA_${ts}@example.com`;
  const password = "QAPassword123";

  // 1. アカウント新規登録
  await page.goto("/app/register");
  await expect(page.getByText("ギルドマスター アカウント作成")).toBeVisible({ timeout: 15000 });
  await page.fill('input[placeholder="メールアドレス"]', email);
  await page.fill('input[placeholder="パスワード（6文字以上）"]', password);
  await page.click('button:has-text("アカウントを作成")');
  await page.waitForURL("**/app/parent/tasks", { timeout: 30000 });

  // 2. ファミリーコードを API から取得
  // page.request は Node.js 直接コールのため page.route() を通らず
  // Vercel bypass ヘッダーを明示的に付与する必要がある
  const bypassHeaders = getBypassHeaders();
  const familyRes = await page.request.get("/api/family/code", { headers: bypassHeaders });
  const familyData = await familyRes.json();
  const familyCode: string = familyData.code;

  // 3. 子供ユーザーを API で作成（UIでの子供作成は s9 でテスト済み）
  const childRes = await page.request.post("/api/family/members", {
    data: { monsterName: "QA_child", side: "LIGHT" },
    headers: bypassHeaders,
  });
  const childData = await childRes.json();
  const childCodeLight: string = childData.childCode;

  // 4. qa-credentials.json に保存
  fs.writeFileSync(
    CREDENTIALS_FILE,
    JSON.stringify({ email, password, familyCode, childCodeLight }, null, 2),
  );

  // 5. 親 storageState を保存
  await page.context().storageState({ path: path.join(AUTH_DIR, "parent.json") });

  // 6. 子供ログイン → child-light.json に保存
  const { context: childCtx, page: childPage } = await createBrowserContext(browser);
  try {
    await childPage.goto("/app/child/login");
    await childPage.fill('input[placeholder="ABC123"]', familyCode);
    await childPage.fill('input[placeholder="1234"]', childCodeLight);
    await childPage.click('button:has-text("ログイン")');
    await childPage.waitForURL("**/app/child/quests", { timeout: 15000 });
    await childCtx.storageState({ path: path.join(AUTH_DIR, "child-light.json") });
  } finally {
    await childCtx.close();
  }
});
