// 宝箱（ごほうび）の DB 操作層。
// 純粋ロジック (drawTreasure) は src/lib/treasure.ts に分離してある。
//
// 呼び出し元:
//  - report API → generateTreasuresOnReport
//  - approve.ts → unlockTreasuresOnApprove
//  - reject API → cancelTreasuresOnReject
//  - 親代理 report-approve → generateProxyTreasure
//  - 子供の開封 API → openOldestTreasure

import { prisma } from "@/lib/prisma";
import { drawTreasure, type TreasurePoolItem, type TreasureRarity } from "@/lib/treasure";
import {
  getDrawPoolForPlan,
  type CollectionRarity,
  type CollectionSeason,
} from "@/lib/collectionItems";
import { drawCollectionItem } from "@/lib/collectionDraw";
import { awardCollectionItem } from "@/lib/collectionService";
import { triggerCollectionItemLog } from "@/lib/bulletinLog";
import { getFamilyPlan } from "@/lib/subscriptionService";

export interface TreasureCondition {
  childId: string;
  date: Date;
  /** 「対処済み」クエスト数 (REPORTED + APPROVED + SKIP_REPORTED + SKIPPED)。computeCompletedCount と同じ。 */
  reportedCount: number;
  totalCount: number;
  /** スキップ扱い (SKIP_REPORTED + SKIPPED) の件数。ALL_COMPLETE の boost 判定に使う。 */
  skippedCount: number;
  minTasks: number;
  isProxy: boolean;
}

/**
 * 報告時の宝箱生成（LOCKED）。
 *  - isProxy=true → 何もしない（親代理は子供の自発的動機を生まないため）
 *  - 親のプール未設定でも生成する（開封時に必ず季節コレクションアイテムが出るため、
 *    プール 0 でも子供は確定報酬を受け取れる）
 *  - reportedCount >= min(minTasks, totalCount) → STREAK 1個
 *    (少タスク日は全完了で救済。recordDailyAchievement と同じ規約)
 *    ただし当日 PROXY が既にあれば STREAK は作らない（PROXY は STREAK の代替）
 *  - reportedCount = totalCount (全完了) → さらに ALL_COMPLETE 1個
 *    skippedCount === 0 のときのみ boosted=true (1.5倍)、スキップが混じれば boosted=false
 *    ALL_COMPLETE は PROXY と共存可（全タスク完了のボーナス枠として独立）
 *  - 同じ trigger の宝箱がその日既にあれば飛ばす（冪等）
 */
export async function generateTreasuresOnReport(
  cond: TreasureCondition,
): Promise<string[]> {
  if (cond.isProxy) return [];
  // 今日のタスクが minTasks より少ない家庭では「全部やれば OK」に緩和する
  // (streak.ts recordDailyAchievement と同じ Math.min 救済)。
  const required = Math.min(cond.minTasks, cond.totalCount);
  if (cond.reportedCount < required) return [];

  // CANCELLED は「差し戻しで取り消された宝箱」なので "存在しない" 扱いにする。
  // これを含めると、差し戻し→再報告で再びストリーク条件を満たしても新規 STREAK が
  // 作られないバグになる (generateProxyTreasure と同じフィルタ規約)。
  const existing = await prisma.treasureLog.findMany({
    where: {
      childId: cond.childId,
      date: cond.date,
      trigger: { in: ["STREAK", "ALL_COMPLETE", "PROXY"] },
      status: { not: "CANCELLED" },
    },
    select: { trigger: true },
  });
  const has = new Set(existing.map((e) => e.trigger));

  const created: string[] = [];
  // PROXY は STREAK の代替なので、PROXY 既存なら STREAK は新規作成しない
  if (!has.has("STREAK") && !has.has("PROXY")) {
    const t = await prisma.treasureLog.create({
      data: {
        childId: cond.childId,
        date: cond.date,
        trigger: "STREAK",
        boosted: false,
        status: "LOCKED",
      },
    });
    created.push(t.id);
  }
  if (cond.reportedCount >= cond.totalCount && cond.totalCount > 0 && !has.has("ALL_COMPLETE")) {
    const t = await prisma.treasureLog.create({
      data: {
        childId: cond.childId,
        date: cond.date,
        trigger: "ALL_COMPLETE",
        // スキップが 1 件でも混じれば boost を抑止 (純粋完了のみ 1.5倍宝箱)
        boosted: cond.skippedCount === 0,
        status: "LOCKED",
      },
    });
    created.push(t.id);
  }
  return created;
}

