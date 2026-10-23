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

vi.mock("@/lib/codeGenerator", () => ({
  generateFamilyCode: vi.fn(() => "ABC123"),
}));

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { family, parentUserWithFamily } from "../helpers/fixtures";

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

  it("DBユーザーが存在しない場合、familyを新規作成しユーザーを再取得すること", async () => {
    mockSupabaseUser({ id: "sup-new", email: "new@example.com" });
    // 1回目のfindUnique → null
    mockUserFindUnique.mockResolvedValueOnce(null);
    // familyCreate成功
    mockFamilyCreate.mockResolvedValue(family({ id: "fam-new", code: "ABC123" }));
    // 2回目のfindUnique → 作成されたユーザー
    const newUser = parentUserWithFamily(
      { id: "db-new", supabaseId: "sup-new" },
      { id: "fam-new", code: "ABC123" },
    );
    mockUserFindUnique.mockResolvedValueOnce(newUser);

    const result = await getCurrentUser();
    expect(result).toEqual(newUser);
    expect(mockFamilyCreate).toHaveBeenCalledWith({
      data: {
        code: "ABC123",
        users: {
          create: {
            supabaseId: "sup-new",
            role: "PARENT",
            name: "new",
          },
        },
      },
    });
  });

  it("DBユーザーが存在せずemailもない場合、再作成しないこと", async () => {
    mockSupabaseUser({ id: "sup-anon" });
    mockUserFindUnique.mockResolvedValue(null);

    const result = await getCurrentUser();
    expect(result).toBeNull();
    expect(mockFamilyCreate).not.toHaveBeenCalled();
  });

  it("自動再作成で P2002 (unique 違反) になった場合、findUnique をやり直して返すこと", async () => {
    mockSupabaseUser({ id: "sup-race", email: "race@example.com" });
    const created = parentUserWithFamily({ id: "db-race", supabaseId: "sup-race" });
    mockUserFindUnique.mockResolvedValueOnce(null);
    mockFamilyCreate.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
    mockUserFindUnique.mockResolvedValueOnce(created);

    const result = await getCurrentUser();
    expect(result).toEqual(created);
    expect(mockFamilyCreate).toHaveBeenCalledTimes(1);
  });

  it("P2002 以外のエラーはそのままスローすること", async () => {
    mockSupabaseUser({ id: "sup-err", email: "err@example.com" });
    mockUserFindUnique.mockResolvedValueOnce(null);
    mockFamilyCreate.mockRejectedValueOnce(new Error("boom"));

    await expect(getCurrentUser()).rejects.toThrow("boom");
  });

  it("P2002 が続いてユーザーも見つからない場合は上限回数でスローすること", async () => {
    mockSupabaseUser({ id: "sup-loop", email: "loop@example.com" });
    mockUserFindUnique.mockResolvedValue(null);
    mockFamilyCreate.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));

    await expect(getCurrentUser()).rejects.toThrow();
    expect(mockFamilyCreate.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it("emailからユーザー名を@前で抽出すること", async () => {
    mockSupabaseUser({ id: "sup-x", email: "tanaka.taro@company.co.jp" });
    mockUserFindUnique.mockResolvedValueOnce(null);
    mockFamilyCreate.mockResolvedValue(family());
    mockUserFindUnique.mockResolvedValueOnce(parentUserWithFamily());

    await getCurrentUser();
    expect(mockFamilyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          users: expect.objectContaining({
            create: expect.objectContaining({ name: "tanaka.taro" }),
          }),
        }),
      })
    );
  });
});
