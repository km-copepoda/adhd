import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/child-rejoin/route";
import { makeRequest } from "../../helpers/request";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { family, childUser, parentUser } from "../../helpers/fixtures";
import { mockSupabaseUser } from "../../helpers/auth-mock";
import { FAMILY_MAX_FAILURES } from "@/lib/childRejoinLimit";

const req = (body: Record<string, unknown>) => makeRequest("/api/auth/child-rejoin", body);

beforeEach(() => {
  vi.clearAllMocks();
  // デフォルトはロックなし
  mockPrisma.childRejoinAttempt.findUnique.mockResolvedValue(null);
  attempt(1); // 各キー1回目の試行（ロックなし）
});

const attempt = (failCount: number) =>
  mockPrisma.$queryRaw.mockResolvedValue([{ failCount, lockedUntil: null }] as never);

describe("POST /api/auth/child-rejoin", () => {
  it("正しいコードの組み合わせで再参加できること", async () => {
    mockSupabaseUser({ id: "sup-new" }); // anonymous session (no email)
    mockPrisma.family.findUnique.mockResolvedValue(family());
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ monsterName: "ドラゴン", side: "DARK" }),
    );
    mockPrisma.user.update.mockResolvedValue(childUser({ supabaseId: "sup-new" }));

    const res = await POST(req({ familyCode: "ABC123", childCode: "1234" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ userId: "child-1", monsterName: "ドラゴン", side: "DARK" });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { supabaseId: "sup-new" },
    });
  });

  it.each([
    { label: "ファミリーコードが空", body: { familyCode: "", childCode: "1234" } },
    { label: "ユーザーコードが空", body: { familyCode: "ABC123", childCode: "" } },
  ])("$label の場合、400を返すこと", async ({ body }) => {
    mockSupabaseUser({ id: "sup-new" });
    const res = await POST(req(body));
    expect(res.status).toBe(400);
  });

  it("Supabaseセッションがない場合、401を返すこと", async () => {
    mockSupabaseUser(null);
    const res = await POST(req({ familyCode: "ABC123", childCode: "1234" }));
    expect(res.status).toBe(401);
  });

  it("emailを持つセッション（親アカウント）の場合、403を返すこと", async () => {
    mockSupabaseUser({ id: "parent-id", email: "parent@example.com" });
    const res = await POST(req({ familyCode: "ABC123", childCode: "1234" }));
    expect(res.status).toBe(403);
  });

  it("存在しないファミリーコードで404を返すこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    mockPrisma.family.findUnique.mockResolvedValue(null);
    const res = await POST(req({ familyCode: "NOTFOUND", childCode: "1234" }));
    expect(res.status).toBe(404);
  });

  it("子どもコードが見つからない場合、404を返すこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    mockPrisma.family.findUnique.mockResolvedValue(family());
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(req({ familyCode: "ABC123", childCode: "9999" }));
    expect(res.status).toBe(404);
  });

  it("PARENTロールのユーザーでは再参加できないこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    mockPrisma.family.findUnique.mockResolvedValue(family());
    mockPrisma.user.findUnique.mockResolvedValue(parentUser({ id: "p-1" }));
    const res = await POST(req({ familyCode: "ABC123", childCode: "1234" }));
    expect(res.status).toBe(404);
  });

  it("ファミリーコードを大文字変換して検索すること", async () => {
    mockSupabaseUser({ id: "sup-new" });
    mockPrisma.family.findUnique.mockResolvedValue(family());
    mockPrisma.user.findUnique.mockResolvedValue(childUser());
    mockPrisma.user.update.mockResolvedValue(childUser({ supabaseId: "sup-new" }));

    await POST(req({ familyCode: "abc123", childCode: "5678" }));
    expect(mockPrisma.family.findUnique).toHaveBeenCalledWith({ where: { code: "ABC123" } });
  });

  it("detachはCHILDロールのみ対象にし、PARENTのsupabaseIdを奪わないこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    mockPrisma.family.findUnique.mockResolvedValue(family());
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ monsterName: "ドラゴン", side: "DARK" }),
    );
    mockPrisma.user.update.mockResolvedValue(childUser({ supabaseId: "sup-new" }));

    await POST(req({ familyCode: "ABC123", childCode: "1234" }));

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { supabaseId: "sup-new", id: { not: "child-1" }, role: "CHILD" },
      data: { supabaseId: expect.stringMatching(/^detached_/) },
    });
  });
});