/**
 * 承認時の宝箱アンロック。同日の LOCKED 宝箱をすべて UNLOCKED に更新。
 * 戻り値: 更新した件数。
 */
export async function unlockTreasuresOnApprove(childId: string, date: Date): Promise<number> {
  const res = await prisma.treasureLog.updateMany({
    where: { childId, date, status: "LOCKED" },
    data: { status: "UNLOCKED" },
  });
  return res.count;
}

/**
 * 差し戻し時の宝箱破棄。
 *  - 差し戻し後 reportedCount < minTasks → 同日 LOCKED 全部 CANCELLED
 *  - minTasks は満たすが全完了でなくなった → ALL_COMPLETE のみ CANCELLED
 *  - それ以外（条件まだ満たしている）→ 何もしない
 */
export async function cancelTreasuresOnReject(cond: TreasureCondition): Promise<number> {
  if (cond.reportedCount < cond.minTasks) {
    const r = await prisma.treasureLog.updateMany({
      where: { childId: cond.childId, date: cond.date, status: "LOCKED" },
      data: { status: "CANCELLED" },
    });
    return r.count;
  }
  if (cond.reportedCount < cond.totalCount) {
    const r = await prisma.treasureLog.updateMany({
      where: {
        childId: cond.childId,
        date: cond.date,
        status: "LOCKED",
        trigger: "ALL_COMPLETE",
      },
      data: { status: "CANCELLED" },
    });
    return r.count;
  }
  return 0;
}

/**
 * 親代理 report-approve / skip-approve 時の宝箱生成（即 UNLOCKED）。
 *  - reportedCount >= min(minTasks, totalCount) かつ 当日 STREAK/PROXY が無ければ PROXY を 1 個生成
 *    （PROXY は STREAK の代替枠。子セルフの STREAK があるならスキップ。
 *      少タスク日は全完了で救済 — generateTreasuresOnReport と同じ規約）
 *  - reportedCount === totalCount かつ 当日 ALL_COMPLETE が無ければ ALL_COMPLETE を追加生成
 *    （子セルフ経路と対称に「全完了ボーナス」を演出。skippedCount===0 のときのみ boost）
 *  - どちらも即 UNLOCKED（親代理は承認待ちフェーズを持たないため LOCKED は使わない）
 *  - プール 0 でも生成する（開封時にコレクションアイテムが必ず出る）
 */
export async function generateProxyTreasure(input: {
  childId: string;
  date: Date;
  reportedCount: number;
  totalCount: number;
  skippedCount: number;
  minTasks: number;
}): Promise<string[]> {
  const required = Math.min(input.minTasks, input.totalCount);
  if (input.reportedCount < required) return [];

  const existing = await prisma.treasureLog.findMany({
    where: {
      childId: input.childId,
      date: input.date,
      trigger: { in: ["STREAK", "ALL_COMPLETE", "PROXY"] },
      status: { not: "CANCELLED" },
    },
    select: { trigger: true },
  });
  const has = new Set(existing.map((e) => e.trigger));

  const created: string[] = [];
  if (!has.has("STREAK") && !has.has("PROXY")) {
    const t = await prisma.treasureLog.create({
      data: {
        childId: input.childId,
        date: input.date,
        trigger: "PROXY",
        boosted: false,
        status: "UNLOCKED",
      },
    });
    created.push(t.id);
  }
  if (
    input.reportedCount >= input.totalCount &&
    input.totalCount > 0 &&
    !has.has("ALL_COMPLETE")
  ) {
    const t = await prisma.treasureLog.create({
      data: {
        childId: input.childId,
        date: input.date,
        trigger: "ALL_COMPLETE",
        boosted: input.skippedCount === 0,
        status: "UNLOCKED",
      },
    });
    created.push(t.id);
  }
  return created;
}

