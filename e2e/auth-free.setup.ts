/**
 * 認証セットアップ（QA アカウント新規作成版・FREE）
 *
 * 実行ごとに QA_FREE_yyyymmddhhmmss@example.com で新規登録し、
 * 子供ユーザーを1人だけ作成した上で storageState と qa-credentials-free.json を生成する。
 *
 * 新規登録直後のアカウントは自動的に FREE プランのため、PREMIUM 化 API は呼ばない。
 * FREE 制限テスト（as-parent-free プロジェクト）専用のアカウントを提供する。
 * PREMIUM 用のセットアップは auth.setup.ts を参照。
 */
import { test as setup, expect } from "./fixtures";
import path from "path";
import fs from "fs";
import { AUTH_DIR, getBypassHeaders } from "./credentials";

const CREDENTIALS_FILE = path.join(AUTH_DIR, "qa-credentials-free.json");

setup.beforeAll(() => {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
});

setup("create FREE QA account and child", async ({ page }) => {
  // タイムスタンプベースのメール生成（QA_FREE_yyyymmddhhmmss@example.com）
  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const email = `QA_FREE_${ts}@example.com`;
  const password = "QAPassword123";

  // 1. アカウント新規登録
  await page.goto("/app/register");
  await expect(page.getByText("管理者 アカウント作成")).toBeVisible({ timeout: 15000 });
  await page.fill('input[placeholder="メールアドレス"]', email);
  await page.fill('input[placeholder="パスワード（6文字以上）"]', password);
  await page.click('button:has-text("アカウントを作成")');
  await page.waitForURL("**/app/parent/tasks", { timeout: 30000 });

  // 2. ファミリーコードを API から取得
  const bypassHeaders = getBypassHeaders();
  const familyRes = await page.request.get("/api/family/code", { headers: bypassHeaders });
  const familyData = await familyRes.json();
  const familyCode: string = familyData.code;

  // 3. 子供ユーザーを1人だけ API で作成
  const childRes = await page.request.post("/api/family/members", {
    data: { monsterName: "QA_FREE_child", side: "LIGHT" },
    headers: bypassHeaders,
  });
  const childData = await childRes.json();
  const childCodeLight: string = childData.childCode;

  // 4. PREMIUM 化 API は呼ばない（新規登録直後は自動的に FREE プランのため）

  // 5. qa-credentials-free.json に保存
  fs.writeFileSync(
    CREDENTIALS_FILE,
    JSON.stringify({ email, password, familyCode, childCodeLight }, null, 2),
  );

  // 6. 親 storageState を保存
  await page.context().storageState({ path: path.join(AUTH_DIR, "parent-free.json") });
});
