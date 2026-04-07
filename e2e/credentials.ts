/**
 * E2E テスト共通ユーティリティ
 * - QA 認証情報の読み書き
 * - Vercel bypass ヘッダー付きコンテキスト作成
 */
import fs from "fs";
import path from "path";
import type { Browser, Page } from "@playwright/test";

export const VERCEL_HOSTNAME = "adhd-git-develop-km-copepodas-projects.vercel.app";
export const VERCEL_BASE_URL = `https://${VERCEL_HOSTNAME}`;
export const AUTH_DIR = path.join(process.cwd(), "playwright/.auth");

export type QACredentials = {
  email: string;
  password: string;
  familyCode: string;
  childCodeLight: string;
};

export function readCredentials(): QACredentials {
  const file = path.join(AUTH_DIR, "qa-credentials.json");
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

/** Vercel デプロイ保護の bypass ヘッダーをページに設定する */
export async function setupBypassRoute(page: Page): Promise<void> {
  const secret = process.env.VERCEL_BYPASS_SECRET;
  if (!secret) return;
  await page.route(`**/${VERCEL_HOSTNAME}/**`, async (route) => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        "x-vercel-protection-bypass": secret,
      },
    });
  });
}

/**
 * 新しい Browser Context を作成し Vercel bypass を設定する。
 * storageStatePath を渡すとログイン済みコンテキストになる。
 */
export async function createBrowserContext(
  browser: Browser,
  storageStatePath?: string,
) {
  const context = await browser.newContext({
    baseURL: VERCEL_BASE_URL,
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  });
  const page = await context.newPage();
  await setupBypassRoute(page);
  return { context, page };
}
