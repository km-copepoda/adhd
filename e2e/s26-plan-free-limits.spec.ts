/**
 * S26: FREE プランの各種上限
 * 前提: as-parent-free プロジェクト（storageState: parent-free.json）で実行
 * FREE アカウントの認証情報は e2e/credentials.ts の readFreeCredentials() で取得する
 * （auth-free.setup.ts が qa-credentials-free.json / parent-free.json を用意する。子供は1人のみ）
 *
 * - 「おすすめセットで始める」ボタンは FREE では表示されない（ごほうび0件でも）
 * - 子アカウント上限（1人）: 2人目追加時にインラインエラーが表示されメンバーに追加されない
 * - タスク上限（10件/子）: 11件目追加時に alert でエラーが表示される
 * - ごほうび上限（5件/子）: 6件目追加時に alert でエラーが表示される
 */
import { test, expect } from "./fixtures";
import { readFreeCredentials, getBypassHeaders } from "./credentials";

test.describe("S26: FREE プラン上限", () => {
  test("「おすすめセットで始める」ボタンはFREEでは表示されない（ごほうび0件）", async ({ page }) => {
    await page.goto("/app/parent/treasures");
    await expect(page.getByRole("heading", { name: /ごほうび設定/ })).toBeVisible({
      timeout: 15000,
    });

    // 新規 FREE アカウントはごほうび0件のため空状態メッセージが表示される
    await expect(page.getByText("まだごほうびが登録されていません。")).toBeVisible({
      timeout: 10000,
    });
    // FREE プランでは「おすすめセットで始める」ボタンは非表示
    await expect(
      page.getByRole("button", { name: /おすすめセットで始める/ }),
    ).not.toBeVisible();
  });

  test("子アカウント上限（1人）: 2人目追加でインラインエラーが表示されメンバーに追加されない", async ({
    page,
  }) => {
    await page.goto("/app/parent/family");
    await expect(page.getByRole("heading", { name: /ファミリー管理/ })).toBeVisible({
      timeout: 15000,
    });

    const childName = `E2E_FREE_over_${Date.now()}`;
    await page.getByRole("button", { name: /子どもを追加/ }).click();
    await expect(page.locator('input[placeholder="例: りゅうくん"]')).toBeVisible();
    await page.fill('input[placeholder="例: りゅうくん"]', childName);
    await page.getByRole("button", { name: /^追加$/ }).click();

    // src/app/api/family/members/route.ts のエラーメッセージと一致する文言がインライン表示される
    await expect(
      page.getByText(
        "無料プランでは子アカウントは1人までです。プレミアムプランで無制限になります。",
      ),
    ).toBeVisible({ timeout: 10000 });

    // メンバー一覧には追加されない
    await expect(page.getByText(childName)).not.toBeVisible();
  });

  test("タスク上限（10件/子）: 11件目追加時にalertでエラーが表示される", async ({ page }) => {
    const creds = readFreeCredentials();
    const bypassHeaders = getBypassHeaders();

    // 対象の子供（childCodeLight で特定）の id を取得
    const familyRes = await page.request.get("/api/family/code", { headers: bypassHeaders });
    const familyData = await familyRes.json();
    const child = familyData.members.find(
      (m: { role: string; childCode: string | null }) =>
        m.role === "CHILD" && m.childCode === creds.childCodeLight,
    );
    expect(child).toBeTruthy();

    // API 経由で事前に10件作成（FREE 上限ちょうど）
    for (let i = 0; i < 10; i++) {
      const res = await page.request.post("/api/tasks", {
        data: {
          title: `E2E_FREE_task_${Date.now()}_${i}`,
          emoji: "📚",
          category: "STUDY",
          repeatDays: [0, 1, 2, 3, 4, 5, 6],
          isTemporary: false,
          assignedChildId: child.id,
        },
        headers: bypassHeaders,
      });
      expect(res.ok()).toBeTruthy();
    }

    // UI から11件目を追加しようとすると alert でエラーが表示される
    await page.goto("/app/parent/tasks");
    await expect(page.getByRole("heading", { name: /タスク管理/ })).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("button", { name: /タスク追加/ }).first().click();
    await expect(page.locator('input[placeholder="例: 算数ドリルをやる"]')).toBeVisible();
    await page.fill(
      'input[placeholder="例: 算数ドリルをやる"]',
      `E2E_FREE_task_over_${Date.now()}`,
    );

    let dialogMessage = "";
    page.once("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    await page.getByRole("button", { name: /^作成$/ }).click();

    await expect
      .poll(() => dialogMessage, { timeout: 10000 })
      .toContain("無料プランではタスクは10個までです。プレミアムプランで無制限になります。");
  });

  test("ごほうび上限（5件/子）: 6件目追加時にalertでエラーが表示される", async ({ page }) => {
    const creds = readFreeCredentials();
    const bypassHeaders = getBypassHeaders();

    const familyRes = await page.request.get("/api/family/code", { headers: bypassHeaders });
    const familyData = await familyRes.json();
    const child = familyData.members.find(
      (m: { role: string; childCode: string | null }) =>
        m.role === "CHILD" && m.childCode === creds.childCodeLight,
    );
    expect(child).toBeTruthy();

    // API 経由で事前に5件作成（FREE 上限ちょうど）
    for (let i = 0; i < 5; i++) {
      const res = await page.request.post("/api/treasures", {
        data: {
          childId: child.id,
          title: `E2E_FREE_treasure_${Date.now()}_${i}`,
          rarity: "COMMON",
        },
        headers: bypassHeaders,
      });
      expect(res.ok()).toBeTruthy();
    }

    // UI から6件目を追加しようとすると alert でエラーが表示される
    await page.goto("/app/parent/treasures");
    await expect(page.getByRole("heading", { name: /ごほうび設定/ })).toBeVisible({
      timeout: 15000,
    });

    await page.fill(
      'input[placeholder="例: アイスを買える"]',
      `E2E_FREE_treasure_over_${Date.now()}`,
    );

    let dialogMessage = "";
    page.once("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    await page.getByRole("button", { name: /^追加$/ }).click();

    await expect
      .poll(() => dialogMessage, { timeout: 10000 })
      .toContain("無料プランではごほうびは5個までです。プレミアムプランで無制限になります。");
  });
});
