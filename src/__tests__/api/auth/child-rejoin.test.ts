import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/child-rejoin/route";
import { makeRequest } from "../../helpers/request";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { family, childUser, parentUser } from "../../helpers/fixtures";
import { mockSupabaseUser } from "../../helpers/auth-mock";

const req = (body: Record<string, unknown>) => makeRequest("/api/auth/child-rejoin", body);

beforeEach(() => {
  vi.clearAllMocks();
  // デフォルトはロックなし
  mockPrisma.childRejoinAttempt.findUnique.mockResolvedValue(null);
});

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
  const locked = (key: string) =>
    mockPrisma.childRejoinAttempt.findUnique.mockImplementation((async (args: { where: { key: string } }) =>
      args.where.key === key
        ? { key, failCount: 99, lockedUntil: new Date(Date.now() + 60_000), updatedAt: new Date() }
        : null) as never);

  it("ユーザー単位でロック中なら429を返し、コード照合を行わないこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    locked("user:sup-new");
    const res = await POST(req({ familyCode: "ABC123", childCode: "1234" }));
    expect(res.status).toBe(429);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("ファミリーコード単位でロック中なら429を返すこと（大文字正規化後のキー）", async () => {
    mockSupabaseUser({ id: "sup-new" });
    locked("family:ABC123");
    const res = await POST(req({ familyCode: "abc123", childCode: "1234" }));
    expect(res.status).toBe(429);
    expect(mockPrisma.family.findUnique).not.toHaveBeenCalled();
  });

  it("子供コード不一致のとき、ユーザーとファミリー両方の失敗を記録して404を返すこと", async () => {
    mockSupabaseUser({ id: "sup-new" });
    mockPrisma.family.findUnique.mockResolvedValue(family());
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(req({ familyCode: "abc123", childCode: "9999" }));
    expect(res.status).toBe(404);
    const keys = mockPrisma.childRejoinAttempt.upsert.mock.calls.map((c) => c[0].where.key);
    expect(keys).toEqual(expect.arrayContaining(["user:sup-new", "family:ABC123"]));
  });

  it("ファミリーコード不一致でも失敗を記録すること", async () => {
    mockSupabaseUser({ id: "sup-new" });
    mockPrisma.family.findUnique.mockResolvedValue(null);
    await POST(req({ familyCode: "NOTFOU", childCode: "1234" }));
    expect(mockPrisma.childRejoinAttempt.upsert).toHaveBeenCalled();
  });

  it("成功時にユーザー単位のカウンタをリセットすること", async () => {
    mockSupabaseUser({ id: "sup-new" });
    mockPrisma.family.findUnique.mockResolvedValue(family());
    mockPrisma.user.findUnique.mockResolvedValue(childUser());
    mockPrisma.user.update.mockResolvedValue(childUser({ supabaseId: "sup-new" }));
    const res = await POST(req({ familyCode: "ABC123", childCode: "1234" }));
    expect(res.status).toBe(200);
    expect(mockPrisma.childRejoinAttempt.deleteMany).toHaveBeenCalledWith({
      where: { key: "user:sup-new" },
    });
    expect(mockPrisma.childRejoinAttempt.upsert).not.toHaveBeenCalled();
  });
});
