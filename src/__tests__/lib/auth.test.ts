import { describe, it, expect, vi, beforeEach } from "vitest";

// Unmock @/lib/auth so we test the actual implementation (setup.ts mocks it globally)
vi.unmock("@/lib/auth");

// auth.ts uses its own imports, so we need to mock at module level
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    family: {
      create: vi.fn(),
    },
  },
}));

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { parentUserWithFamily } from "../helpers/fixtures";

const mockCreateClient = vi.mocked(createClient);
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockFamilyCreate = vi.mocked(prisma.family.create);

/** `createClient()` の戻り値は Supabase の `SupabaseClient` 型（巨大なジェネリック型）。
 * テストで使うのは `auth.getClaims` / `auth.getSession` / `auth.getUser` だけなので、必要な形だけを持つオブジェクトを
 * `Awaited<ReturnType<typeof createClient>>` に `as unknown as` でキャストする。 */
type SupabaseClientLike = Awaited<ReturnType<typeof createClient>>;

const mockGetClaims = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();

function mockSupabaseUser(user: { id: string; email?: string } | null) {
  mockGetClaims.mockResolvedValue(
    user
      ? { data: { claims: { sub: user.id, ...(user.email ? { email: user.email } : {}) } }, error: null }
      : { data: null, error: null },
  );
  mockCreateClient.mockResolvedValue({
    auth: { getClaims: mockGetClaims, getSession: mockGetSession, getUser: mockGetUser },
  } as unknown as SupabaseClientLike);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentUser", () => {
  it("Supabaseユーザーがnullの場合、nullを返すこと", async () => {
    mockSupabaseUser(null);
    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it("getClaims() で検証し、未検証の getSession() も Auth へ往復する getUser() も直接呼ばないこと", async () => {
    mockSupabaseUser({ id: "sup-123", email: "test@example.com" });
    mockUserFindUnique.mockResolvedValue(parentUserWithFamily({ supabaseId: "sup-123" }));

    await getCurrentUser();

    expect(mockGetClaims).toHaveBeenCalledTimes(1);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("getClaims() がエラー（署名不正・期限切れ・refresh 失敗）を返したら null を返し DB を引かないこと", async () => {
    mockSupabaseUser(null);
    mockGetClaims.mockResolvedValue({ data: null, error: new Error("Invalid JWT signature") });

    const result = await getCurrentUser();

    expect(result).toBeNull();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("getClaims() が例外を投げた場合（壊れた JWT クッキー等）も null を返し DB を引かないこと", async () => {
    mockSupabaseUser(null);
    mockGetClaims.mockRejectedValue(new Error("Invalid JWT structure"));

    const result = await getCurrentUser();

    expect(result).toBeNull();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("claims に sub が無い場合は null を返すこと", async () => {
    mockSupabaseUser(null);
    mockGetClaims.mockResolvedValue({ data: { claims: { role: "anon" } }, error: null });

    const result = await getCurrentUser();

    expect(result).toBeNull();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("DBユーザーが存在する場合、family付きで返すこと", async () => {
    mockSupabaseUser({ id: "sup-123", email: "test@example.com" });
    const dbUser = parentUserWithFamily(
      { id: "db-1", supabaseId: "sup-123", familyId: "fam-1" },
      { id: "fam-1", code: "ABC123" },
    );
    mockUserFindUnique.mockResolvedValue(dbUser);

    const result = await getCurrentUser();
    expect(result).toEqual(dbUser);
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { supabaseId: "sup-123" },
      include: { family: true },
    });
  });

  it("DBユーザーが存在しない場合（emailあり）、nullを返しfamilyを再作成しないこと（退会者を復活させない）", async () => {
    mockSupabaseUser({ id: "sup-new", email: "new@example.com" });
    mockUserFindUnique.mockResolvedValue(null);

    const result = await getCurrentUser();

    expect(result).toBeNull();
    expect(mockFamilyCreate).not.toHaveBeenCalled();
  });

  it("DBユーザーが存在しない場合、findUniqueのやり直し（再取得）をしないこと", async () => {
    mockSupabaseUser({ id: "sup-new", email: "new@example.com" });
    mockUserFindUnique.mockResolvedValue(null);

    await getCurrentUser();

    expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
  });

  it("DBユーザーが存在せずemailもない場合も、nullを返し再作成しないこと", async () => {
    mockSupabaseUser({ id: "sup-anon" });
    mockUserFindUnique.mockResolvedValue(null);

    const result = await getCurrentUser();
    expect(result).toBeNull();
    expect(mockFamilyCreate).not.toHaveBeenCalled();
  });

  it("findUniqueが例外を投げた場合はそのままスローし、familyを作成しないこと", async () => {
    mockSupabaseUser({ id: "sup-err", email: "err@example.com" });
    mockUserFindUnique.mockRejectedValueOnce(new Error("boom"));

    await expect(getCurrentUser()).rejects.toThrow("boom");
    expect(mockFamilyCreate).not.toHaveBeenCalled();
  });
});
