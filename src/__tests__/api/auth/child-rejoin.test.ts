import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/child-rejoin/route";
import { prisma } from "@/lib/prisma";
import { makeRequest } from "../../helpers/request";
import { family, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);

const req = (body: Record<string, unknown>) => makeRequest("/api/auth/child-rejoin", body);

beforeEach(() => vi.clearAllMocks());

describe("POST /api/auth/child-rejoin", () => {
  it("正しいコードの組み合わせで再参加できること", async () => {
    mockPrisma.family.findUnique.mockResolvedValue(family() as any);
    mockPrisma.user.findUnique.mockResolvedValue(childUser({ monsterName: "ドラゴン", side: "DARK" }) as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    const res = await POST(req({ familyCode: "ABC123", childCode: "1234", supabaseUserId: "sup-new" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ userId: "child-1", monsterName: "ドラゴン", side: "DARK" });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { supabaseId: "sup-new" },
    });
  });

  it.each([
    { label: "ファミリーコードが空", body: { familyCode: "", childCode: "1234", supabaseUserId: "s" } },
    { label: "ユーザーコードが空", body: { familyCode: "ABC123", childCode: "", supabaseUserId: "s" } },
    { label: "supabaseUserIdがない", body: { familyCode: "ABC123", childCode: "1234" } },
  ])("$label の場合、400を返すこと", async ({ body }) => {
    const res = await POST(req(body));
    expect(res.status).toBe(400);
  });

  it("存在しないファミリーコードで404を返すこと", async () => {
    mockPrisma.family.findUnique.mockResolvedValue(null);
    const res = await POST(req({ familyCode: "NOTFOUND", childCode: "1234", supabaseUserId: "s" }));
    expect(res.status).toBe(404);
  });

  it("子どもコードが見つからない場合、404を返すこと", async () => {
    mockPrisma.family.findUnique.mockResolvedValue(family() as any);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(req({ familyCode: "ABC123", childCode: "9999", supabaseUserId: "s" }));
    expect(res.status).toBe(404);
  });

  it("PARENTロールのユーザーでは再参加できないこと", async () => {
    mockPrisma.family.findUnique.mockResolvedValue(family() as any);
    mockPrisma.user.findUnique.mockResolvedValue({ id: "p-1", role: "PARENT" } as any);
    const res = await POST(req({ familyCode: "ABC123", childCode: "1234", supabaseUserId: "s" }));
    expect(res.status).toBe(404);
  });

  it("ファミリーコードを大文字変換して検索すること", async () => {
    mockPrisma.family.findUnique.mockResolvedValue(family() as any);
    mockPrisma.user.findUnique.mockResolvedValue(childUser() as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    await POST(req({ familyCode: "abc123", childCode: "5678", supabaseUserId: "s" }));
    expect(mockPrisma.family.findUnique).toHaveBeenCalledWith({ where: { code: "ABC123" } });
  });

  it("detachはCHILDロールのみ対象にし、PARENTのsupabaseIdを奪わないこと", async () => {
    mockPrisma.family.findUnique.mockResolvedValue(family() as any);
    mockPrisma.user.findUnique.mockResolvedValue(childUser({ monsterName: "ドラゴン", side: "DARK" }) as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    await POST(req({ familyCode: "ABC123", childCode: "1234", supabaseUserId: "sup-new" }));

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { supabaseId: "sup-new", id: { not: "child-1" }, role: "CHILD" },
      data: { supabaseId: expect.stringMatching(/^detached_/) },
    });
  });
});
