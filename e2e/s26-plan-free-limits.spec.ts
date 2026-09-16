/**
 * S26: FREE プランの各種上限
 * 前提: as-parent-free プロジェクト（storageState: parent-free.json）で実行
 * FREE アカウントの認証情報は e2e/credentials.ts の readFreeCredentials() で取得する
 * （auth-free.setup.ts が qa-credentials-free.json / parent-free.json を用意する。子供は1人のみ）
 *
 * - 「おすすめセットで始める」ボタンは FREE では表示されない（ごほうび0件でも）
 * - 子アカウント上限（1人）: 2人目追加時にインラインエラーが表示されメンバーに追加されず、
 *   直下に「プラン管理を見る」リンクが表示される（Issue #148 Q1 B案。既存挙動はほぼ無改変）
 * - タスク上限（10件/子）: 「+ タスク追加」押下時にクライアント側 preempt が働き、
 *   フォームを開く前に confirm ダイアログが表示される（Issue #148 v2差分5番）。
 *   dismiss するとタスク管理ページに留まりフォームは開かない。accept すると
 *   /app/parent/plan へ遷移する
 * - ごほうび上限（5件/子）: 6件目追加時に confirm でエラーが表示される
 *   （Issue #148 v1差分1番: alert から confirm+誘導導線に変更）
 */
import { test, expect } from "./fixtures";
import { readFreeCredentials, getBypassHeaders } from "./credentials";

/** 対象の子供 (childCodeLight で特定) の id を取得する */
async function getFreeChildId(page: import("@playwright/test").Page, bypassHeaders: Record<string, string>) {
  const creds = readFreeCredentials();
  const familyRes = await page.request.get("/api/family/code", { headers: bypassHeaders });
  const familyData = await familyRes.json();
  const child = familyData.members.find(
    (m: { role: string; childCode: string | null }) =>
      m.role === "CHILD" && m.childCode === creds.childCodeLight,
  );
  expect(child).toBeTruthy();
  return child.id as string;
}

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

    // インラインエラー直下に「プラン管理を見る」リンクが表示される（Issue #148 Q2 B案）
    const planLink = page.getByRole("link", { name: /プラン管理を見る/ });
    await expect(planLink).toBeVisible();
    await expect(planLink).toHaveAttribute("href", "/app/parent/plan");
  });

  test("タスク上限（10件/子）: 「+ タスク追加」押下でフォームが開かずconfirmが表示される（dismiss）", async ({
    page,
  }) => {
    const bypassHeaders = getBypassHeaders();
    const childId = await getFreeChildId(page, bypassHeaders);

    // API 経由で事前に10件作成（FREE 上限ちょうど）
    for (let i = 0; i < 10; i++) {
      const res = await page.request.post("/api/tasks", {
        data: {
          title: `E2E_FREE_task_${Date.now()}_${i}`,
          emoji: "📚",
          category: "STUDY",
          repeatDays: [0, 1, 2, 3, 4, 5, 6],
          isTemporary: false,
          assignedChildId: childId,
        },
        headers: bypassHeaders,
      });
      expect(res.ok()).toBeTruthy();
    }

    await page.goto("/app/parent/tasks");
    await expect(page.getByRole("heading", { name: /タスク管理/ })).toBeVisible({
      timeout: 15000,
    });

    // preempt はボタン押下と同時に confirm を出すため、クリック前にダイアログリスナーを登録する
    let dialogMessage = "";
    page.once("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: /タスク追加/ }).first().click();

    await expect
      .poll(() => dialogMessage, { timeout: 10000 })
      .toContain("無料プランではタスクは10個までです。プレミアムプランで無制限になります。");

    // preempt によりフォームは開かない（サーバに到達させない）
    await expect(page.locator('input[placeholder="例: 算数ドリルをやる"]')).not.toBeVisible();
    // dismiss したのでタスク管理ページに留まる
    await expect(page).toHaveURL(/\/app\/parent\/tasks/);
  });

  test("タスク上限（10件/子）: confirmでOKを選ぶと/app/parent/planへ遷移する", async ({ page }) => {
    const bypassHeaders = getBypassHeaders();
    const childId = await getFreeChildId(page, bypassHeaders);

    for (let i = 0; i < 10; i++) {
      const res = await page.request.post("/api/tasks", {
        data: {
          title: `E2E_FREE_task_${Date.now()}_${i}`,
          emoji: "📚",
          category: "STUDY",
          repeatDays: [0, 1, 2, 3, 4, 5, 6],
          isTemporary: false,
          assignedChildId: childId,
        },
        headers: bypassHeaders,
      });
      expect(res.ok()).toBeTruthy();
    }

    await page.goto("/app/parent/tasks");
    await expect(page.getByRole("heading", { name: /タスク管理/ })).toBeVisible({
      timeout: 15000,
    });

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole("button", { name: /タスク追加/ }).first().click();

    await expect(page).toHaveURL(/\/app\/parent\/plan/, { timeout: 10000 });
  });

  test("ごほうび上限（5件/子）: 6件目追加時にconfirmでエラーが表示される（dismiss）", async ({ page }) => {
    const bypassHeaders = getBypassHeaders();
    const childId = await getFreeChildId(page, bypassHeaders);

    // API 経由で事前に5件作成（FREE 上限ちょうど）
    for (let i = 0; i < 5; i++) {
      const res = await page.request.post("/api/treasures", {
        data: {
          childId,
          title: `E2E_FREE_treasure_${Date.now()}_${i}`,
          rarity: "COMMON",
        },
        headers: bypassHeaders,
      });
      expect(res.ok()).toBeTruthy();
    }

    // UI から6件目を追加しようとすると confirm でエラーが表示される
    // （ごほうび画面には preempt が無いため、実際に POST してサーバの 403 で確認する）
    await page.goto("/app/parent/treasures");
    await expect(page.getByRole("heading", { name: /ごほうび設定/ })).toBeVisible({
      timeout: 15000,
    });

    await page.fill(
      'input[placeholder="例: アイスを買える"]',
      `E2E_FREE_treasure_over_${Date.now()}`,
    );

    // accept すると /app/parent/plan へ遷移してしまい後続の検証が不安定になるため dismiss する
    let dialogMessage = "";
    page.once("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: /^追加$/ }).click();

    await expect
      .poll(() => dialogMessage, { timeout: 10000 })
      .toContain("無料プランではごほうびは5個までです。プレミアムプランで無制限になります。");

    // dismiss したのでごほうびページに留まる
    await expect(page).toHaveURL(/\/app\/parent\/treasures/);
  });
});
