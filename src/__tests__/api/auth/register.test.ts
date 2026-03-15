import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/register/route";
import { prisma } from "@/lib/prisma";
import { makeRequest } from "../../helpers/request";
import { mockSupabaseUser } from "../../helpers/auth-mock";
import { family } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);

const req = (body: Record<string, unknown>) => makeRequest("/api/auth/register", body);

beforeEach(() => vi.clearAllMocks());

describe("POST /api/auth/register", () => {
  it("supabaseId がリクエストに含まれる場合、それを使用すること", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.family.create.mockResolvedValue(family({ code: "TEST12" }) as any);

    const res = await POST(req({ email: "test@example.com", supabaseId: "sup-1" }));
    const json = await res.json();

    expect(json.familyId).toBe("fam-1");
    expect(json.code).toBe("TEST12");
  });

  it("supabaseId がない場合、Supabase からセッション取得すること", async () => {
    mockSupabaseUser({ id: "sup-session" });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.family.create.mockResolvedValue(family({ id: "fam-2", code: "CODE22" }) as any);

    const res = await POST(req({ email: "test@test.com" }));
    expect((await res.json()).familyId).toBe("fam-2");
  });

  it("認証情報がない場合、401を返すこと", async () => {
    mockSupabaseUser(null);
    const res = await POST(req({ email: "test@test.com" }));
    expect(res.status).toBe(401);
  });

  it("既存ユーザーの場合、既存のfamilyIdを返すこと", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ familyId: "fam-existing" } as any);

    const res = await POST(req({ email: "test@test.com", supabaseId: "sup-exist" }));
    expect((await res.json()).familyId).toBe("fam-existing");
    expect(mockPrisma.family.create).not.toHaveBeenCalled();
  });

  it("emailからname抽出してPARENTユーザーを作成すること", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.family.create.mockResolvedValue(family() as any);

    await POST(req({ email: "papa@gmail.com", supabaseId: "sup-papa" }));

    expect(mockPrisma.family.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          users: expect.objectContaining({
            create: expect.objectContaining({ supabaseId: "sup-papa", role: "PARENT", name: "papa" }),
          }),
        }),
      }),
    );
  });

  it("emailがない場合、nameを 'parent' にフォールバックすること", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.family.create.mockResolvedValue(family() as any);

    await POST(req({ supabaseId: "sup-noemail" }));

    expect(mockPrisma.family.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          users: expect.objectContaining({
            create: expect.objectContaining({ name: "parent" }),
          }),
        }),
      }),
    );
  });
});
