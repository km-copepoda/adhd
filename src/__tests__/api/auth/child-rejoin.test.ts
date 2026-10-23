import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/child-rejoin/route";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { childUser, parentUser } from "../../helpers/fixtures";
import { mockSupabaseUser } from "../../helpers/auth-mock";
import { IP_MAX_FAILURES } from "@/lib/childRejoinLimit";
import { hashLoginCode } from "@/lib/childLoginCode";
import { sendPushToParent } from "@/lib/push";

const mockSendPushToParent = vi.mocked(sendPushToParent);

const IP = "203.0.113.5";
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const ipKeyFor = (ip: string) => `ip:${sha256(ip)}`;

const req = (body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/auth/child-rejoin", {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
const withIp = { "x-real-ip": IP };

/** コード消費と付け替えを行う interactive transaction のクライアント */
type Tx = {
  $queryRaw: ReturnType<typeof vi.fn>;
  user: {
    updateMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
};
let tx: Tx;

/** 失敗カウンタの upsert（recordAttempt）は prismaMock.$queryRaw、コード消費は tx.$queryRaw */
const attempt = (failCount: number) =>
  mockPrisma.$queryRaw.mockResolvedValue([{ failCount, lockedUntil: null }] as never);

const attemptKeys = () => mockPrisma.$queryRaw.mock.calls.map((c) => c[1]);

function consumeReturns(childId: string | null) {
  tx.$queryRaw.mockResolvedValue(childId ? [{ childId }] : []);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.childRejoinAttempt.findUnique.mockResolvedValue(null);
  attempt(1); // 各キー1回目の試行（ロックなし）

  tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue(
        childUser({ supabaseId: "sup-new", monsterName: "ドラゴン", side: "DARK" }),
      ),
      findUnique: vi.fn().mockResolvedValue(
        childUser({ supabaseId: "sup-new", monsterName: "ドラゴン", side: "DARK" }),
      ),
    },
  };
  mockPrisma.$transaction.mockImplementation((async (fn: (t: Tx) => unknown) => fn(tx)) as never);
  mockPrisma.user.findMany.mockResolvedValue([parentUser({ id: "parent-1" })]);
  mockSendPushToParent.mockReset();
  mockSendPushToParent.mockResolvedValue(undefined);
});

describe("POST /api/auth/child-rejoin（ワンタイムのログインコード）", () => {
  it("有効なコードで再参加でき、コード消費と付け替えが同じ $transaction 内で行われること", async () => {
    mockSupabaseUser({ id: "sup-new" }); // anonymous session (no email)
    consumeReturns("child-1");

    const res = await POST(req({ loginCode: "ABCD2345" }, withIp));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ userId: "child-1", monsterName: "ドラゴン", side: "DARK" });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    // 消費（DELETE ... RETURNING）は tx 側で1回、ハッシュで照合
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0]).toContain(hashLoginCode("ABCD2345"));
    // 付け替えも tx 側
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "child-1" },
        data: { supabaseId: "sup-new" },
      }),
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("小文字・全角・空白区切りのコードも正規化して照合すること", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns("child-1");
    const res = await POST(req({ loginCode: " ａｂｃｄ-２３４５ " }, withIp));
    expect(res.status).toBe(200);
    expect(tx.$queryRaw.mock.calls[0]).toContain(hashLoginCode("ABCD2345"));
  });

  it("detachはCHILDロールのみ対象にし、PARENTのsupabaseIdを奪わないこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns("child-1");

    await POST(req({ loginCode: "ABCD2345" }, withIp));

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { supabaseId: "sup-new", id: { not: "child-1" }, role: "CHILD" },
      data: { supabaseId: expect.stringMatching(/^detached_/) },
    });
  });

  it("付け替えが失敗したら500を返し、親へ通知しないこと（トランザクションごと巻き戻る）", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns("child-1");
    tx.user.update.mockRejectedValue(new Error("db down"));

    const res = await POST(req({ loginCode: "ABCD2345" }, withIp));

    expect(res.status).toBe(500);
    expect(mockSendPushToParent).not.toHaveBeenCalled();
  });

  it("Supabaseセッションがない場合、401を返すこと", async () => {
    mockSupabaseUser(null);
    const res = await POST(req({ loginCode: "ABCD2345" }, withIp));
    expect(res.status).toBe(401);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("emailを持つセッション（親アカウント）の場合、403を返し、コードを消費しないこと", async () => {
    mockSupabaseUser({ id: "parent-id", email: "parent@example.com" });
    const res = await POST(req({ loginCode: "ABCD2345" }, withIp));
    expect(res.status).toBe(403);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    { label: "期限切れ / 使用済み / 不一致（消費が0件）" },
  ])("$label の場合、404を返し、付け替えず、失敗を数えること", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns(null);

    const res = await POST(req({ loginCode: "ABCD2345" }, withIp));

    expect(res.status).toBe(404);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(attemptKeys()).toContain("user:sup-new");
    expect(mockSendPushToParent).not.toHaveBeenCalled();
    expect(mockPrisma.childRejoinAttempt.deleteMany).not.toHaveBeenCalledWith({
      where: { key: "user:sup-new" },
    });
  });

  it("成功時はユーザー単位の失敗カウントをリセットすること", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns("child-1");
    await POST(req({ loginCode: "ABCD2345" }, withIp));
    expect(mockPrisma.childRejoinAttempt.deleteMany).toHaveBeenCalledWith({
      where: { key: "user:sup-new" },
    });
  });
});