export interface OpenedCollectionItem {
  id: string;
  name: string;
  rarity: CollectionRarity;
  season: CollectionSeason;
  description: string;
  image: string;
  /** 通算入手回数 (1 なら初獲得、2 以上ならダブり) */
  count: number;
  /** 月限定アイテムのみ設定 (1〜12)。通常アイテムは undefined */
  month?: number;
}

export interface OpenTreasureResult {
  logId: string;
  /** 親が設定したごほうび。当選しなかった場合は null（その代わり collectionItem が入る）。 */
  item: { id: string; title: string; rarity: TreasureRarity } | null;
  /** 親ごほうびが当選しなかったときに付与される季節コレクションアイテム。当選時は null。 */
  collectionItem: OpenedCollectionItem | null;
}

/**
 * 最古の UNLOCKED 宝箱を開封し、抽選結果を確定する。
 *  - 該当なし → null
 *  - 抽選で親ごほうびに当選 → item を入れて返す（collectionItem は null）
 *  - pity 発動で親ごほうびに昇格 → item を入れて返す（collectionItem は null）
 *  - 親ごほうび不当選 (プール空 or rng が外れ) → 現在シーズンのコレクションアイテムを 1個付与
 *    (仕様: docs/未実装仕様書/treasure-collection-items.md)
 *
 *  pity (天井): User.treasurePityCount を読み込み drawTreasure に渡し、結果の nextPityCount を保存。
 *    HIT or pity 発動でリセット (0)、MISS で +1。10回連続 MISS の次は強制 HIT。
 */
export async function openOldestTreasure(
  childId: string,
  options: { rng?: () => number; now?: Date } = {},
): Promise<OpenTreasureResult | null> {
  const now = options.now ?? new Date();

  const log = await prisma.treasureLog.findFirst({
    where: { childId, status: "UNLOCKED" },
    orderBy: { createdAt: "asc" },
  });
  if (!log) return null;

  const child = await prisma.user.findUnique({
    where: { id: childId },
    select: { treasurePityCount: true, familyId: true },
  });
  const pityCount = child?.treasurePityCount ?? 0;

  const items = await prisma.treasureItem.findMany({
    where: { childId, isActive: true },
    select: { id: true, title: true, rarity: true },
  });

  const pool: TreasurePoolItem[] = items.map((i) => ({
    id: i.id,
    title: i.title,
    rarity: i.rarity as TreasureRarity,
  }));

  const draw = drawTreasure(pool, {
    boosted: log.boosted,
    pityCount,
    rng: options.rng,
  });

  const drawnItem = draw.itemId ? pool.find((p) => p.id === draw.itemId) ?? null : null;

  // 親ごほうび不当選なら季節/月限定コレクションアイテムを必ず付与。
  // FREE プランは月限定 5 個のみ / PREMIUM は通常20 + 月限定5 = 25個
  // 単独モード (familyId=null) は既存挙動と同じ全プール (PREMIUM 相当)
  // 仕様: monetization-plan.md §2.5 / §4.4
  let collectionItem: OpenedCollectionItem | null = null;
  if (drawnItem === null) {
    const plan = child?.familyId ? await getFamilyPlan(child.familyId) : "PREMIUM";
    const pool = getDrawPoolForPlan(now, plan);
    const picked = drawCollectionItem(pool, options.rng);
    if (picked) {
      const owned = await awardCollectionItem(childId, picked.id, picked.season, now);
      collectionItem = {
        id: picked.id,
        name: picked.name,
        rarity: picked.rarity,
        season: picked.season,
        description: picked.description,
        image: picked.image,
        count: owned.count,
        month: picked.month,
      };
      await triggerCollectionItemLog(childId, picked.id, owned.count);
    }
  }

  await prisma.treasureLog.update({
    where: { id: log.id },
    data: {
      status: "OPENED",
      itemId: draw.itemId,
      collectionItemId: collectionItem?.id ?? null,
      openedAt: now,
    },
  });

  if (draw.nextPityCount !== pityCount) {
    await prisma.user.update({
      where: { id: childId },
      data: { treasurePityCount: draw.nextPityCount },
    });
  }

  return {
    logId: log.id,
    item: drawnItem
      ? { id: drawnItem.id, title: drawnItem.title, rarity: drawnItem.rarity }
      : null,
    collectionItem,
  };
}
