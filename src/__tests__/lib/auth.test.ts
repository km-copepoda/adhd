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

vi.mock("@/lib/categories", () => ({
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
 * テストで使うのは `auth.getSession` だけなので、必要な形だけを持つオブジェクトを
 * `Awaited<ReturnType<typeof createClient>>` に `as unknown as` でキャストする。 */
type SupabaseClientLike = Awaited<ReturnType<typeof createClient>>;

function mockSupabaseUser(user: { id: string; email?: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: user ? { user } : null },
      }),
    },
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