describe("入力検証（#184）", () => {
  it.each([
    { label: "旧仕様 { familyCode, childCode }", body: { familyCode: "ABC123", childCode: "1234" } },
    { label: "loginCode がない", body: {} },
    { label: "loginCode が空", body: { loginCode: "" } },
    { label: "loginCode が数値", body: { loginCode: 12345678 } },
    { label: "loginCode がオブジェクト", body: { loginCode: {} } },
    { label: "loginCode が配列", body: { loginCode: ["ABCD2345"] } },
    { label: "loginCode が null", body: { loginCode: null } },
    { label: "正規化後7文字（短い）", body: { loginCode: "ABCD234" } },
    { label: "正規化後9文字（長い）", body: { loginCode: "ABCD23456" } },
    { label: "許可外の文字ばかりで正規化後に空", body: { loginCode: "I0O1-!!!" } },
    { label: "極端に長い文字列", body: { loginCode: "A".repeat(10_000) } },
  ])("$label の場合、500ではなく400を返し、コードを消費しないこと", async ({ body }) => {
    mockSupabaseUser({ id: "sup-new" });
    const res = await POST(req(body as Record<string, unknown>, withIp));
    expect(res.status).toBe(400);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("JSON として不正なボディは400を返すこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    const bad = new NextRequest("http://localhost/api/auth/child-rejoin", {
      method: "POST",
      body: "{not json",
      headers: withIp,
    });
    expect((await POST(bad)).status).toBe(400);
  });

  it("正規化後ちょうど8文字なら受理されること（境界）", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns("child-1");
    expect((await POST(req({ loginCode: "ABCD2345" }, withIp))).status).toBe(200);
  });
});

describe("親への Push 通知（#184）", () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("成功時、同じ家族の全 PARENT に Push を送ること", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns("child-1");
    mockPrisma.user.findMany.mockResolvedValue([
      parentUser({ id: "parent-1" }),
      parentUser({ id: "parent-2" }),
    ]);

    const res = await POST(req({ loginCode: "ABCD2345" }, withIp));
    await flush();

    expect(res.status).toBe(200);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { familyId: "fam-1", role: "PARENT" } }),
    );
    expect(mockSendPushToParent).toHaveBeenCalledTimes(2);
    expect(mockSendPushToParent).toHaveBeenCalledWith(
      "parent-1",
      expect.objectContaining({ title: expect.any(String), body: expect.any(String) }),
    );
    expect(mockSendPushToParent).toHaveBeenCalledWith("parent-2", expect.anything());
  });

  it("Push が失敗しても200を返すこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns("child-1");
    mockSendPushToParent.mockRejectedValue(new Error("push down"));

    const res = await POST(req({ loginCode: "ABCD2345" }, withIp));
    await flush();

    expect(res.status).toBe(200);
  });

  it("親の取得に失敗しても200を返すこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns("child-1");
    mockPrisma.user.findMany.mockRejectedValue(new Error("db down"));

    const res = await POST(req({ loginCode: "ABCD2345" }, withIp));
    await flush();

    expect(res.status).toBe(200);
  });
});

