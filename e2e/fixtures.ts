/**
 * カスタム fixtures
 * - Vercel デプロイ保護の bypass ヘッダーを Vercel ドメインのリクエストだけに付与する
 * - 全 spec ファイルはこのファイルから test / expect をインポートする
 */
import { test as base, expect } from "@playwright/test";

const VERCEL_HOSTNAME = "adhd-git-develop-km-copepodas-projects.vercel.app";

export const test = base.extend({
  page: async ({ page }, use) => {
    const secret = process.env.VERCEL_BYPASS_SECRET;
    if (secret) {
      // Vercel ドメインへのリクエストにのみ bypass ヘッダーを追加
      // Supabase 等の外部 API へのリクエストは変更しない
      await page.route(`https://${VERCEL_HOSTNAME}/**`, async (route) => {
        await route.continue({
          headers: {
            ...route.request().headers(),
            "x-vercel-protection-bypass": secret,
          },
        });
      });
    }
    await use(page);
  },
});

export { expect };
