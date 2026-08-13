import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/child-rejoin/route";
import { makeRequest } from "../../helpers/request";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { family, childUser, parentUser } from "../../helpers/fixtures";
import { mockSupabaseUser } from "../../helpers/auth-mock";

const req = (body: Record<string, unknown>) => makeRequest("/api/auth/child-rejoin", body);

beforeEach(() => vi.clearAllMocks());

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
