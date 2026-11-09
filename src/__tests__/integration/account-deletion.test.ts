import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { deleteChildAccount, deleteParentAccount } from "@/lib/accountDeletion";
import { prisma, seedFamily, seedTask, seedQuestForDate, cleanAll } from "./helpers";

// 実 Postgres に対するアカウント削除の統合テスト（#235）。CI では実行されない（ローカル DB 前提）。
// 外部削除（Auth / Storage）は accountDeletion.ts では行わないので、ここでは DB の整合だけを検査する。

const NOW = new Date("2026-10-23T00:00:00.000Z");

/** 家族に紐づく全テーブルの行数（残骸検出用） */
async function countFamilyRows(familyId: string, childIds: string[], userIds: string[]) {
  return {
    family: await prisma.family.count({ where: { id: familyId } }),
    users: await prisma.user.count({ where: { familyId } }),
    tasks: await prisma.taskTemplate.count({ where: { familyId } }),
    quests: await prisma.questInstance.count({ where: { childId: { in: childIds } } }),
    streaks: await prisma.streak.count({ where: { childId: { in: childIds } } }),
    taskStreaks: await prisma.taskStreak.count({ where: { childId: { in: childIds } } }),
    subscriptions: await prisma.subscription.count({ where: { userId: { in: userIds } } }),
    themes: await prisma.familyMonsterTheme.count({ where: { familyId } }),
  };
}

async function seedFull() {
  const { family, parent, child } = await seedFamily();
  const task = await seedTask(family.id, { assignedChildId: child.id });
  await seedQuestForDate(task.id, child.id, new Date("2026-10-01"), "APPROVED");
  await seedQuestForDate(task.id, child.id, new Date("2026-10-02"), "REPORTED");
  await prisma.streak.create({ data: { childId: child.id } });
  await prisma.taskStreak.create({ data: { taskId: task.id, childId: child.id } });
  await prisma.subscription.create({ data: { userId: parent.id, plan: "FREE" } });
  await prisma.familyMonsterTheme.create({
    data: { familyId: family.id, themeId: "buddha", grantReason: "manual" },
  });
  return { family, parent, child, task };
}

