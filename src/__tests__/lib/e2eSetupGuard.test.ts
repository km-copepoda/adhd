import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { checkE2eSetupGuard } from "@/lib/e2eSetupGuard";

function makeReq(secretHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (secretHeader !== undefined) headers["x-e2e-setup-secret"] = secretHeader;
  return new NextRequest("http://localhost/api/dev/subscription", { method: "POST", headers });
}

const SECRET = "test-e2e-secret";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("ALLOW_E2E_SETUP", "1");
  vi.stubEnv("E2E_SETUP_SECRET", SECRET);
});

describe("checkE2eSetupGuard — 有効化フラグ（404で存在を隠す）", () => {
  it("ALLOW_E2E_SETUP が未設定なら、シークレットが正しくても404", () => {
    delete process.env.ALLOW_E2E_SETUP;
    expect(checkE2eSetupGuard(makeReq(SECRET))?.status).toBe(404);
  });

  it.each(["0", " 1", "1 ", "true", "false", ""])("ALLOW_E2E_SETUP=%j は404", (v) => {
    vi.stubEnv("ALLOW_E2E_SETUP", v);
    expect(checkE2eSetupGuard(makeReq(SECRET))?.status).toBe(404);
  });

  it("フラグが無効なら、シークレットが誤っていても401ではなく404", () => {
    vi.stubEnv("ALLOW_E2E_SETUP", "0");
    expect(checkE2eSetupGuard(makeReq("wrong"))?.status).toBe(404);
  });
});

describe("checkE2eSetupGuard — シークレット認証（401）", () => {
  it("E2E_SETUP_SECRET が未設定なら401", () => {
    delete process.env.E2E_SETUP_SECRET;
    expect(checkE2eSetupGuard(makeReq(SECRET))?.status).toBe(401);
  });

  it("E2E_SETUP_SECRET が空文字で、ヘッダーも空文字でも401", () => {
    vi.stubEnv("E2E_SETUP_SECRET", "");
    expect(checkE2eSetupGuard(makeReq(""))?.status).toBe(401);
  });

  it("E2E_SETUP_SECRET が空文字で、ヘッダーなしでも401", () => {
    vi.stubEnv("E2E_SETUP_SECRET", "");
    expect(checkE2eSetupGuard(makeReq())?.status).toBe(401);
  });

  it("ヘッダーが無ければ401", () => {
    expect(checkE2eSetupGuard(makeReq())?.status).toBe(401);
  });

  it("ヘッダーが不一致なら401", () => {
    expect(checkE2eSetupGuard(makeReq("wrong-secret"))?.status).toBe(401);
  });

  it("ヘッダーが1文字違いでも401", () => {
    expect(checkE2eSetupGuard(makeReq(SECRET + "x"))?.status).toBe(401);
  });
});

describe("checkE2eSetupGuard — 通過", () => {
  it("フラグが '1' でシークレットが一致すれば null を返す", () => {
    expect(checkE2eSetupGuard(makeReq(SECRET))).toBeNull();
  });
});
