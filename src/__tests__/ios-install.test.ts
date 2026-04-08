import { describe, it, expect, beforeEach, vi } from "vitest";
import { isIOS, isIPad, isInStandaloneMode, shouldShowInstallPrompt } from "@/lib/ios-install";

describe("isIOS", () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it("iPhone の userAgent を検出する", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", maxTouchPoints: 5 },
      configurable: true,
    });
    expect(isIOS()).toBe(true);
  });

  it("旧 iPad の userAgent を検出する", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", maxTouchPoints: 5 },
      configurable: true,
    });
    expect(isIOS()).toBe(true);
  });

  it("iPadOS 13+ (UA が Macintosh) を maxTouchPoints で検出する", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", maxTouchPoints: 5 },
      configurable: true,
    });
    expect(isIOS()).toBe(true);
  });

  it("Mac デスクトップ (maxTouchPoints=0) は false", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", maxTouchPoints: 0 },
      configurable: true,
    });
    expect(isIOS()).toBe(false);
  });

  it("Android の userAgent は false", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36", maxTouchPoints: 5 },
      configurable: true,
    });
    expect(isIOS()).toBe(false);
  });

  it("Desktop Chrome の userAgent は false", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", maxTouchPoints: 0 },
      configurable: true,
    });
    expect(isIOS()).toBe(false);
  });
});

describe("isIPad", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("旧 iPad の userAgent を iPad と判定する", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15", maxTouchPoints: 5 },
      configurable: true,
    });
    expect(isIPad()).toBe(true);
  });

  it("iPadOS 13+ (Macintosh UA + maxTouchPoints>1) を iPad と判定する", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", maxTouchPoints: 5 },
      configurable: true,
    });
    expect(isIPad()).toBe(true);
  });

  it("iPhone は iPad でない", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15", maxTouchPoints: 5 },
      configurable: true,
    });
    expect(isIPad()).toBe(false);
  });
});

describe("isInStandaloneMode", () => {
  it("standalone プロパティが true なら true", () => {
    Object.defineProperty(global, "navigator", {
      value: { standalone: true },
      configurable: true,
    });
    expect(isInStandaloneMode()).toBe(true);
  });

  it("standalone プロパティが false なら false", () => {
    Object.defineProperty(global, "navigator", {
      value: { standalone: false },
      configurable: true,
    });
    expect(isInStandaloneMode()).toBe(false);
  });

  it("matchMedia で display-mode: standalone なら true", () => {
    Object.defineProperty(global, "navigator", {
      value: {},
      configurable: true,
    });
    Object.defineProperty(global, "window", {
      value: {
        matchMedia: (query: string) => ({ matches: query === "(display-mode: standalone)" }),
      },
      configurable: true,
    });
    expect(isInStandaloneMode()).toBe(true);
  });
});

describe("shouldShowInstallPrompt", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(null),
    });
  });

  it("iOS + ブラウザモード + 未dismiss なら true", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15", standalone: false, maxTouchPoints: 5 },
      configurable: true,
    });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), localStorage: { getItem: vi.fn().mockReturnValue(null) } });
    expect(shouldShowInstallPrompt()).toBe(true);
  });

  it("iPad (iPadOS 13+) + ブラウザモード + 未dismiss なら true", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15", standalone: false, maxTouchPoints: 5 },
      configurable: true,
    });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), localStorage: { getItem: vi.fn().mockReturnValue(null) } });
    expect(shouldShowInstallPrompt()).toBe(true);
  });

  it("すでに standalone モードなら false", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15", standalone: true, maxTouchPoints: 5 },
      configurable: true,
    });
    expect(shouldShowInstallPrompt()).toBe(false);
  });

  it("非iOS なら false", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120", standalone: false, maxTouchPoints: 0 },
      configurable: true,
    });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), localStorage: { getItem: vi.fn().mockReturnValue(null) } });
    expect(shouldShowInstallPrompt()).toBe(false);
  });

  it("dismiss 済みなら false", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15", standalone: false, maxTouchPoints: 5 },
      configurable: true,
    });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      localStorage: { getItem: vi.fn().mockReturnValue("1") },
    });
    expect(shouldShowInstallPrompt()).toBe(false);
  });
});