describe("レート制限・失敗ロック（#184）", () => {
  const lockedUser = (key: string) =>
    mockPrisma.childRejoinAttempt.findUnique.mockImplementation((async (args: {
      where: { key: string };
    }) =>
      args.where.key === key
        ? { key, failCount: 99, lockedUntil: new Date(Date.now() + 60_000), updatedAt: new Date() }
        : null) as never);

  it("ユーザー単位でロック中なら429を返し、コードを消費しないこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    lockedUser("user:sup-new");
    const res = await POST(req({ loginCode: "ABCD2345" }, withIp));
    expect(res.status).toBe(429);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("IP単位の試行が上限を超えたら429を返し、有効なコードでも消費しないこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    attempt(IP_MAX_FAILURES + 1);
    consumeReturns("child-1");
    const res = await POST(req({ loginCode: "ABCD2345" }, withIp));
    expect(res.status).toBe(429);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("IP単位の上限ちょうどの試行はまだ照合されること（境界）", async () => {
    mockSupabaseUser({ id: "sup-new" });
    attempt(IP_MAX_FAILURES);
    consumeReturns("child-1");
    const res = await POST(req({ loginCode: "ABCD2345" }, withIp));
    expect(res.status).toBe(200);
  });

  it("IP は x-real-ip を優先し、sha256 したキーで数えること（生のIPをキーに使わない）", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns("child-1");
    const res = await POST(
      req({ loginCode: "ABCD2345" }, { "x-real-ip": IP, "x-forwarded-for": "198.51.100.9, 10.0.0.1" }),
    );
    expect(res.status).toBe(200);
    expect(attemptKeys()).toEqual([ipKeyFor(IP)]); // 成功時はIP単位の1回のみ
    expect(JSON.stringify(mockPrisma.$queryRaw.mock.calls)).not.toContain(IP);
  });

  it("x-real-ip がなければ x-forwarded-for の先頭を使うこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns("child-1");
    await POST(req({ loginCode: "ABCD2345" }, { "x-forwarded-for": ` ${IP} , 10.0.0.1` }));
    expect(attemptKeys()).toEqual([ipKeyFor(IP)]);
  });

  it("IP が取れないときは IP 単位の制限を使わない（共通キーに全員を押し込まない）", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns("child-1");
    const res = await POST(req({ loginCode: "ABCD2345" }));
    expect(res.status).toBe(200);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("IP が取れなくても失敗時はユーザー単位で数えること", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns(null);
    const res = await POST(req({ loginCode: "ABCD2345" }));
    expect(res.status).toBe(404);
    expect(attemptKeys()).toEqual(["user:sup-new"]);
  });

  it("失敗時はIP単位（照合の前）とユーザー単位（失敗後）の両方を数えること", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns(null);
    const res = await POST(req({ loginCode: "ABCD2345" }, withIp));
    expect(res.status).toBe(404);
    expect(attemptKeys()).toEqual([ipKeyFor(IP), "user:sup-new"]);
  });

  it("極端に長い x-real-ip でもキーは固定長（sha256）で、500にならないこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns("child-1");
    const res = await POST(req({ loginCode: "ABCD2345" }, { "x-real-ip": "9".repeat(5000) }));
    expect(res.status).not.toBe(500);
    for (const key of attemptKeys()) {
      expect(String(key).length).toBeLessThanOrEqual(80);
    }
  });

  it("新しいウィンドウの最初の試行（count=1）で期限切れ行を掃除すること", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns(null);
    attempt(1);
    await POST(req({ loginCode: "ABCD2345" }, withIp));
    const purged = mockPrisma.childRejoinAttempt.deleteMany.mock.calls.some(
      (c) => (c[0] as { where: { updatedAt?: unknown } }).where.updatedAt !== undefined,
    );
    expect(purged).toBe(true);
  });

  it("count>1 のときは掃除しないこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    consumeReturns(null);
    attempt(2);
    await POST(req({ loginCode: "ABCD2345" }, withIp));
    expect(mockPrisma.childRejoinAttempt.deleteMany).not.toHaveBeenCalled();
  });
});
