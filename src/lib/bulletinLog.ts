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
  customKey?: string,
): Promise<void> {
  const message = buildBulletinMessage(type, displayName, extra);
  if (!message) return;
  const date = todayJST();
  // unique は (groupId, childId, type, date, key)。同日に別バッジ・別進化先を複数件
  // 書き込めるよう、type のサブ識別子（バッジ名・称号・モンスター名・卵タイプ）を key に入れる。
  // TASK_* は extra を使わないため key="" で従来通り冪等。
  // customKey を渡された場合は extra と別に独自 key 体系を許可（例: コレクション
  // のダブり獲得を許すため `${itemId}#${count}` を渡す）。
  const key = customKey ?? extra ?? "";
  try {
    await prisma.bulletinLog.create({
      data: { groupId, childId, type, message, key, date },
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

/** エール送信ログをトリガー（POST /api/gathering/stamp 成功時に呼ぶ）。
 * 1日1回制約は Stamp 側の @@unique([senderId, date]) で担保済みのため、
 * key="エール" 固定で BulletinLog の unique と衝突しない。 */
export async function triggerStampSentLog(childId: string): Promise<void> {
  try {
    const groupId = await getChildGroupId(childId);
    if (!groupId) return;
    const displayName = await getDisplayName(childId);
    if (!displayName) return;
    await writeBulletinLog(groupId, childId, displayName, "STAMP_SENT", "エール");
  } catch (err) {
    log.error("triggerStampSentLog failed", { childId, err });
  }
}

/** 宝箱でコレクションアイテム獲得ログをトリガー（openOldestTreasure から毎回呼ぶ）。
 * ダブり獲得 (count>=2) も含めて全件通知する。
 * key=`${itemId}#${count}` で BulletinLog の unique 制約を回避し、
 * 同日同じアイテムを複数回獲得しても 1 回 1 件書き込まれる。
 * メッセージは name/season/★ のみで count は含めない（バーストはひろば UI 側の
 * `coalesceBurst` で視覚的にまとめられる）。 */
export async function triggerCollectionItemLog(
  childId: string,
  collectionItemId: string,
  count: number,
): Promise<void> {
  try {
    const groupId = await getChildGroupId(childId);
    if (!groupId) return;
    const displayName = await getDisplayName(childId);
    if (!displayName) return;
    await writeBulletinLog(
      groupId,
      childId,
      displayName,
      "COLLECTION_ITEM_OBTAINED",
      collectionItemId,
      `${collectionItemId}#${count}`,
    );
  } catch (err) {
    log.error("triggerCollectionItemLog failed", { childId, collectionItemId, count, err });
  }
}