describe("アカウント削除（実 DB）", () => {
  beforeEach(async () => {
    await cleanAll();
  });

  afterAll(async () => {
    await cleanAll();
  });

  describe("最後の親の退会（scope: family）", () => {
    it("家族の全行が消え、別の家族は丸ごと残ること", async () => {
      const a = await seedFull();
      const b = await seedFull();

      const r = await deleteParentAccount(a.parent.id, NOW);

      expect(r.status).toBe("deleted");
      if (r.status !== "deleted") return;
      expect(r.scope).toBe("family");
      expect(r.cleanup.supabaseIds.sort()).toEqual([a.parent.supabaseId, a.child.supabaseId].sort());
      expect(r.cleanup.childIds).toEqual([a.child.id]);

      expect(await countFamilyRows(a.family.id, [a.child.id], [a.parent.id])).toEqual({
        family: 0,
        users: 0,
        tasks: 0,
        quests: 0,
        streaks: 0,
        taskStreaks: 0,
        subscriptions: 0,
        themes: 0,
      });
      expect(await countFamilyRows(b.family.id, [b.child.id], [b.parent.id])).toEqual({
        family: 1,
        users: 2,
        tasks: 1,
        quests: 2,
        streaks: 1,
        taskStreaks: 1,
        subscriptions: 1,
        themes: 1,
      });
    });

    it("子どもの写真付きクエストのパスが cleanup.photoPaths に返ること", async () => {
      const { parent, child, task } = await seedFull();
      const supa = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://abc.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_URL = supa;
      const quest = await seedQuestForDate(task.id, child.id, new Date("2026-10-03"), "REPORTED");
      await prisma.questInstance.update({
        where: { id: quest.id },
        data: { photoUrl: `${supa}/storage/v1/object/public/quest-photos/${child.id}/${quest.id}_1.webp` },
      });

      const r = await deleteParentAccount(parent.id, NOW);
      if (r.status !== "deleted") throw new Error("expected deleted");

      expect(r.cleanup.photoPaths).toEqual([`${child.id}/${quest.id}_1.webp`]);
    });
  });

  describe("他の親が残る退会（scope: self）", () => {
    it("本人だけ消え、家族・子ども・タスク・クエストは残ること", async () => {
      const { family, parent, child } = await seedFull();
      const second = await prisma.user.create({
        data: { supabaseId: "sb-p2-int", role: "PARENT", name: "親2", familyId: family.id },
      });

      const r = await deleteParentAccount(parent.id, NOW);

      expect(r.status).toBe("deleted");
      if (r.status !== "deleted") return;
      expect(r.scope).toBe("self");
      expect(await prisma.user.findUnique({ where: { id: parent.id } })).toBeNull();
      expect(await prisma.user.findUnique({ where: { id: second.id } })).not.toBeNull();
      expect(await prisma.user.findUnique({ where: { id: child.id } })).not.toBeNull();
      expect(await prisma.family.count({ where: { id: family.id } })).toBe(1);
      expect(await prisma.taskTemplate.count({ where: { familyId: family.id } })).toBe(1);
      expect(await prisma.questInstance.count({ where: { childId: child.id } })).toBe(2);
    });

    it("本人の Subscription は Cascade で消えること", async () => {
      const { family, parent } = await seedFull();
      await prisma.user.create({
        data: { supabaseId: "sb-p3-int", role: "PARENT", name: "親3", familyId: family.id },
      });

      await deleteParentAccount(parent.id, NOW);

      expect(await prisma.subscription.count({ where: { userId: parent.id } })).toBe(0);
    });
  });

  describe("課金中の親", () => {
    it("PREMIUM 有効・未解約なら subscription_active で何も消えないこと", async () => {
      const { family, parent, child } = await seedFull();
      await prisma.subscription.update({
        where: { userId: parent.id },
        data: { plan: "PREMIUM", currentPeriodEnd: new Date(NOW.getTime() + 86_400_000), canceledAt: null },
      });

      const r = await deleteParentAccount(parent.id, NOW);

      expect(r).toEqual({ status: "subscription_active" });
      expect(await prisma.family.count({ where: { id: family.id } })).toBe(1);
      expect(await prisma.user.count({ where: { id: { in: [parent.id, child.id] } } })).toBe(2);
    });

    it("PREMIUM でも解約済みなら削除できること", async () => {
      const { family, parent } = await seedFull();
      await prisma.subscription.update({
        where: { userId: parent.id },
        data: {
          plan: "PREMIUM",
          currentPeriodEnd: new Date(NOW.getTime() + 86_400_000),
          canceledAt: new Date(NOW.getTime() - 1000),
        },
      });

      const r = await deleteParentAccount(parent.id, NOW);

      expect(r.status).toBe("deleted");
      expect(await prisma.family.count({ where: { id: family.id } })).toBe(0);
    });
  });

  describe("not_found", () => {
    it("存在しない id・子どもの id では何も消えないこと", async () => {
      const { family, child } = await seedFull();

      expect(await deleteParentAccount("no-such-user", NOW)).toEqual({ status: "not_found" });
      expect(await deleteParentAccount(child.id, NOW)).toEqual({ status: "not_found" });
      expect(await prisma.family.count({ where: { id: family.id } })).toBe(1);
      expect(await prisma.user.count({ where: { familyId: family.id } })).toBe(2);
    });
  });

  describe("子どもの削除", () => {
    it("子どもの QuestInstance / Streak / TaskStreak が Cascade で消え、タスク・親・家族は残り、assignedChildId は NULL になること", async () => {
      const { family, parent, child, task } = await seedFull();

      const r = await deleteChildAccount({ childId: child.id, familyId: family.id });

      expect(r).not.toBeNull();
      expect(r!.cleanup.childIds).toEqual([child.id]);
      expect(r!.cleanup.supabaseIds).toEqual([child.supabaseId]);
      expect(await prisma.user.findUnique({ where: { id: child.id } })).toBeNull();
      expect(await prisma.questInstance.count({ where: { childId: child.id } })).toBe(0);
      expect(await prisma.streak.count({ where: { childId: child.id } })).toBe(0);
      expect(await prisma.taskStreak.count({ where: { childId: child.id } })).toBe(0);

      expect(await prisma.user.findUnique({ where: { id: parent.id } })).not.toBeNull();
      expect(await prisma.family.count({ where: { id: family.id } })).toBe(1);
      const t = await prisma.taskTemplate.findUnique({ where: { id: task.id } });
      expect(t).not.toBeNull();
      expect(t!.assignedChildId).toBeNull();
    });

    it("別の家族の familyId を指定すると null で、何も消えないこと", async () => {
      const a = await seedFull();
      const b = await seedFull();

      const r = await deleteChildAccount({ childId: a.child.id, familyId: b.family.id });

      expect(r).toBeNull();
      expect(await prisma.user.findUnique({ where: { id: a.child.id } })).not.toBeNull();
      expect(await prisma.questInstance.count({ where: { childId: a.child.id } })).toBe(2);
    });

    it("親の id を childId に渡しても null（CHILD のみ対象）で親が消えないこと", async () => {
      const { family, parent } = await seedFull();

      const r = await deleteChildAccount({ childId: parent.id, familyId: family.id });

      expect(r).toBeNull();
      expect(await prisma.user.findUnique({ where: { id: parent.id } })).not.toBeNull();
    });
  });

  describe("RESTRICT のままの FK", () => {
    it("クエストが残るテンプレートは直接 delete できない（QuestInstance.template は RESTRICT）", async () => {
      const { task } = await seedFull();
      await expect(prisma.taskTemplate.delete({ where: { id: task.id } })).rejects.toThrow();
    });
  });
});
