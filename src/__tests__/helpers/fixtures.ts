/**
 * テスト用フィクスチャファクトリ
 *
 * 各ファクトリは Prisma 生成型（`@/generated/prisma/client` の `User` / `Family` 等）に
 * 準拠した完全な値を返す。overrides でフィールドを上書き可能。
 * テスト内でリテラルオブジェクトを書く代わりにこれを使う。
 *
 * ## リレーション付きバリアント
 * `include` の有無で型が変わる Prisma の実態に合わせ、リレーションを含む戻り値が
 * 必要な場合は `Prisma.XGetPayload<{ include: {...} } }>` を使った専用ファクトリを
 * 用意する（例: `childUserWithFamily` / `questWithTemplateAndChild`）。
 * ベースファクトリ（`parentUser` / `questInstance` 等）はリレーションを含まない
 * 素の Prisma モデル型を返す。
 *
 * ## select 用の部分型の書き方
 * `select` で一部フィールドだけを取得するクエリの戻り値は、完全型フィクスチャでは
 * 表現できない。呼び出し側で `Prisma.XGetPayload<{ select: {...} }>` を直接書く。
 * 例:
 * ```ts
 * import type { Prisma } from "@/generated/prisma/client";
 *
 * const partial: Prisma.TreasureLogGetPayload<{ select: { id: true; trigger: true } }> = {
 *   id: "log-1",
 *   trigger: "STREAK",
 * };
 * ```
 */

import type {
  BulletinLog,
  CheckinLog,
  Family,
  GatheringMember,
  Prisma,
  PushSubscription,
  QuestDeclaration,
  QuestInstance,
  Streak,
  Subscription,
  TaskStreak,
  TaskTemplate,
  TreasureItem,
  TreasureLog,
  User,
  UserBadge,
  UserCollectionItem,
} from "@/generated/prisma/client";

/** createdAt / updatedAt 等、値そのものに意味を持たないタイムスタンプ系フィールドの既定値 */
const FIXTURE_TIMESTAMP = new Date("2026-01-01T00:00:00.000Z");

// ─── Family ───────────────────────────────────────────

