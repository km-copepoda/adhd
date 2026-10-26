import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/subscriptionService", () => ({
  grantPremiumForE2E: vi.fn(),
  cancelE2ePremium: vi.fn(),
}));

import { POST, DELETE } from "@/app/api/dev/subscription/route";
import { getCurrentUser } from "@/lib/auth";
import { grantPremiumForE2E, cancelE2ePremium } from "@/lib/subscriptionService";
import { parentUserWithFamily, childUserWithFamily } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockGrant = vi.mocked(grantPremiumForE2E);
const mockCancel = vi.mocked(cancelE2ePremium);

/**
 * /api/dev/subscription 用のテスト専用リクエストビルダー。
 * ヘッダー(x-e2e-setup-secret)とボディを個別に指定できるようにする。
 * helpers/request.ts の makeRequest はヘッダーを指定できないためここでは使わない。
 */
function makeReq(opts?: {
  body?: Record<string, unknown>;
  secretHeader?: string;
  method?: "POST" | "DELETE";
}): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts?.secretHeader !== undefined) {
    headers["x-e2e-setup-secret"] = opts.secretHeader;
  }
  return new NextRequest("http://localhost/api/dev/subscription", {
    method: opts?.method ?? "POST",
    headers,
    body: JSON.stringify(opts?.body ?? {}),
  });
}

const VALID_SECRET = "test-e2e-secret";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  // デフォルトは「有効化 + 正しいシークレット + 認証済みPARENT」という全条件を満たす状態にしておき、
  // 各テストで必要な条件だけ崩す。
  vi.stubEnv("ALLOW_E2E_SETUP", "1");
  vi.stubEnv("E2E_SETUP_SECRET", VALID_SECRET);
  mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ id: "parent-1", familyId: "fam-1" }));
  mockGrant.mockResolvedValue({ status: "granted" });
  mockCancel.mockResolvedValue({ status: "canceled" });
});

describe("POST /api/dev/subscription — ガード条件（存在の隠蔽 + シークレット認証）", () => {
  it("ALLOW_E2E_SETUP が未設定(undefined)の場合、シークレットヘッダーが正しくても404を返すこと", async () => {
    const original = process.env.ALLOW_E2E_SETUP;
    delete process.env.ALLOW_E2E_SETUP;
    try {
      const res = await POST(makeReq({ secretHeader: VALID_SECRET }));
      expect(res.status).toBe(404);
      expect(mockGrant).not.toHaveBeenCalled();
    } finally {
      if (original !== undefined) process.env.ALLOW_E2E_SETUP = original;
    }
  });

  it("ALLOW_E2E_SETUP が '0' の場合、404を返すこと", async () => {
    vi.stubEnv("ALLOW_E2E_SETUP", "0");
    const res = await POST(makeReq({ secretHeader: VALID_SECRET }));
    expect(res.status).toBe(404);
    expect(mockGrant).not.toHaveBeenCalled();
  });

  it("ALLOW_E2E_SETUP が 'false' の場合、404を返すこと", async () => {
    vi.stubEnv("ALLOW_E2E_SETUP", "false");
    const res = await POST(makeReq({ secretHeader: VALID_SECRET }));
    expect(res.status).toBe(404);
    expect(mockGrant).not.toHaveBeenCalled();
  });

  it("ALLOW_E2E_SETUP が未設定の場合、シークレットヘッダーが誤っていても404を返すこと（存在を隠す）", async () => {
    vi.stubEnv("ALLOW_E2E_SETUP", "0");
    const res = await POST(makeReq({ secretHeader: "wrong-secret" }));
    expect(res.status).toBe(404);
  });

  it("ALLOW_E2E_SETUP=1 でもシークレットヘッダーが無い場合、401を返すこと", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    expect(mockGrant).not.toHaveBeenCalled();
  });

  it("ALLOW_E2E_SETUP=1 でもシークレットヘッダーが誤っている場合、401を返すこと", async () => {
    const res = await POST(makeReq({ secretHeader: "wrong-secret" }));
    expect(res.status).toBe(401);
    expect(mockGrant).not.toHaveBeenCalled();
  });

  it("E2E_SETUP_SECRET が未設定の場合、どんなヘッダー値でも401を返すこと", async () => {
    vi.stubEnv("E2E_SETUP_SECRET", "");
    const res = await POST(makeReq({ secretHeader: "" }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/dev/subscription — 認証・入力検証", () => {
  it("未認証（getCurrentUserがnull）の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeReq({ secretHeader: VALID_SECRET }));
    expect(res.status).toBe(403);
    expect(mockGrant).not.toHaveBeenCalled();
  });

  it("CHILD ユーザーの場合、403を返しPREMIUMを付与しないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1", familyId: "fam-1" }));
    const res = await POST(makeReq({ secretHeader: VALID_SECRET }));
    expect(res.status).toBe(403);
    expect(mockGrant).not.toHaveBeenCalled();
  });

  it("認証済みユーザーがfamilyIdを持たない場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(
      parentUserWithFamily({ id: "parent-1", familyId: null }, null),
    );
    const res = await POST(makeReq({ secretHeader: VALID_SECRET }));
    expect(res.status).toBe(400);
    expect(mockGrant).not.toHaveBeenCalled();
  });

  it("リクエストボディで自分の家族と異なるfamilyIdを指定した場合、403を返すこと（他家族のプラン変更を防止）", async () => {
    const res = await POST(
      makeReq({ secretHeader: VALID_SECRET, body: { familyId: "other-fam" } }),
    );
    expect(res.status).toBe(403);
    expect(mockGrant).not.toHaveBeenCalled();
  });
});

