import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deleteChildAccount, deleteParentAccount } from "@/lib/accountDeletion";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { subscription } from "../helpers/fixtures";

const SUPA_URL = "https://abc.supabase.co";
const photoUrl = (p: string) => `${SUPA_URL}/storage/v1/object/public/quest-photos/${p}`;
const NOW = new Date("2026-10-23T00:00:00.000Z");

type Fn = ReturnType<typeof vi.fn>;
type Tx = {
  $queryRaw: Fn;
  user: { findUnique: Fn; findFirst: Fn; findMany: Fn; count: Fn; delete: Fn; deleteMany: Fn };
  family: { delete: Fn };
  questInstance: { findMany: Fn };
  subscription: { findUnique: Fn };
};
let tx: Tx;
let originalSupabaseUrl: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPA_URL;

  tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "fam-1" }]),
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    family: { delete: vi.fn().mockResolvedValue({}) },
    questInstance: { findMany: vi.fn().mockResolvedValue([]) },
    subscription: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  mockPrisma.$transaction.mockImplementation((async (fn: (t: Tx) => unknown) => fn(tx)) as never);
});

afterEach(() => {
  if (originalSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
});

describe("deleteChildAccount", () => {
  it("tx 内で { id, familyId, role: CHILD } を取り直して削除し、cleanup を返すこと", async () => {
    tx.user.findFirst.mockResolvedValue({ id: "child-1", supabaseId: "sup-child-1" });
    tx.questInstance.findMany.mockResolvedValue([
      { photoUrl: photoUrl("child-1/q1_1.webp") },
      { photoUrl: photoUrl("q2_2.webp") }, // 旧形式
    ]);

    const result = await deleteChildAccount({ childId: "child-1", familyId: "fam-1" });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "child-1", familyId: "fam-1", role: "CHILD" } }),
    );
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "child-1" } });
    expect(result).not.toBeNull();
    expect(result!.cleanup.supabaseIds).toEqual(["sup-child-1"]);
    expect(result!.cleanup.childIds).toEqual(["child-1"]);
    expect([...result!.cleanup.photoPaths].sort()).toEqual(["child-1/q1_1.webp", "q2_2.webp"].sort());
  });

  it("別の家族の childId（tx 内で見つからない）は null を返し、何も削除しないこと", async () => {
    tx.user.findFirst.mockResolvedValue(null);

    const result = await deleteChildAccount({ childId: "child-x", familyId: "fam-1" });

    expect(result).toBeNull();
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(tx.user.deleteMany).not.toHaveBeenCalled();
    expect(tx.family.delete).not.toHaveBeenCalled();
  });

  it("写真が無い・photoUrl が不正（別ホスト等）な場合は photoPaths に含めないこと", async () => {
    tx.user.findFirst.mockResolvedValue({ id: "child-1", supabaseId: "sup-child-1" });
    tx.questInstance.findMany.mockResolvedValue([
      { photoUrl: null },
      { photoUrl: "https://evil.example.com/storage/v1/object/public/quest-photos/child-1/a.jpg" },
      { photoUrl: photoUrl("child-1/../child-2/a.jpg") },
    ]);

    const result = await deleteChildAccount({ childId: "child-1", familyId: "fam-1" });

    expect(result!.cleanup.photoPaths).toEqual([]);
  });

  it("DB 例外は握りつぶさず投げること（呼び出し側が 500 にする）", async () => {
    tx.user.findFirst.mockResolvedValue({ id: "child-1", supabaseId: "sup-child-1" });
    tx.user.delete.mockRejectedValue(new Error("db down"));

    await expect(deleteChildAccount({ childId: "child-1", familyId: "fam-1" })).rejects.toThrow("db down");
  });
});

