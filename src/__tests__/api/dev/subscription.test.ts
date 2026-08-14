import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/dev/subscription/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { parentUserWithFamily, parentUser, subscription } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

/**
 * POST /api/dev/subscription 用のテスト専用リクエストビルダー。
 * ヘッダー(x-e2e-setup-secret)とボディを個別に指定できるようにする。
 * helpers/request.ts の makeRequest はヘッダーを指定できないためここでは使わない。
 */
function makeReq(opts?: {
  body?: Record<string, unknown>;
  secretHeader?: string;
}): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts?.secretHeader !== undefined) {
    headers["x-e2e-setup-secret"] = opts.secretHeader;
  }
  return new NextRequest("http://localhost/api/dev/subscription", {
    method: "POST",
    headers,
    body: JSON.stringify(opts?.body ?? {}),
  });
}

const VALID_SECRET = "test-e2e-secret";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  // デフォルトは「有効化 + 正しいシークレット + 認証済みPARENT + 家族にPARENTが存在」という
  // 全条件を満たす状態にしておき、各テストで必要な条件だけ崩す。
  vi.stubEnv("ALLOW_E2E_SETUP", "1");
  vi.stubEnv("E2E_SETUP_SECRET", VALID_SECRET);
  mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ id: "parent-1", familyId: "fam-1" }));
  mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1", familyId: "fam-1" }));
  mockPrisma.subscription.upsert.mockResolvedValue(
    subscription({ userId: "parent-1", plan: "PREMIUM", currentPeriodEnd: null }),
  );
});

describe("POST /api/dev/subscription — ガード条件（存在の隠蔽 + シークレット認証）", () => {
  it("ALLOW_E2E_SETUP が未設定(undefined)の場合、シークレットヘッダーが正しくても404を返すこと", async () => {
    const original = process.env.ALLOW_E2E_SETUP;
    delete process.env.ALLOW_E2E_SETUP;
    try {
      const res = await POST(makeReq({ secretHeader: VALID_SECRET }));
      expect(res.status).toBe(404);
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
    } finally {
      if (original !== undefined) process.env.ALLOW_E2E_SETUP = original;
    }
  });

  it("ALLOW_E2E_SETUP が '0' の場合、404を返すこと", async () => {
    vi.stubEnv("ALLOW_E2E_SETUP", "0");
    const res = await POST(makeReq({ secretHeader: VALID_SECRET }));
    expect(res.status).toBe(404);
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it("ALLOW_E2E_SETUP が 'false' の場合、404を返すこと", async () => {
    vi.stubEnv("ALLOW_E2E_SETUP", "false");
    const res = await POST(makeReq({ secretHeader: VALID_SECRET }));
    expect(res.status).toBe(404);
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it("ALLOW_E2E_SETUP が未設定の場合、シークレットヘッダーが誤っていても404を返すこと（存在を隠す）", async () => {
    vi.stubEnv("ALLOW_E2E_SETUP", "0");
    const res = await POST(makeReq({ secretHeader: "wrong-secret" }));
    expect(res.status).toBe(404);
  });

  it("ALLOW_E2E_SETUP=1 でもシークレットヘッダーが無い場合、401を返すこと", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it("ALLOW_E2E_SETUP=1 でもシークレットヘッダーが誤っている場合、401を返すこと", async () => {
    const res = await POST(makeReq({ secretHeader: "wrong-secret" }));
    expect(res.status).toBe(401);
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
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
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it("認証済みユーザーがfamilyIdを持たない場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(
      parentUserWithFamily({ id: "parent-1", familyId: null }, null),
    );
    const res = await POST(makeReq({ secretHeader: VALID_SECRET }));
    expect(res.status).toBe(400);
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it("リクエストボディで自分の家族と異なるfamilyIdを指定した場合、403を返すこと（他家族のプラン変更を防止）", async () => {
    const res = await POST(
      makeReq({ secretHeader: VALID_SECRET, body: { familyId: "other-fam" } }),
    );
    expect(res.status).toBe(403);
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it("家族にPARENTユーザーが見つからない場合、500を返すこと", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ secretHeader: VALID_SECRET }));
    expect(res.status).toBe(500);
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
  });
});

describe("POST /api/dev/subscription — 正常系", () => {
  it("全条件を満たす場合、家族のPARENTユーザーのSubscriptionをPREMIUM・無期限でupsertし200を返すこと", async () => {
    const res = await POST(makeReq({ secretHeader: VALID_SECRET }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.plan).toBe("PREMIUM");
    expect(body.currentPeriodEnd).toBeNull();

    expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith({
      where: { userId: "parent-1" },
      update: { plan: "PREMIUM", currentPeriodEnd: null },
      create: { userId: "parent-1", plan: "PREMIUM", currentPeriodEnd: null },
    });
  });

  it("既にSubscriptionが存在する家族に対して2回連続で呼んでも重複作成エラーにならず200を返すこと（upsertで冪等）", async () => {
    const res1 = await POST(makeReq({ secretHeader: VALID_SECRET }));
    const res2 = await POST(makeReq({ secretHeader: VALID_SECRET }));

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(mockPrisma.subscription.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
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