export function family(overrides?: Partial<Family>): Family {
  return {
    id: "fam-1",
    code: "ABC123",
    autoApproveTime: "24:00",
    createdAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

// ─── User ─────────────────────────────────────────────

export function parentUser(overrides?: Partial<User>): User {
  return {
    id: "parent-1",
    supabaseId: "sup-parent-1",
    role: "PARENT",
    familyId: "fam-1",
    name: "パパ",
    monsterName: null,
    side: null,
    monsterSetId: "dark",
    pendingMonsterSetId: null,
    evolutionStage: 0,
    evolutionPath: "",
    collectedPaths: "[]",
    monsterLevels: "{}",
    studyPt: 0,
    staminaPt: 0,
    lifePt: 0,
    minTasksForStreak: 1,
    childCode: null,
    rebirthPending: false,
    rebirthEggBonus: null,
    usedEggBonuses: "[]",
    reportDeadlineTime: null,
    checkinDeadlineTime: null,
    questTimeNotifyEnabled: true,
    treasurePityCount: 0,
    createdAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

export function childUser(overrides?: Partial<User>): User {
  return {
    id: "child-1",
    supabaseId: "sup-child-1",
    role: "CHILD",
    familyId: "fam-1",
    name: "太郎",
    monsterName: "ドラゴン",
    side: "LIGHT",
    monsterSetId: "light",
    pendingMonsterSetId: null,
    evolutionStage: 0,
    evolutionPath: "",
    collectedPaths: "[]",
    monsterLevels: "{}",
    studyPt: 0,
    staminaPt: 0,
    lifePt: 0,
    minTasksForStreak: 1,
    childCode: "1234",
    rebirthPending: false,
    rebirthEggBonus: null,
    usedEggBonuses: "[]",
    reportDeadlineTime: null,
    checkinDeadlineTime: null,
    questTimeNotifyEnabled: true,
    treasurePityCount: 0,
    createdAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

/** `include: { family: true }` 付きクエリの戻り値用。 `childUser` + `family` の合成。 */
export function childUserWithFamily(
  overrides?: Partial<User>,
  familyOverrides?: Partial<Family>,
): Prisma.UserGetPayload<{ include: { family: true } }> {
  return {
    ...childUser(overrides),
    family: family(familyOverrides),
  };
}

/**
 * `include: { family: true }` 付きクエリの戻り値用。 `parentUser` + `family` の合成。
 * `getCurrentUser()` のモック（`family` が必須プロパティ）に使う。
 * familyOverrides に `null` を渡すと `family: null`（familyId なしのケース）を表現する。
 */
export function parentUserWithFamily(
  overrides?: Partial<User>,
  familyOverrides?: Partial<Family> | null,
): Prisma.UserGetPayload<{ include: { family: true } }> {
  return {
    ...parentUser(overrides),
    family: familyOverrides === null ? null : family(familyOverrides),
  };
}

// ─── Subscription ─────────────────────────────────────

export function subscription(overrides?: Partial<Subscription>): Subscription {
  return {
    id: "sub-1",
    userId: "parent-1",
    plan: "FREE",
    platform: null,
    externalId: null,
    currentPeriodEnd: null,
    canceledAt: null,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

// ─── TaskTemplate ─────────────────────────────────────

export function taskTemplate(overrides?: Partial<TaskTemplate>): TaskTemplate {
  return {
    id: "tpl-1",
    title: "宿題",
    emoji: "📚",
    category: "STUDY",
    repeatDays: [1, 2, 3, 4, 5],
    isTemporary: false,
    targetDate: null,
    createdBy: "PARENT",
    originalCreatedBy: "PARENT",
    isActive: true,
    requestedDate: null,
    familyId: "fam-1",
    photoBonus: false,
    carryOver: false,
    pausedAt: null,
    pauseIntervals: [],
    assignedChildId: "child-1",
    createdAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

// ─── QuestInstance ────────────────────────────────────

export function questInstance(overrides?: Partial<QuestInstance>): QuestInstance {
  return {
    id: "q-1",
    templateId: "tpl-1",
    childId: "child-1",
    date: new Date("2026-03-12"),
    status: "PENDING",
    comment: null,
    reportedAt: null,
    approvedAt: null,
    deadlineBonusEarned: false,
    photoUrl: null,
    approvalStamp: null,
    rejectionReason: null,
    snapshotTitle: "宿題",
    snapshotEmoji: "📚",
    snapshotCategory: "STUDY",
    createdAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

/** `include: { template: true }` 付きクエリの戻り値用。 */
export function questWithTemplate(
  overrides?: Partial<QuestInstance>,
  templateOverrides?: Partial<TaskTemplate>,
): Prisma.QuestInstanceGetPayload<{ include: { template: true } }> {
  return {
    ...questInstance(overrides),
    template: taskTemplate(templateOverrides),
  };
}

/** `include: { template: true, child: true }` 付きクエリの戻り値用。 */
export function questWithTemplateAndChild(
  overrides?: Partial<QuestInstance>,
  templateOverrides?: Partial<TaskTemplate>,
  childOverrides?: Partial<User>,
): Prisma.QuestInstanceGetPayload<{ include: { template: true; child: true } }> {
  return {
    ...questInstance(overrides),
    template: taskTemplate(templateOverrides),
    child: childUser(childOverrides),
  };
}

// ─── Streak ──────────────────────────────────────────

export function streak(overrides?: Partial<Streak>): Streak {
  return {
    id: "streak-1",
    childId: "child-1",
    currentStreak: 0,
    bestStreak: 0,
    lastAchievedDate: null,
    loginCurrentStreak: 0,
    loginBestStreak: 0,
    lastLoginDate: null,
    checkinCurrentStreak: 0,
    checkinBestStreak: 0,
    lastCheckinDate: null,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

// ─── CheckinLog ───────────────────────────────────────

export function checkinLog(overrides?: Partial<CheckinLog>): CheckinLog {
  return {
    id: "checkin-1",
    childId: "child-1",
    date: new Date("2026-03-12"),
    success: true,
    checkedInAt: null,
    createdAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

// ─── TaskStreak ───────────────────────────────────────

export function taskStreak(overrides?: Partial<TaskStreak>): TaskStreak {
  return {
    id: "task-streak-1",
    taskId: "tpl-1",
    childId: "child-1",
    currentStreak: 0,
    bestStreak: 0,
    lastAchievedDate: null,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

// ─── UserBadge ────────────────────────────────────────

export function userBadge(overrides?: Partial<UserBadge>): UserBadge {
  return {
    id: "badge-1",
    userId: "child-1",
    badgeId: "first-quest",
    unlockedAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

// ─── PushSubscription ─────────────────────────────────

export function pushSubscription(overrides?: Partial<PushSubscription>): PushSubscription {
  return {
    id: "push-1",
    userId: "child-1",
    endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
    p256dh: "test-p256dh-key",
    auth: "test-auth-key",
    createdAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

// ─── QuestDeclaration ─────────────────────────────────

export function questDeclaration(overrides?: Partial<QuestDeclaration>): QuestDeclaration {
  return {
    id: "decl-1",
    templateId: "tpl-1",
    childId: "child-1",
    date: new Date("2026-03-12"),
    createdAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

// ─── TreasureItem ─────────────────────────────────────

export function treasureItem(overrides?: Partial<TreasureItem>): TreasureItem {
  return {
    id: "item-1",
    childId: "child-1",
    title: "ゲーム30分",
    rarity: "COMMON",
    sortOrder: 0,
    isActive: true,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

// ─── TreasureLog ──────────────────────────────────────

export function treasureLog(overrides?: Partial<TreasureLog>): TreasureLog {
  return {
    id: "log-1",
    childId: "child-1",
    date: new Date("2026-03-12"),
    trigger: "STREAK",
    boosted: false,
    status: "LOCKED",
    itemId: null,
    collectionItemId: null,
    fulfilled: false,
    openedAt: null,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

// ─── UserCollectionItem ───────────────────────────────

export function userCollectionItem(overrides?: Partial<UserCollectionItem>): UserCollectionItem {
  return {
    id: "collection-1",
    childId: "child-1",
    itemId: "summer-01",
    season: "2026-summer",
    count: 1,
    firstAcquiredAt: FIXTURE_TIMESTAMP,
    lastAcquiredAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

// ─── GatheringMember ──────────────────────────────────

export function gatheringMember(overrides?: Partial<GatheringMember>): GatheringMember {
  return {
    id: "member-1",
    groupId: "group-1",
    childId: "child-1",
    joinedAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

// ─── BulletinLog ──────────────────────────────────────

export function bulletinLog(overrides?: Partial<BulletinLog>): BulletinLog {
  return {
    id: "bulletin-1",
    groupId: "group-1",
    childId: "child-1",
    type: "TASK_COMPLETE",
    message: "宿題完了！",
    key: "",
    date: new Date("2026-03-12"),
    createdAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}
