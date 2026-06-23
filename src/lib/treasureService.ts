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
  getItemsBySeason,
  getSeasonForDate,
  type CollectionRarity,
  type CollectionSeason,
} from "@/lib/collectionItems";
import { drawCollectionItem } from "@/lib/collectionDraw";
import { awardCollectionItem } from "@/lib/collectionService";
import { triggerCollectionItemLog } from "@/lib/bulletinLog";

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
 *  - reportedCount >= minTasks → STREAK 1個
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
  if (cond.reportedCount < cond.minTasks) return [];

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
 * 親代理 report-approve 時の宝箱生成（即 UNLOCKED で1個のみ）。
 * 条件: reportedCount >= minTasks
 * 当日に **STREAK / ALL_COMPLETE / PROXY のいずれか** (非 CANCELLED) があれば作らない。
 *   PROXY は「子セルフ報告で宝箱が出ない家庭への補填」枠なので、子供が既に
 *   STREAK / ALL_COMPLETE を得ている混合家庭では追加で出さない（重複防止）。
 * プール 0 でも生成する（開封時にコレクションアイテムが必ず出るため）。
 */
export async function generateProxyTreasure(input: {
  childId: string;
  date: Date;
  reportedCount: number;
  totalCount: number;
  minTasks: number;
}): Promise<string | null> {
  if (input.reportedCount < input.minTasks) return null;

  const existing = await prisma.treasureLog.findFirst({
    where: {
      childId: input.childId,
      date: input.date,
      trigger: { in: ["STREAK", "ALL_COMPLETE", "PROXY"] },
      status: { not: "CANCELLED" },
    },
    select: { id: true },
  });
  if (existing) return null;

  const t = await prisma.treasureLog.create({
    data: {
      childId: input.childId,
      date: input.date,
      trigger: "PROXY",
      boosted: false,
      status: "UNLOCKED",
    },
  });
  return t.id;
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
 *  - 親ごほうび不当選 (プール空 or rng が外れ) → 現在シーズンのコレクションアイテムを 1個付与
 *    (仕様: docs/未実装仕様書/treasure-collection-items.md)
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
    rng: options.rng,
  });

  const drawnItem = draw.itemId ? pool.find((p) => p.id === draw.itemId) ?? null : null;

  // 親ごほうび不当選なら季節コレクションアイテムを必ず付与
  let collectionItem: OpenedCollectionItem | null = null;
  if (drawnItem === null) {
    const season = getSeasonForDate(now);
    const seasonItems = getItemsBySeason(season);
    const picked = drawCollectionItem(seasonItems, options.rng);
    if (picked) {
      const owned = await awardCollectionItem(childId, picked.id, season, now);
      collectionItem = {
        id: picked.id,
        name: picked.name,
        rarity: picked.rarity,
        season: picked.season,
        description: picked.description,
        image: picked.image,
        count: owned.count,
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

  return {
    logId: log.id,
    item: drawnItem
      ? { id: drawnItem.id, title: drawnItem.title, rarity: drawnItem.rarity }
      : null,
    collectionItem,
  };
}
