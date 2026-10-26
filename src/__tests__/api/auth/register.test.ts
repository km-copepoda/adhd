import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/register/route";
import { makeRequest } from "../../helpers/request";
import { mockSupabaseUser } from "../../helpers/auth-mock";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { family, parentUser } from "../../helpers/fixtures";

const req = (body: Record<string, unknown> = {}) => makeRequest("/api/auth/register", body);

beforeEach(() => vi.clearAllMocks());

describe("POST /api/auth/register", () => {
  it("body の supabaseId ではなくセッションのユーザーIDを使うこと", async () => {
    mockSupabaseUser({ id: "sup-session", email: "papa@gmail.com" });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.family.create.mockResolvedValue(family({ id: "fam-2", code: "CODE22" }));

    const res = await POST(req({ email: "evil@example.com", supabaseId: "sup-victim" }));
    expect((await res.json()).familyId).toBe("fam-2");

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { supabaseId: "sup-session" } });
    expect(mockPrisma.family.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          users: {
            create: { supabaseId: "sup-session", role: "PARENT", name: "papa" },
          },
        }),
      }),
    );
  });

  it("Authorization の Bearer トークンがある場合、そのトークンを getUser で検証して使うこと", async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "sup-token", email: "tok@gmail.com" } } });
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser } } as unknown as SupabaseClient);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.family.create.mockResolvedValue(family({ id: "fam-3", code: "CODE33" }));

    const r = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      headers: { Authorization: "Bearer tok-abc" },
    });
    const res = await POST(r);
    expect(res.status).toBe(200);
    expect(getUser).toHaveBeenCalledWith("tok-abc");
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { supabaseId: "sup-token" } });
  });

  it("未認証の場合、401を返し何も作成しないこと", async () => {
    mockSupabaseUser(null);
    const res = await POST(req({ supabaseId: "sup-victim" }));
    expect(res.status).toBe(401);
    expect(mockPrisma.family.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("emailのない匿名ユーザーは403で拒否すること", async () => {
    mockSupabaseUser({ id: "sup-anon" });
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect(mockPrisma.family.create).not.toHaveBeenCalled();
  });

  it("不正な JSON は400を返すこと", async () => {
    mockSupabaseUser({ id: "sup-1", email: "a@b.com" });
    const bad = new NextRequest("http://localhost/api/auth/register", { method: "POST", body: "{not json" });
    const res = await POST(bad);
    expect(res.status).toBe(400);
  });

  it("body が空でも（セッションがあれば）登録できること", async () => {
    mockSupabaseUser({ id: "sup-1", email: "a@b.com" });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.family.create.mockResolvedValue(family());
    const empty = new NextRequest("http://localhost/api/auth/register", { method: "POST" });
    const res = await POST(empty);
    expect(res.status).toBe(200);
  });

  it("既存ユーザーの場合、既存のfamilyIdを返すこと", async () => {
    mockSupabaseUser({ id: "sup-exist", email: "a@b.com" });
    mockPrisma.user.findUnique.mockResolvedValue(parentUser({ familyId: "fam-existing" }));

    const res = await POST(req());
    expect((await res.json()).familyId).toBe("fam-existing");
    expect(mockPrisma.family.create).not.toHaveBeenCalled();
  });

  it("name はセッションの email から抽出すること（body の email は無視）", async () => {
    mockSupabaseUser({ id: "sup-papa", email: "real@gmail.com" });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.family.create.mockResolvedValue(family());

    await POST(req({ email: "fake@x.com" }));

    expect(mockPrisma.family.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          users: expect.objectContaining({
            create: expect.objectContaining({ name: "real" }),
          }),
        }),
      }),
    );
  });
});
