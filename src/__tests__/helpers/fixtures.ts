/**
 * テスト用フィクスチャファクトリ
 *
 * 各ファクトリは overrides でフィールドを上書き可能。
 * テスト内でリテラルオブジェクトを書く代わりにこれを使う。
 */

// ─── User ─────────────────────────────────────────────

interface UserFixture {
  id: string;
  supabaseId: string;
  role: "PARENT" | "CHILD";
  familyId: string | null;
  name: string | null;
  monsterName: string | null;
  side: "DARK" | "LIGHT" | null;
  evolutionStage: number;
  evolutionPath: string;
  collectedPaths: string;
  monsterLevels: string;
  studyPt: number;
  staminaPt: number;
  lifePt: number;
  minTasksForStreak: number;
  childCode: string | null;
  rebirthPending: boolean;
  rebirthEggBonus: string | null;
  usedEggBonuses: string;
  reportDeadlineTime: string | null;
  family?: { id: string; code: string };
}

export function parentUser(overrides?: Partial<UserFixture>): UserFixture {
  return {
    id: "parent-1",
    supabaseId: "sup-parent-1",
    role: "PARENT",
    familyId: "fam-1",
    name: "パパ",
    monsterName: null,
    side: null,
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
    ...overrides,
  };
}

export function childUser(overrides?: Partial<UserFixture>): UserFixture {
  return {
    id: "child-1",
    supabaseId: "sup-child-1",
    role: "CHILD",
    familyId: "fam-1",
    name: "太郎",
    monsterName: "ドラゴン",
    side: "LIGHT",
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
    ...overrides,
  };
}

// ─── TaskTemplate ─────────────────────────────────────

interface TaskTemplateFixture {
  id: string;
  title: string;
  emoji: string;
  category: "STUDY" | "STAMINA" | "LIFE";
  repeatDays: number[];
  isTemporary: boolean;
  targetDate: Date | null;
  createdBy: "PARENT" | "CHILD";
  originalCreatedBy: "PARENT" | "CHILD";
  isActive: boolean;
  familyId: string;
  photoBonus: boolean;
  carryOver: boolean;
  assignedChildId: string | null;
  quests?: QuestInstanceFixture[];
}

export function taskTemplate(overrides?: Partial<TaskTemplateFixture>): TaskTemplateFixture {
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
    familyId: "fam-1",
    photoBonus: false,
    carryOver: false,
    assignedChildId: "child-1",
    ...overrides,
  };
}

// ─── QuestInstance ────────────────────────────────────

interface QuestInstanceFixture {
  id: string;
  templateId: string;
  childId: string;
  date: Date;
  status: "PENDING" | "REPORTED" | "APPROVED" | "REJECTED" | "SKIP_REPORTED" | "SKIPPED";
  comment: string | null;
  reportedAt: Date | null;
  approvedAt: Date | null;
  deadlineBonusEarned: boolean;
  photoUrl: string | null;
  approvalStamp: string | null;
  rejectionReason: string | null;
  template?: Partial<TaskTemplateFixture>;
  child?: Partial<UserFixture>;
}

export function questInstance(overrides?: Partial<QuestInstanceFixture>): QuestInstanceFixture {
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
    ...overrides,
  };
}

// ─── Family ───────────────────────────────────────────

interface FamilyFixture {
  id: string;
  code: string;
  users?: Partial<UserFixture>[];
}

export function family(overrides?: Partial<FamilyFixture>): FamilyFixture {
  return {
    id: "fam-1",
    code: "ABC123",
    ...overrides,
  };
}

// ─── Streak ──────────────────────────────────────────

interface StreakFixture {
  id: string;
  childId: string;
  currentStreak: number;
  bestStreak: number;
  lastAchievedDate: Date | null;
  loginCurrentStreak: number;
  loginBestStreak: number;
  lastLoginDate: Date | null;
}

export function streak(overrides?: Partial<StreakFixture>): StreakFixture {
  return {
    id: "streak-1",
    childId: "child-1",
    currentStreak: 0,
    bestStreak: 0,
    lastAchievedDate: null,
    loginCurrentStreak: 0,
    loginBestStreak: 0,
    lastLoginDate: null,
    ...overrides,
  };
}