describe("POST /api/dev/subscription — 正常系", () => {
  it("全条件を満たす場合、認証した本人の userId で grantPremiumForE2E を呼び200を返すこと", async () => {
    const res = await POST(makeReq({ secretHeader: VALID_SECRET }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.plan).toBe("PREMIUM");
    expect(body.currentPeriodEnd).toBeNull();

    expect(mockGrant).toHaveBeenCalledTimes(1);
    expect(mockGrant).toHaveBeenCalledWith("parent-1");
  });

  it("grantPremiumForE2E が not_eligible を返す場合、409を返すこと（一般の課金行は書き換えない）", async () => {
    mockGrant.mockResolvedValue({ status: "not_eligible" });
    const res = await POST(makeReq({ secretHeader: VALID_SECRET }));
    expect(res.status).toBe(409);
  });

  it("2回連続で呼んでも200を返すこと", async () => {
    const res1 = await POST(makeReq({ secretHeader: VALID_SECRET }));
    const res2 = await POST(makeReq({ secretHeader: VALID_SECRET }));
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(mockGrant).toHaveBeenCalledTimes(2);
  });

  it("リクエストボディに自分自身のfamilyIdを明示指定しても正常に処理されること", async () => {
    const res = await POST(
      makeReq({ secretHeader: VALID_SECRET, body: { familyId: "fam-1" } }),
    );
    expect(res.status).toBe(200);
  });

  it("レスポンスに機密情報（supabaseId・email・userId等）を含まないこと", async () => {
    const res = await POST(makeReq({ secretHeader: VALID_SECRET }));
    const body = await res.json();
    expect(body).not.toHaveProperty("supabaseId");
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("userId");
    expect(body).not.toHaveProperty("id");
  });
});

describe("DELETE /api/dev/subscription — ガード条件", () => {
  const del = (opts?: Parameters<typeof makeReq>[0]) => DELETE(makeReq({ ...opts, method: "DELETE" }));

  it("ALLOW_E2E_SETUP が未設定なら404", async () => {
    delete process.env.ALLOW_E2E_SETUP;
    const res = await del({ secretHeader: VALID_SECRET });
    expect(res.status).toBe(404);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("ALLOW_E2E_SETUP が '0' なら404", async () => {
    vi.stubEnv("ALLOW_E2E_SETUP", "0");
    const res = await del({ secretHeader: VALID_SECRET });
    expect(res.status).toBe(404);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("シークレットヘッダーが無ければ401", async () => {
    const res = await del();
    expect(res.status).toBe(401);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("シークレットが誤っていれば401", async () => {
    const res = await del({ secretHeader: "wrong-secret" });
    expect(res.status).toBe(401);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("E2E_SETUP_SECRET が未設定なら401", async () => {
    vi.stubEnv("E2E_SETUP_SECRET", "");
    const res = await del({ secretHeader: "" });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/dev/subscription — 認証・入力検証", () => {
  const del = (opts?: Parameters<typeof makeReq>[0]) =>
    DELETE(makeReq({ secretHeader: VALID_SECRET, ...opts, method: "DELETE" }));

  it("未認証なら403", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await del();
    expect(res.status).toBe(403);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("CHILD なら403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1", familyId: "fam-1" }));
    const res = await del();
    expect(res.status).toBe(403);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("familyId を持たない場合は400", async () => {
    mockGetCurrentUser.mockResolvedValue(
      parentUserWithFamily({ id: "parent-1", familyId: null }, null),
    );
    const res = await del();
    expect(res.status).toBe(400);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("body の familyId が自分の家族と違えば403", async () => {
    const res = await del({ body: { familyId: "other-fam" } });
    expect(res.status).toBe(403);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("body の familyId が自分の家族なら通る", async () => {
    const res = await del({ body: { familyId: "fam-1" } });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/dev/subscription — 正常系・status 対応", () => {
  const del = () => DELETE(makeReq({ secretHeader: VALID_SECRET, method: "DELETE" }));

  it("認証した本人の userId で cancelE2ePremium を呼ぶこと", async () => {
    await del();
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel.mock.calls[0][0]).toBe("parent-1");
    expect(mockCancel.mock.calls[0][1]).toBeInstanceOf(Date);
  });

  it("canceled は 200 { ok: true, status: 'canceled' }", async () => {
    mockCancel.mockResolvedValue({ status: "canceled" });
    const res = await del();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: "canceled" });
  });

  it("already_canceled は 200 { ok: true, status: 'already_canceled' }", async () => {
    mockCancel.mockResolvedValue({ status: "already_canceled" });
    const res = await del();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: "already_canceled" });
  });

  it("not_found は 404", async () => {
    mockCancel.mockResolvedValue({ status: "not_found" });
    const res = await del();
    expect(res.status).toBe(404);
  });

  it("not_eligible は 409", async () => {
    mockCancel.mockResolvedValue({ status: "not_eligible" });
    const res = await del();
    expect(res.status).toBe(409);
  });
});