describe("deleteParentAccount", () => {
  const self = { id: "parent-1", role: "PARENT", familyId: "fam-1", supabaseId: "sup-parent-1" };

  describe("not_found", () => {
    it("tx 内で取り直した本人が存在しなければ not_found で何も削除しないこと", async () => {
      tx.user.findUnique.mockResolvedValue(null);

      const r = await deleteParentAccount("parent-x", NOW);

      expect(r).toEqual({ status: "not_found" });
      expect(tx.user.delete).not.toHaveBeenCalled();
      expect(tx.user.deleteMany).not.toHaveBeenCalled();
      expect(tx.family.delete).not.toHaveBeenCalled();
    });

    it("tx 内で取り直した role が CHILD なら not_found（親 API で子どもを消さない）", async () => {
      tx.user.findUnique.mockResolvedValue({ ...self, id: "child-1", role: "CHILD" });

      const r = await deleteParentAccount("child-1", NOW);

      expect(r).toEqual({ status: "not_found" });
      expect(tx.user.delete).not.toHaveBeenCalled();
      expect(tx.user.deleteMany).not.toHaveBeenCalled();
      expect(tx.family.delete).not.toHaveBeenCalled();
    });
  });

  describe("subscription_active（tx 内の再検査）", () => {
    it("本人が PREMIUM 有効・未解約なら subscription_active で何も削除しないこと", async () => {
      tx.user.findUnique.mockResolvedValue(self);
      tx.subscription.findUnique.mockResolvedValue(
        subscription({
          userId: "parent-1",
          plan: "PREMIUM",
          currentPeriodEnd: new Date(NOW.getTime() + 1),
          canceledAt: null,
        }),
      );

      const r = await deleteParentAccount("parent-1", NOW);

      expect(r).toEqual({ status: "subscription_active" });
      expect(tx.user.delete).not.toHaveBeenCalled();
      expect(tx.user.deleteMany).not.toHaveBeenCalled();
      expect(tx.family.delete).not.toHaveBeenCalled();
    });

    it("PREMIUM でも解約済み（canceledAt あり）なら削除できること", async () => {
      tx.user.findUnique.mockResolvedValue(self);
      tx.user.count.mockResolvedValue(1);
      tx.subscription.findUnique.mockResolvedValue(
        subscription({
          userId: "parent-1",
          plan: "PREMIUM",
          currentPeriodEnd: new Date(NOW.getTime() + 86_400_000),
          canceledAt: new Date(NOW.getTime() - 1000),
        }),
      );

      const r = await deleteParentAccount("parent-1", NOW);

      expect(r.status).toBe("deleted");
    });

    it("境界: currentPeriodEnd が now ちょうどなら期限切れ扱いで削除できること", async () => {
      tx.user.findUnique.mockResolvedValue(self);
      tx.user.count.mockResolvedValue(1);
      tx.subscription.findUnique.mockResolvedValue(
        subscription({ userId: "parent-1", plan: "PREMIUM", currentPeriodEnd: new Date(NOW), canceledAt: null }),
      );

      const r = await deleteParentAccount("parent-1", NOW);

      expect(r.status).toBe("deleted");
    });

    it("subscription は本人の userId で引くこと", async () => {
      tx.user.findUnique.mockResolvedValue(self);
      tx.user.count.mockResolvedValue(1);

      await deleteParentAccount("parent-1", NOW);

      expect(tx.subscription.findUnique).toHaveBeenCalledWith({ where: { userId: "parent-1" } });
    });
  });

  describe("他の親がいる場合（scope: self）", () => {
    beforeEach(() => {
      tx.user.findUnique.mockResolvedValue(self);
      tx.user.count.mockResolvedValue(1);
    });

    it("本人だけを削除し、family・子どもは消さないこと", async () => {
      const r = await deleteParentAccount("parent-1", NOW);

      expect(r).toEqual({
        status: "deleted",
        scope: "self",
        cleanup: expect.objectContaining({ supabaseIds: ["sup-parent-1"], childIds: [], photoPaths: [] }),
      });
      expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "parent-1" } });
      expect(tx.user.deleteMany).not.toHaveBeenCalled();
      expect(tx.family.delete).not.toHaveBeenCalled();
    });

    it("他の親の数は自分を除いた PARENT で数えること", async () => {
      await deleteParentAccount("parent-1", NOW);

      expect(tx.user.count).toHaveBeenCalledWith({
        where: { familyId: "fam-1", role: "PARENT", id: { not: "parent-1" } },
      });
    });
  });

  describe("最後の親の場合（scope: family）", () => {
    beforeEach(() => {
      tx.user.findUnique.mockResolvedValue(self);
      tx.user.count.mockResolvedValue(0);
      tx.user.findMany.mockResolvedValue([
        { id: "parent-1", role: "PARENT", supabaseId: "sup-parent-1" },
        { id: "child-1", role: "CHILD", supabaseId: "sup-child-1" },
        { id: "child-2", role: "CHILD", supabaseId: "sup-child-2" },
      ]);
      tx.questInstance.findMany.mockResolvedValue([
        { photoUrl: photoUrl("child-1/a.webp") },
        { photoUrl: photoUrl("child-2/b.webp") },
        { photoUrl: null },
      ]);
    });

    it("家族全員を削除し、Family も削除して scope=family を返すこと", async () => {
      const r = await deleteParentAccount("parent-1", NOW);

      expect(r.status).toBe("deleted");
      if (r.status !== "deleted") throw new Error("unreachable");
      expect(r.scope).toBe("family");
      expect(tx.user.deleteMany).toHaveBeenCalledWith({ where: { familyId: "fam-1" } });
      expect(tx.family.delete).toHaveBeenCalledWith({ where: { id: "fam-1" } });
    });

    it("削除順: user.deleteMany が family.delete より前（User.family は SET NULL のため）", async () => {
      await deleteParentAccount("parent-1", NOW);

      const userOrder = tx.user.deleteMany.mock.invocationCallOrder[0];
      const familyOrder = tx.family.delete.mock.invocationCallOrder[0];
      expect(userOrder).toBeLessThan(familyOrder);
    });

    it("cleanup には全員の supabaseId・子どもの id だけ・子どもの写真パスを返すこと", async () => {
      const r = await deleteParentAccount("parent-1", NOW);
      if (r.status !== "deleted") throw new Error("unreachable");

      expect([...r.cleanup.supabaseIds].sort()).toEqual(["sup-child-1", "sup-child-2", "sup-parent-1"]);
      expect([...r.cleanup.childIds].sort()).toEqual(["child-1", "child-2"]);
      expect([...r.cleanup.photoPaths].sort()).toEqual(["child-1/a.webp", "child-2/b.webp"]);
    });

    it("写真は削除前（tx 内）の子どもの QuestInstance から収集すること", async () => {
      await deleteParentAccount("parent-1", NOW);

      const photoQuery = tx.questInstance.findMany.mock.calls[0][0];
      expect(JSON.stringify(photoQuery)).toContain("child-1");
      expect(JSON.stringify(photoQuery)).toContain("child-2");
      expect(JSON.stringify(photoQuery)).not.toContain("parent-1");
      expect(tx.questInstance.findMany.mock.invocationCallOrder[0]).toBeLessThan(
        tx.user.deleteMany.mock.invocationCallOrder[0],
      );
    });

    it("子どもがいない最後の親でも家族を削除でき、photoPaths は空であること", async () => {
      tx.user.findMany.mockResolvedValue([{ id: "parent-1", role: "PARENT", supabaseId: "sup-parent-1" }]);
      tx.questInstance.findMany.mockResolvedValue([]);

      const r = await deleteParentAccount("parent-1", NOW);
      if (r.status !== "deleted") throw new Error("unreachable");

      expect(r.scope).toBe("family");
      expect(r.cleanup.childIds).toEqual([]);
      expect(r.cleanup.photoPaths).toEqual([]);
      expect(tx.family.delete).toHaveBeenCalledWith({ where: { id: "fam-1" } });
    });
  });

  describe("Family 行ロック", () => {
    it("他の親を数える前に $queryRaw（SELECT ... FOR UPDATE）で Family をロックすること", async () => {
      tx.user.findUnique.mockResolvedValue(self);
      tx.user.count.mockResolvedValue(1);

      await deleteParentAccount("parent-1", NOW);

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      const call = tx.$queryRaw.mock.calls[0];
      // tagged template: [strings, ...values]
      const sql = Array.isArray(call[0]) ? (call[0] as string[]).join("?") : String(call[0]);
      expect(sql).toMatch(/FROM\s+"Family"/i);
      expect(sql).toMatch(/FOR\s+UPDATE/i);
      expect(call).toContain("fam-1");
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.user.count.mock.invocationCallOrder[0]);
    });
  });

  describe("familyId が null の PARENT（壊れたデータ）", () => {
    it("自分だけを削除し、ロック・count・family 削除を行わないこと", async () => {
      tx.user.findUnique.mockResolvedValue({ ...self, familyId: null });

      const r = await deleteParentAccount("parent-1", NOW);

      expect(r).toEqual({
        status: "deleted",
        scope: "self",
        cleanup: expect.objectContaining({ supabaseIds: ["sup-parent-1"], childIds: [], photoPaths: [] }),
      });
      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(tx.user.count).not.toHaveBeenCalled();
      expect(tx.user.deleteMany).not.toHaveBeenCalled();
      expect(tx.family.delete).not.toHaveBeenCalled();
      expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "parent-1" } });
    });
  });

  it("DB 例外は投げること（外部削除に進まない）", async () => {
    tx.user.findUnique.mockResolvedValue(self);
    tx.user.count.mockResolvedValue(1);
    tx.user.delete.mockRejectedValue(new Error("db down"));

    await expect(deleteParentAccount("parent-1", NOW)).rejects.toThrow("db down");
  });
});
