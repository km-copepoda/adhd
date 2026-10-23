import { prisma } from "@/lib/prisma";
import { parseQuestPhotoPath } from "@/lib/questPhotoUrl";
import { hasBlockingSubscription, type ExternalCleanup } from "@/lib/accountDeletion.data";

// DB 操作のみ。Auth / Storage の削除は accountCleanup.ts が担当し、呼び出し側が after() で実行する。

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type DeleteParentResult =
  | { status: "not_found" }
  | { status: "subscription_active" }
  | { status: "deleted"; scope: "self" | "family"; cleanup: ExternalCleanup };

/** 削除前に子どもたちの quest-photos のパス（旧・新形式）を集める */
async function collectPhotoPaths(tx: Tx, childIds: string[]): Promise<string[]> {
  if (childIds.length === 0) return [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const quests = await tx.questInstance.findMany({
    where: { childId: { in: childIds }, photoUrl: { not: null } },
    select: { photoUrl: true },
  });
  const paths = new Set<string>();
  for (const q of quests) {
    const p = q.photoUrl ? parseQuestPhotoPath(q.photoUrl, supabaseUrl) : null;
    if (p) paths.add(p);
  }
  return [...paths];
}

/** 子どもを 1 人削除する。対象は tx 内で familyId・role 付きで取り直す。見つからなければ null */
export async function deleteChildAccount(params: {
  childId: string;
  familyId: string;
}): Promise<{ cleanup: ExternalCleanup } | null> {
  return prisma.$transaction(async (tx) => {
    const child = await tx.user.findFirst({
      where: { id: params.childId, familyId: params.familyId, role: "CHILD" },
      select: { id: true, supabaseId: true },
    });
    if (!child) return null;

    const photoPaths = await collectPhotoPaths(tx, [child.id]);
    // QuestInstance / Streak / TaskStreak 等は Cascade、TaskTemplate.assignedChild は SET NULL
    await tx.user.delete({ where: { id: child.id } });

    return {
      cleanup: {
        supabaseIds: [child.supabaseId],
        childIds: [child.id],
        photoPaths,
        familyId: params.familyId,
      },
    };
  });
}

/**
 * 親のアカウントを削除する。他の親がいれば本人のみ、最後の親なら家族全員と家族を削除する。
 * 課金中判定・対象の取り直し・家族ロックはすべて同一 tx 内で行う。
 */
export async function deleteParentAccount(parentId: string, now: Date): Promise<DeleteParentResult> {
  return prisma.$transaction(async (tx): Promise<DeleteParentResult> => {
    const self = await tx.user.findUnique({
      where: { id: parentId },
      select: { id: true, role: true, familyId: true, supabaseId: true },
    });
    if (!self || self.role !== "PARENT") return { status: "not_found" };

    const familyId = self.familyId;
    // 同じ家族の親が同時に退会して両方「他に親がいる」と判定するのを防ぐ
    if (familyId) await tx.$queryRaw`SELECT id FROM "Family" WHERE id = ${familyId} FOR UPDATE`;

    const sub = await tx.subscription.findUnique({ where: { userId: self.id } });
    if (hasBlockingSubscription(sub, now)) return { status: "subscription_active" };

    const otherParents = familyId
      ? await tx.user.count({ where: { familyId, role: "PARENT", id: { not: self.id } } })
      : 0;

    if (!familyId || otherParents > 0) {
      await tx.user.delete({ where: { id: self.id } });
      return {
        status: "deleted",
        scope: "self",
        cleanup: { supabaseIds: [self.supabaseId], childIds: [], photoPaths: [], familyId },
      };
    }

    const members = await tx.user.findMany({
      where: { familyId },
      select: { id: true, role: true, supabaseId: true },
    });
    const childIds = members.filter((m) => m.role === "CHILD").map((m) => m.id);
    const photoPaths = await collectPhotoPaths(tx, childIds);

    // User.family は SET NULL のため、User を先に消してから Family を消す
    await tx.user.deleteMany({ where: { familyId } });
    await tx.family.delete({ where: { id: familyId } });

    return {
      status: "deleted",
      scope: "family",
      cleanup: { supabaseIds: members.map((m) => m.supabaseId), childIds, photoPaths, familyId },
    };
  });
}
