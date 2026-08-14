/**
 * E2E テストが対象とするデプロイの base URL / hostname 導出ロジック。
 * - CI やローカルで PR プレビュー URL を指定できるよう `E2E_BASE_URL` を優先する
 * - 未設定時は develop ブランチの Vercel プレビュー URL にフォールバックする
 */

export const DEFAULT_BASE_URL =
  "https://adhd-git-develop-km-copepodas-projects.vercel.app";

/** `E2E_BASE_URL` が設定されていればその値、空文字/未設定なら既定 URL を返す */
export function getE2EBaseUrl(): string {
  return process.env.E2E_BASE_URL || DEFAULT_BASE_URL;
}

/** baseUrl からホスト名を導出する。不正な URL の場合は `new URL()` の例外をそのまま投げる */
export function getE2EHostname(baseUrl: string = getE2EBaseUrl()): string {
  return new URL(baseUrl).hostname;
}

/** Playwright の `page.route()` 用に `<protocol>//<host>/**` 形式のパターンを組み立てる */
export function getE2ERoutePattern(baseUrl: string = getE2EBaseUrl()): string {
  const url = new URL(baseUrl);
  return `${url.protocol}//${url.hostname}/**`;
}
