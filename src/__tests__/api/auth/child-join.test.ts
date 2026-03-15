import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/child-join/route";
import { prisma } from "@/lib/prisma";
import { makeRequest } from "../../helpers/request";
import { mockSupabaseWithAnonymous, mockSupabaseUser } from "../../helpers/auth-mock";
import { family } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);

const req = (body: Record<string, unknown>) => makeRequest("/api/auth/child-join", body);

beforeEach(() => vi.clearAllMocks());

describe("POST /api/auth/child-join", () => {
  it("認証済みユーザーで子どもアカウントを作成すること", async () => {
    mockSupabaseUser({ id: "sup-child" });
    mockPrisma.family.findUnique.mockResolvedValue(family() as any);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.upsert.mockResolvedValue({ id: "db-child", childCode: "1234" } as any);

    const res = await POST(req({ monsterName: "ピカチュウ", side: "LIGHT", familyCode: "ABCDEF" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ userId: "db-child", childCode: "1234" });
  });

  it("未認証の場合、匿名サインインすること", async () => {
    mockSupabaseWithAnonymous(null, { id: "sup-anon" });
    mockPrisma.family.findUnique.mockResolvedValue(family() as any);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.upsert.mockResolvedValue({ id: "db-anon", childCode: "5678" } as any);

    const json = await (await POST(req({ monsterName: "ドラゴン", side: "DARK", familyCode: "XYZABC" }))).json();
    expect(json.userId).toBe("db-anon");
  });

  it("匿名サインイン失敗時に400を返すこと", async () => {
    mockSupabaseWithAnonymous(null, null);
    const res = await POST(req({ monsterName: "test", side: "LIGHT", familyCode: "ABC123" }));
    expect(res.status).toBe(400);
  });

  it("存在しないファミリーコードで404を返すこと", async () => {
    mockSupabaseUser({ id: "sup-1" });
    mockPrisma.family.findUnique.mockResolvedValue(null);
    const res = await POST(req({ monsterName: "test", side: "LIGHT", familyCode: "NONEXIST" }));
    expect(res.status).toBe(404);
  });

  it("ファミリーコードが小文字でも大文字変換して検索すること", async () => {
    mockSupabaseUser({ id: "sup-1" });
    mockPrisma.family.findUnique.mockResolvedValue(family() as any);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.upsert.mockResolvedValue({ id: "db-x", childCode: "0000" } as any);

    await POST(req({ monsterName: "test", side: "DARK", familyCode: "abcdef" }));
    expect(mockPrisma.family.findUnique).toHaveBeenCalledWith({ where: { code: "ABCDEF" } });
  });

  it("ファミリーコードなしでも参加可能であること", async () => {
    mockSupabaseUser({ id: "sup-nofam" });
    mockPrisma.user.upsert.mockResolvedValue({ id: "db-nofam", childCode: null } as any);

    const res = await POST(req({ monsterName: "ソロ", side: "LIGHT", familyCode: "" }));
    expect(res.status).toBe(200);
  });

  it("childCodeが重複する場合、リトライすること", async () => {
    mockSupabaseUser({ id: "sup-retry" });
    mockPrisma.family.findUnique.mockResolvedValue(family({ id: "fam-dup" }) as any);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: "existing" } as any)
      .mockResolvedValueOnce(null);
    mockPrisma.user.upsert.mockResolvedValue({ id: "db-retry", childCode: "9999" } as any);

    const res = await POST(req({ monsterName: "リトライ", side: "DARK", familyCode: "DUPFAM" }));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2);
  });
});