describe("入力の型検証（#184）", () => {
  it.each([
    { label: "familyCodeが数値", body: { familyCode: 123456, childCode: "1234" } },
    { label: "childCodeが数値", body: { familyCode: "ABC123", childCode: 1234 } },
    { label: "familyCodeがオブジェクト", body: { familyCode: {}, childCode: "1234" } },
    { label: "childCodeが配列", body: { familyCode: "ABC123", childCode: ["1"] } },
    { label: "familyCodeが長すぎる", body: { familyCode: "A".repeat(33), childCode: "1234" } },
    { label: "childCodeが長すぎる", body: { familyCode: "ABC123", childCode: "1".repeat(17) } },
  ])("$label の場合、500ではなく400を返すこと", async ({ body }) => {
    mockSupabaseUser({ id: "sup-new" });
    const res = await POST(req(body));
    expect(res.status).toBe(400);
  });
});

describe("レート制限・失敗ロック（#184）", () => {
  const lockedUser = (key: string) =>
    mockPrisma.childRejoinAttempt.findUnique.mockImplementation((async (args: { where: { key: string } }) =>
      args.where.key === key
        ? { key, failCount: 99, lockedUntil: new Date(Date.now() + 60_000), updatedAt: new Date() }
        : null) as never);

  it("ユーザー単位でロック中なら429を返し、コード照合を行わないこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    lockedUser("user:sup-new");
    const res = await POST(req({ familyCode: "ABC123", childCode: "1234" }));
    expect(res.status).toBe(429);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("ファミリー単位の試行が上限を超えたら429を返し、照合しないこと（成功コードでも拒否）", async () => {
    mockSupabaseUser({ id: "sup-new" });
    attempt(FAMILY_MAX_FAILURES + 1);
    const res = await POST(req({ familyCode: "abc123", childCode: "1234" }));
    expect(res.status).toBe(429);
    expect(mockPrisma.family.findUnique).not.toHaveBeenCalled();
  });

  it("上限ちょうどの試行はまだ照合されること（境界）", async () => {
    mockSupabaseUser({ id: "sup-new" });
    attempt(FAMILY_MAX_FAILURES);
    mockPrisma.family.findUnique.mockResolvedValue(family());
    mockPrisma.user.findUnique.mockResolvedValue(childUser());
    mockPrisma.user.update.mockResolvedValue(childUser({ supabaseId: "sup-new" }));
    const res = await POST(req({ familyCode: "ABC123", childCode: "1234" }));
    expect(res.status).toBe(200);
  });

  it("照合の前にファミリー単位の試行を数えること（成功時もリセットしない）", async () => {
    mockSupabaseUser({ id: "sup-new" });
    mockPrisma.family.findUnique.mockResolvedValue(family());
    mockPrisma.user.findUnique.mockResolvedValue(childUser());
    mockPrisma.user.update.mockResolvedValue(childUser({ supabaseId: "sup-new" }));
    const res = await POST(req({ familyCode: "ABC123", childCode: "1234" }));
    expect(res.status).toBe(200);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$queryRaw.mock.calls[0]).toContain("family:ABC123");
    expect(mockPrisma.childRejoinAttempt.deleteMany).toHaveBeenCalledWith({
      where: { key: "user:sup-new" },
    });
  });

  it("コード不一致のとき、ユーザー単位の失敗も数えて404を返すこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    mockPrisma.family.findUnique.mockResolvedValue(family());
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(req({ familyCode: "abc123", childCode: "9999" }));
    expect(res.status).toBe(404);
    const keys = mockPrisma.$queryRaw.mock.calls.map((c) => c[1]);
    expect(keys).toEqual(expect.arrayContaining(["family:ABC123", "user:sup-new"]));
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("存在しないファミリーコードでも失敗を数えること", async () => {
    mockSupabaseUser({ id: "sup-new" });
    mockPrisma.family.findUnique.mockResolvedValue(null);
    await POST(req({ familyCode: "NOTFOU", childCode: "1234" }));
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("新しいウィンドウの最初の試行（count=1）で期限切れ行を掃除すること", async () => {
    mockSupabaseUser({ id: "sup-new" });
    mockPrisma.family.findUnique.mockResolvedValue(null);
    attempt(1);
    await POST(req({ familyCode: "NOTFOU", childCode: "1234" }));
    const purged = mockPrisma.childRejoinAttempt.deleteMany.mock.calls.some(
      (c) => (c[0] as { where: { updatedAt?: unknown } }).where.updatedAt !== undefined,
    );
    expect(purged).toBe(true);
  });

  it("count>1 のときは掃除しないこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    mockPrisma.family.findUnique.mockResolvedValue(null);
    attempt(2);
    await POST(req({ familyCode: "NOTFOU", childCode: "1234" }));
    expect(mockPrisma.childRejoinAttempt.deleteMany).not.toHaveBeenCalled();
  });
});
