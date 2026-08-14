/**
 * E2E テスト共通ユーティリティ
 * - QA 認証情報の読み書き
 * - Vercel bypass ヘッダー付きコンテキスト作成
 */
import fs from "fs";
import path from "path";
import type { Browser, Page } from "@playwright/test";
import { getE2EBaseUrl, getE2EHostname, getE2ERoutePattern } from "./baseUrl";

export const AUTH_DIR = path.join(process.cwd(), "playwright/.auth");

export type QACredentials = {
  email: string;
  password: string;
  familyCode: string;
  childCodeLight: string;
  /** PREMIUM 用アカウントのみ: 2人目の子供（子供切替UIの検証用）。FREE 用アカウントには存在しない。 */
  childCodeLight2?: string;
};

export function readCredentials(): QACredentials {
  const file = path.join(AUTH_DIR, "qa-credentials.json");
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

/**
 * FREE プラン用 QA アカウントの認証情報を読み込む。
 * `auth-free.setup.ts` が書き出す qa-credentials-free.json（子供1人のみ）を対象とする。
 * PREMIUM 用の readCredentials() とはファイルが分離されているため、
 * 既存の readCredentials() 呼び出し元には影響しない。
 */
export function readFreeCredentials(): QACredentials {
  const file = path.join(AUTH_DIR, "qa-credentials-free.json");
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

/** Vercel デプロイ保護 bypass ヘッダーを返す（page.request 直接コール用） */
export function getBypassHeaders(): Record<string, string> {
  const secret = process.env.VERCEL_BYPASS_SECRET;
  return secret ? { "x-vercel-protection-bypass": secret } : {};
}

/** Vercel デプロイ保護の bypass ヘッダーをページに設定する */
export async function setupBypassRoute(page: Page): Promise<void> {
  const secret = process.env.VERCEL_BYPASS_SECRET;
  if (!secret) return;
  // **/<hostname>/** は https:// の二重スラッシュにマッチしない場合があるため
  // https:// から始まる明示的なパターンを使用する
  await page.route(getE2ERoutePattern(), async (route) => {
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
 *
 * Vercel Authentication 方式の場合 x-vercel-protection-bypass ヘッダーは無効なため、
 * 未認証コンテキストでは parent.json から Vercel 認証クッキー（sb- 以外）のみコピーする。
 * これにより Supabase セッションなし（= 未認証）かつ Vercel 保護パス可能な状態を実現する。
 */
export async function createBrowserContext(
  browser: Browser,
  storageStatePath?: string,
) {
  const secret = process.env.VERCEL_BYPASS_SECRET;
  const context = await browser.newContext({
    baseURL: getE2EBaseUrl(),
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
    ...(secret ? { extraHTTPHeaders: { "x-vercel-protection-bypass": secret } } : {}),
  });

  // storageState なし（未認証コンテキスト）の場合、parent.json から
  // Vercel 認証クッキーのみコピーして deployment protection をパスする。
  // Supabase セッションクッキー（sb- prefix）は除外し、アプリ的には未認証状態を維持する。
  if (!storageStatePath) {
    const parentAuthPath = path.join(AUTH_DIR, "parent.json");
    if (fs.existsSync(parentAuthPath)) {
      type StoredCookie = {
        name: string;
        value: string;
        domain: string;
        path: string;
        expires: number;
        httpOnly: boolean;
        secure: boolean;
        sameSite: "Strict" | "Lax" | "None";
      };
      const parentState = JSON.parse(fs.readFileSync(parentAuthPath, "utf-8")) as {
        cookies?: StoredCookie[];
      };
      const vercelCookies = (parentState.cookies ?? []).filter(
        (c) =>
          (c.domain.includes(getE2EHostname()) ||
            c.domain.includes(".vercel.app") ||
            c.domain.includes("vercel.com")) &&
          !c.name.startsWith("sb-"),
      );
      if (vercelCookies.length > 0) {
        await context.addCookies(vercelCookies);
      }
    }
  }

  const page = await context.newPage();
  return { context, page };
}
