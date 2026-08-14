import { afterEach, describe, expect, it, vi } from "vitest";
// e2e/ 配下は vitest.config.ts の include 対象外だが、相対パスで直接 import する。
// @ エイリアスは ./src にしか通っていないため使えない。
import {
  DEFAULT_BASE_URL,
  getE2EBaseUrl,
  getE2EHostname,
  getE2ERoutePattern,
} from "../../../e2e/baseUrl";

/**
 * Playwright の page.route() が使う glob パターン（`**` は `/` を含め任意文字列にマッチ）を
 * 簡易的に再現した検証用マッチャー。実際の Playwright ランタイムは起動しない。
 */
function matchesRoutePattern(pattern: string, url: string): boolean {
  const escaped = pattern
    .split("**")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(url);
}

describe("DEFAULT_BASE_URL", () => {
  it("develop の既定 URL である", () => {
    expect(DEFAULT_BASE_URL).toBe(
      "https://adhd-git-develop-km-copepodas-projects.vercel.app",
    );
  });
});

describe("getE2EBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("E2E_BASE_URL が設定されていればその値を返す", () => {
    vi.stubEnv("E2E_BASE_URL", "https://adhd-git-pr-123-xxx.vercel.app");
    expect(getE2EBaseUrl()).toBe("https://adhd-git-pr-123-xxx.vercel.app");
  });

  it("境界値: E2E_BASE_URL が未設定なら develop の既定 URL にフォールバックする", () => {
    vi.stubEnv("E2E_BASE_URL", undefined);
    expect(getE2EBaseUrl()).toBe(DEFAULT_BASE_URL);
  });

  it("境界値: E2E_BASE_URL が空文字なら未設定と同じ扱いで既定 URL にフォールバックする", () => {
    vi.stubEnv("E2E_BASE_URL", "");
    expect(getE2EBaseUrl()).toBe(DEFAULT_BASE_URL);
  });

  it("createBrowserContext の baseURL が E2E_BASE_URL に追従する（戻り値検証）", () => {
    // createBrowserContext 自体は Playwright の Browser/Page に依存するため実起動しないが、
    // Green フェーズで createBrowserContext は getE2EBaseUrl() の戻り値を baseURL として使う想定。
    // ここではその追従元となる戻り値そのものが env に応じて変化することを検証する。
    vi.stubEnv("E2E_BASE_URL", "https://adhd-git-pr-999-xxx.vercel.app");
    const baseUrlForContext = getE2EBaseUrl();
    expect(baseUrlForContext).toBe("https://adhd-git-pr-999-xxx.vercel.app");
    expect(baseUrlForContext).not.toBe(DEFAULT_BASE_URL);
  });
});

describe("getE2EHostname", () => {
  it("正常系: プレビュー URL からホスト名を導出できる", () => {
    expect(getE2EHostname("https://adhd-git-pr-123-xxx.vercel.app")).toBe(
      "adhd-git-pr-123-xxx.vercel.app",
    );
  });

  it("境界値: 末尾スラッシュありでもホスト名が正しく取れる", () => {
    expect(getE2EHostname("https://example.vercel.app/")).toBe(
      "example.vercel.app",
    );
  });

  it("境界値: ポート付き URL でもホスト名が壊れない", () => {
    expect(getE2EHostname("http://localhost:3000")).toBe("localhost");
  });

  it("異常系: 不正な URL 文字列を渡すと例外を投げる（無言でフォールバックしない）", () => {
    expect(() => getE2EHostname("not a url")).toThrow();
  });

  it("引数省略時は getE2EBaseUrl() の結果からホスト名を導出する", () => {
    vi.stubEnv("E2E_BASE_URL", "https://adhd-git-pr-42-xxx.vercel.app");
    expect(getE2EHostname()).toBe("adhd-git-pr-42-xxx.vercel.app");
    vi.unstubAllEnvs();
  });
});

describe("getE2ERoutePattern", () => {
  it("正常系: https://<host>/** 形式のパターンを組み立てる", () => {
    expect(getE2ERoutePattern("https://adhd-git-pr-123-xxx.vercel.app")).toBe(
      "https://adhd-git-pr-123-xxx.vercel.app/**",
    );
  });

  it("正常系: プレビュー URL 配下のリクエストにマッチする", () => {
    const pattern = getE2ERoutePattern("https://adhd-git-pr-123-xxx.vercel.app");
    expect(
      matchesRoutePattern(
        pattern,
        "https://adhd-git-pr-123-xxx.vercel.app/app/parent/tasks",
      ),
    ).toBe(true);
    expect(
      matchesRoutePattern(pattern, "https://adhd-git-pr-123-xxx.vercel.app/"),
    ).toBe(true);
  });

  it("境界値: 末尾スラッシュありの baseUrl でも壊れないパターンになる", () => {
    expect(getE2ERoutePattern("https://example.vercel.app/")).toBe(
      "https://example.vercel.app/**",
    );
  });

  it("境界値: ポート付き URL でもパターンが壊れない", () => {
    expect(getE2ERoutePattern("http://localhost:3000")).toBe(
      "http://localhost/**",
    );
  });

  it("異常系: Supabase 等の外部ドメインにはマッチしない（bypass ヘッダーが漏れない）", () => {
    const pattern = getE2ERoutePattern("https://adhd-git-pr-123-xxx.vercel.app");
    expect(
      matchesRoutePattern(pattern, "https://xxxxx.supabase.co/auth/v1/token"),
    ).toBe(false);
  });

  it("引数省略時は getE2EBaseUrl() の結果からパターンを組み立てる", () => {
    vi.stubEnv("E2E_BASE_URL", undefined);
    expect(getE2ERoutePattern()).toBe(`${DEFAULT_BASE_URL}/**`);
  });
});
