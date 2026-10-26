/**
 * S34: 使い捨ての家族ヘルパーの動作確認（Issue #240）
 * 前提: as-parent-premium プロジェクト。共有の QA アカウントは使わず、専用の家族を作って削除する。
 *
 * PREMIUM の家族を作る → 子の画面が開く → disposeFamily()（E2E 解約 → 家族ごと削除。警告が出ない＝409 にならない）
 * → 削除前に控えたセッションで DELETE /api/account が 401 → disposeFamily() の再呼び出しもエラーにならない。
 */
import { request as playwrightRequest } from "@playwright/test";
import { test, expect } from "./fixtures";
import { getE2EBaseUrl } from "./baseUrl";
import { getBypassHeaders } from "./credentials";
import { createDisposableFamily } from "./helpers/disposableFamily";

test.describe("S34: 使い捨ての家族", () => {
  test("PREMIUM の家族を作って削除でき、削除後はセッションが無効になる", async ({ browser }) => {
    test.setTimeout(120000);
    const family = await createDisposableFamily(browser, { premium: true });
    try {
      // 子の画面が開く
      const childPage = await family.child.context.newPage();
      await childPage.goto("/app/child/quests");
      await expect(childPage).toHaveURL(/\/app\/child\/quests/);
      await childPage.close();

      // closeSessions() で context が閉じるため、削除後の検証用に storageState をメモリに控える
      const parentState = await family.parent.context.storageState();
      const childState = await family.child.context.storageState();

      // 解約 200 / 削除 200 (scope=family) でなければ警告 annotation が付く
      await family.disposeFamily();
      const warnings = test.info().annotations.filter((a) => a.type === "disposable-family-warning");
      expect(warnings.map((w) => w.description)).toEqual([]);

      // 削除前のセッションで API を呼ぶと未認証（401）
      for (const storageState of [parentState, childState]) {
        const req = await playwrightRequest.newContext({ baseURL: getE2EBaseUrl(), storageState });
        try {
          const res = await req.delete("/api/account", {
            headers: getBypassHeaders(),
            data: { confirm: "削除します" },
          });
          expect(res.status()).toBe(401);
        } finally {
          await req.dispose();
        }
      }

      // 2回目の呼び出しもエラーにならない（同じ Promise）
      await expect(family.disposeFamily()).resolves.toBeUndefined();
    } finally {
      await family.disposeFamily();
    }
  });
});
