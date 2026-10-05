import { prisma } from "@/lib/prisma";
import { ALL_BADGES, checkBadgeConditions } from "@/lib/badges.data";
import type { Badge, BadgeContext } from "@/lib/badges.data";
import { ALL_COLLECTION_ITEMS } from "@/lib/collectionItems";
import { buildQuestBadgeStats } from "@/lib/badgeQuestStats";
import type { QuestDateRow } from "@/lib/badgeQuestStats";
import { todayStringJST } from "@/lib/date";

// Re-export types and data for consumers
export { ALL_BADGES, checkBadgeConditions, getBadgeProgress } from "@/lib/badges.data";
export type { Badge, BadgeContext, BadgeProgress } from "@/lib/badges.data";

// ─── DB からコンテキストを構築 ────────────────────────────────────────────

export async function loadBadgeContext(childId: string): Promise<BadgeContext> {
  const JST_OFFSET = 9 * 60 * 60 * 1000;

  const [
    user,
    streakData,
    questStatusGroups,
    questPhotoGroups,
    retrySuccessCount,
    photoBonusXpCount,
    approvedReportTimes,
    taskStreaks,
    selfTaskApprovedCount,
    selfTaskCreatedCount,
    unlockedBadgeCount,
    openedTreasures,
    userCollectionItems,
  ] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: childId },
        select: {
          evolutionStage: true,
          collectedPaths: true,
          studyPt: true,
          staminaPt: true,
          lifePt: true,
          usedEggBonuses: true,
        },
      }),
      prisma.streak.findUnique({
        where: { childId },
        select: {
          currentStreak: true,
          bestStreak: true,
          loginCurrentStreak: true,
          loginBestStreak: true,
        },
      }),
      // QuestInstance は全件取得せず DB で集計する（Issue #161）。
      // 複数クエリ間のスナップショット不一致は許容する。ズレても次回の判定で収束する。
      prisma.questInstance.groupBy({
        by: ["date", "status", "deadlineBonusEarned"],
        where: { childId },
        _count: { _all: true },
      }),
      // 写真付き承認（null と空文字は「無し」）
      prisma.questInstance.groupBy({
        by: ["date"],
        where: { childId, status: "APPROVED", photoUrl: { not: null }, NOT: { photoUrl: "" } },
        _count: { _all: true },
      }),
      prisma.questInstance.count({
        where: { childId, status: "APPROVED", rejectionReason: { not: null }, NOT: { rejectionReason: "" } },
      }),
      prisma.questInstance.count({
        where: {
          childId,
          status: "APPROVED",
          photoUrl: { not: null },
          NOT: { photoUrl: "" },
          template: { photoBonus: true },
        },
      }),
      // 速報・時間帯の判定用（アプリ側で JST 換算するため時刻2列だけ取得）
      prisma.questInstance.findMany({
        where: { childId, status: "APPROVED", reportedAt: { not: null } },
        select: { reportedAt: true, createdAt: true },
      }),
      prisma.taskStreak.findMany({
        where: { childId },
        select: { bestStreak: true },
      }),
      // 自分で作成して親に承認されたタスク数
      prisma.taskTemplate.count({
        where: {
          assignedChildId: childId,
          originalCreatedBy: "CHILD",
          createdBy: "PARENT",
        },
      }),
      // 自分で作成したタスク数（承認待ち含む）
      prisma.taskTemplate.count({
        where: {
          assignedChildId: childId,
          originalCreatedBy: "CHILD",
        },
      }),
      prisma.userBadge.count({ where: { userId: childId } }),
      // 宝箱: 開封済みの TreasureLog（rarity 集計のため item を含める）
      prisma.treasureLog.findMany({
        where: { childId, status: "OPENED" },
        select: { item: { select: { rarity: true } } },
      }),
      // コレクションアイテム: 所持しているアイテム（種類別）
      prisma.userCollectionItem.findMany({
        where: { childId },
        select: { itemId: true, season: true },
      }),
    ]);

  if (!user) throw new Error(`User ${childId} not found`);

  // コレクション解析
  // collectedPaths は "themeId:path"（新形式）と裸の path（旧形式・dark/light扱い）が
  // 混在しうる（Issue #73 モンスターテーマ名前空間対応）。カテゴリ判定の前に
  // "themeId:" プレフィックスを取り除いてから startsWith 判定する。
  const collectedPathsList = JSON.parse(user.collectedPaths || "[]") as string[];
  const bareCollectedPaths = collectedPathsList.map(p => p.includes(":") ? p.split(":").slice(1).join(":") : p);
  const rebirthCount = Math.max(0, Math.floor((collectedPathsList.length - 1) / 3));
  const hasStudyCollection = bareCollectedPaths.some(p => p.startsWith("STUDY"));
  const hasStaminaCollection = bareCollectedPaths.some(p => p.startsWith("STAMINA"));
  const hasLifeCollection = bareCollectedPaths.some(p => p.startsWith("LIFE"));

  // 日付別の件数に畳み込む
  const byDate = new Map<string, QuestDateRow>();
  const rowOf = (date: Date): QuestDateRow => {
    const key = date.toISOString().split("T")[0];
    let row = byDate.get(key);
    if (!row) {
      row = { date: key, total: 0, approved: 0, skipped: 0, approvedDeadline: 0, approvedPhoto: 0 };
      byDate.set(key, row);
    }
    return row;
  };
  for (const g of questStatusGroups) {
    const row = rowOf(g.date);
    const n = g._count._all;
    row.total += n;
    if (g.status === "SKIPPED") row.skipped += n;
    if (g.status === "APPROVED") {
      row.approved += n;
      if (g.deadlineBonusEarned) row.approvedDeadline += n;
    }
  }
  for (const g of questPhotoGroups) rowOf(g.date).approvedPhoto += g._count._all;

  // 速報: 30分以内の報告（createdAt → reportedAt）、時間帯別: JST 換算
  let quickReportCount = 0;
  let morningReportCount = 0;
  let afternoonReportCount = 0;
  for (const q of approvedReportTimes) {
    if (!q.reportedAt) continue;
    if (q.reportedAt.getTime() - q.createdAt.getTime() < 30 * 60 * 1000) quickReportCount++;
    const jstHour = new Date(q.reportedAt.getTime() + JST_OFFSET).getUTCHours();
    if (jstHour < 8) morningReportCount++;
    if (jstHour >= 15 && jstHour < 18) afternoonReportCount++;
  }

  const questStats = buildQuestBadgeStats(
    [...byDate.values()],
    { retrySuccessCount, photoBonusXpCount, quickReportCount, morningReportCount, afternoonReportCount },
    todayStringJST(),
  );

  // 宝箱: 開封数と RARE 当選数
  const treasureOpenedCount = openedTreasures.length;
  const rareTreasureCount = openedTreasures.filter(t => t.item?.rarity === "RARE").length;

  // コレクションアイテム:
  //  - collectionItemCount は月限定も含めた distinct 種類数 (累積目標系 item_first / item_30 用)
  //  - season_complete / hasAllCollectionItems は「通常アイテム 80 種」のみを母数にする。
  //    月限定 60 種は取り逃すと 1 年待ちで、シーズン内 35 種完走を要求すると事実上不可能に
  //    なるため (仕様: monthly-limited-collection-items.md §7)
  const collectionItemCount = userCollectionItems.length;
  const collectedItemIds = new Set(userCollectionItems.map(i => i.itemId));
  const regularItems = ALL_COLLECTION_ITEMS.filter(i => i.month === undefined);
  const hasAllCollectionItems = regularItems.every(i => collectedItemIds.has(i.id));
  const seasons = new Set(regularItems.map(i => i.season));
  let collectionSeasonsComplete = 0;
  for (const season of seasons) {
    const itemsInSeason = regularItems.filter(i => i.season === season);
    if (itemsInSeason.every(i => collectedItemIds.has(i.id))) {
      collectionSeasonsComplete++;
    }
  }

  // 転生卵ボーナス: 過去に1回でも使ったか
  const usedEggBonuses = JSON.parse(user.usedEggBonuses || "[]") as string[];
  const rebirthEggUsed = usedEggBonuses.length > 0;

  return {
    evolutionStage: user.evolutionStage,
    rebirthCount,
    collectionCount: collectedPathsList.length,
    hasStudyCollection,
    hasStaminaCollection,
    hasLifeCollection,
    hasAllTypesCollection: hasStudyCollection && hasStaminaCollection && hasLifeCollection,
    bestTaskStreak: Math.max(streakData?.bestStreak ?? 0, streakData?.currentStreak ?? 0),
    loginCurrentStreak: streakData?.loginCurrentStreak ?? 0,
    loginBestStreak: streakData?.loginBestStreak ?? 0,
    ...questStats,
    selfTaskCreatedCount,
    selfTaskApprovedCount,
    maxSingleTaskBestStreak: Math.max(0, ...taskStreaks.map(t => t.bestStreak)),
    unlockedBadgeCount,
    treasureOpenedCount,
    rareTreasureCount,
    collectionItemCount,
    collectionSeasonsComplete,
    hasAllCollectionItems,
    rebirthEggUsed,
  };
}

// ─── メイン: バッジ解除チェックと保存 ────────────────────────────────────

/**
 * childId の現在状態を確認し、新たに解除されたバッジを DB に保存して返す。
 */
export async function checkAndUnlockBadges(childId: string): Promise<Badge[]> {
  const [ctx, alreadyUnlocked] = await Promise.all([
    loadBadgeContext(childId),
    prisma.userBadge.findMany({
      where: { userId: childId },
      select: { badgeId: true },
    }),
  ]);

  const alreadyUnlockedIds = new Set(alreadyUnlocked.map(b => b.badgeId));
  const shouldEarn = checkBadgeConditions(ctx);

  const newBadgeIds = [...shouldEarn].filter(id => !alreadyUnlockedIds.has(id));
  if (newBadgeIds.length === 0) return [];

  await prisma.userBadge.createMany({
    data: newBadgeIds.map(badgeId => ({ userId: childId, badgeId })),
    skipDuplicates: true,
  });

  const badgeMap = new Map(ALL_BADGES.map(b => [b.id, b]));
  return newBadgeIds.map(id => badgeMap.get(id)!).filter(Boolean);
}
