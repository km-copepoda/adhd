import { prisma } from "@/lib/prisma";
import { todayJST } from "@/lib/date";
import { buildBulletinMessage, getProgressMilestones, type BulletinLogType } from "@/lib/gathering";
import { log } from "@/lib/logger";

/** 子供が属するグループIDを取得（未参加ならnull） */
async function getChildGroupId(childId: string): Promise<string | null> {
  const member = await prisma.gatheringMember.findUnique({
    where: { childId },
    select: { groupId: true },
  });
  return member?.groupId ?? null;
}

/**
 * 掲示板に表示する識別子を取得。
 * monsterName を優先（プライバシー: 本名はグループ外に晒さない）。両方 null なら null。
 */
async function getDisplayName(childId: string): Promise<string | null> {
  const child = await prisma.user.findUnique({
    where: { id: childId },
    select: { name: true, monsterName: true },
  });
  return child?.monsterName ?? child?.name ?? null;
}

/** 掲示板ログを1件書き込む（unique制約で重複は無視） */
async function writeBulletinLog(
  groupId: string,
  childId: string,
  displayName: string,
  type: BulletinLogType,
  extra?: string,
): Promise<void> {
  const message = buildBulletinMessage(type, displayName, extra);
  if (!message) return;
  const date = todayJST();
  try {
    await prisma.bulletinLog.create({
      data: { groupId, childId, type, message, date },
    });
  } catch {
    // unique制約違反（重複）は無視
  }
}

/** タスク進捗ログをトリガー（報告時に呼ぶ） */
export async function triggerTaskProgressLog(childId: string): Promise<void> {
  try {
    const groupId = await getChildGroupId(childId);
    if (!groupId) return;

    const displayName = await getDisplayName(childId);
    if (!displayName) return;

    const today = todayJST();

    // 当日の全タスク数
    const total = await prisma.questInstance.count({
      where: { childId, date: today },
    });
    if (total === 0) return;

    // 「完了」扱い: REPORTED + SKIP_REPORTED + APPROVED + SKIPPED
    const done = await prisma.questInstance.count({
      where: {
        childId,
        date: today,
        status: { in: ["REPORTED", "SKIP_REPORTED", "APPROVED", "SKIPPED"] },
      },
    });

    const milestones = getProgressMilestones(done, total);
    for (const type of milestones) {
      await writeBulletinLog(groupId, childId, displayName, type);
    }
  } catch (err) {
    log.error("triggerTaskProgressLog failed", { childId, err });
  }
}

/** バッジ解除ログをトリガー（承認後のバッジチェック時に呼ぶ） */
export async function triggerBadgeLog(childId: string, badgeName: string): Promise<void> {
  try {
    const groupId = await getChildGroupId(childId);
    if (!groupId) return;
    const displayName = await getDisplayName(childId);
    if (!displayName) return;
    await writeBulletinLog(groupId, childId, displayName, "BADGE_UNLOCKED", badgeName);
  } catch (err) {
    log.error("triggerBadgeLog failed", { childId, err });
  }
}

/** 称号取得ログをトリガー（ストリークマイルストーン達成時に呼ぶ） */
export async function triggerStreakTitleLog(childId: string, title: string): Promise<void> {
  try {
    const groupId = await getChildGroupId(childId);
    if (!groupId) return;
    const displayName = await getDisplayName(childId);
    if (!displayName) return;
    await writeBulletinLog(groupId, childId, displayName, "STREAK_TITLE", title);
  } catch (err) {
    log.error("triggerStreakTitleLog failed", { childId, err });
  }
}

/** モンスター進化ログをトリガー（承認時の進化確定後に呼ぶ） */
export async function triggerMonsterEvolvedLog(childId: string, monsterName: string): Promise<void> {
  try {
    const groupId = await getChildGroupId(childId);
    if (!groupId) return;
    const displayName = await getDisplayName(childId);
    if (!displayName) return;
    await writeBulletinLog(groupId, childId, displayName, "MONSTER_EVOLVED", monsterName);
  } catch (err) {
    log.error("triggerMonsterEvolvedLog failed", { childId, err });
  }
}

/** 転生ログをトリガー（rebirth API完了時に呼ぶ） */
export async function triggerMonsterRebornLog(childId: string, eggType: string): Promise<void> {
  try {
    const groupId = await getChildGroupId(childId);
    if (!groupId) return;
    const displayName = await getDisplayName(childId);
    if (!displayName) return;
    await writeBulletinLog(groupId, childId, displayName, "MONSTER_REBORN", eggType);
  } catch (err) {
    log.error("triggerMonsterRebornLog failed", { childId, err });
  }
}
