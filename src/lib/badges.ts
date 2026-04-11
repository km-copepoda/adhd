import { prisma } from "@/lib/prisma";

// ─── 型定義 ──────────────────────────────────────────────────────────────

export type Badge = {
  id: string;
  name: string;
  emoji: string;
  description: string;
};

export type BadgeContext = {
  // ユーザー状態
  evolutionStage: number;
  rebirthCount: number;        // collectedPaths の長さ
  totalXp: number;             // studyPt + staminaPt + lifePt
  collectionCount: number;     // ( rebirthCount - 1 ) / 3 をして切り捨てた値が転生回数

  // コレクション系
  hasStudyCollection: boolean;
  hasStaminaCollection: boolean;
  hasLifeCollection: boolean;
  hasAllTypesCollection: boolean;

  // ストリーク
  bestTaskStreak: number;
  loginCurrentStreak: number;
  loginBestStreak: number;

  // クエスト集計
  approvedCount: number;
  photoCount: number;
  deadlineBonusCount: number;
  quickReportCount: number;     // 報告まで30分未満
  morningReportCount: number;   // JST 8時前の報告
  afternoonReportCount: number; // JST 15〜18時の報告
  retrySuccessCount: number;    // 差し戻し後に承認
  skipCount: number;
  skipThenNextDayCount: number; // スキップ翌日に達成

  // 1日の達成
  perfectDaysCount: number;
  maxQuestsPerDay: number;

  // 週次
  weeksWithFivePlusDays: number;
  weeksWithSevenDays: number;

  // 月次
  monthsWithTenPlusDays: number;
  monthsWithFifteenPlusDays: number;
  monthsWithTwentyPlusDays: number;
  perfectMonthsCount: number;

  // 季節・曜日
  springDays: number;
  summerDays: number;
  autumnDays: number;
  winterDays: number;
  hasNewYearQuest: boolean;
  monthEndCount: number;
  mondayCount: number;
  weekendCount: number;

  // 自発性
  selfTaskCreatedCount: number;
  selfTaskApprovedCount: number;
  maxSingleTaskBestStreak: number;

  // カムバック
  hasComeback7: boolean;
  hasComeback14: boolean;
  hasComeback7After2Breaks: boolean;

  // 複合チャレンジ
  hasMagicDay: boolean;
  hasWeekWithDailyDeadline: boolean;
  tripleCrownDaysCount: number;

  // マイルストーン（すでに解除済みバッジ数、新規解除分は含まない）
  unlockedBadgeCount: number;
};

// ─── バッジ定義（100個） ──────────────────────────────────────────────────

export const ALL_BADGES: Badge[] = [
  // ─── #1-10: はじめて系 ─────────────────────────────────
  { id: "first_hatch",        emoji: "🥚", name: "たんじょう！",         description: "はじめてモンスターを孵化させた" },
  { id: "first_quest",        emoji: "🌟", name: "さいしょの一歩",       description: "はじめてクエストを完了報告した" },
  { id: "first_approval",     emoji: "✅", name: "はじめての承認",       description: "はじめて親にクエストを承認してもらった" },
  { id: "first_photo",        emoji: "📸", name: "カメラデビュー",       description: "はじめて写真付きで報告した" },
  { id: "first_self_task",    emoji: "📝", name: "じぶんでつくった",     description: "はじめて自分でタスクを追加した" },
  { id: "first_self_approved",emoji: "💡", name: "アイデア採用！",       description: "自分で作ったタスクがはじめて親に承認された" },
  { id: "first_skip",         emoji: "🤝", name: "正直に言えた",         description: "はじめてスキップ申請した" },
  { id: "first_retry",        emoji: "🔄", name: "リトライ！",           description: "差し戻しされたクエストを再報告して承認された" },
  { id: "first_evo2",         emoji: "✨", name: "はじめての進化",       description: "はじめてモンスターがstage2に進化した" },
  { id: "first_evo3",         emoji: "🔥", name: "最終形態！",           description: "はじめてモンスターがstage3に進化した" },

  // ─── #11-16: タスクストリーク系 ────────────────────────
  { id: "streak_3",       emoji: "⚡", name: "3日コンボ",          description: "タスクストリーク3日達成" },
  { id: "streak_7",       emoji: "🔥", name: "1週間ファイター",    description: "タスクストリーク7日達成" },
  { id: "streak_14",      emoji: "💥", name: "2週間バースト",      description: "タスクストリーク14日達成" },
  { id: "streak_21",      emoji: "🏆", name: "3週間マスター",      description: "タスクストリーク21日達成" },
  { id: "streak_30",      emoji: "💎", name: "1ヶ月チャンピオン",  description: "タスクストリーク30日達成" },
  { id: "streak_comeback",emoji: "🌟", name: "ストリーク復活",     description: "ストリークが途切れた後また7日続けた" },

  // ─── #17-21: ログインストリーク系 ──────────────────────
  { id: "login_3",        emoji: "📅", name: "3日連続ログイン",    description: "ログインストリーク3日" },
  { id: "login_7",        emoji: "🌱", name: "1週間ログイン",      description: "ログインストリーク7日" },
  { id: "login_14",       emoji: "🌿", name: "2週間ログイン",      description: "ログインストリーク14日" },
  { id: "login_30",       emoji: "🌳", name: "1ヶ月ログイン",      description: "ログインストリーク30日" },
  { id: "login_morning7", emoji: "🌅", name: "朝の習慣",           description: "8時前にクエストを報告した（7回）" },

  // ─── #22-27: 累計クエスト数 ────────────────────────────
  { id: "quest_10",  emoji: "🎉", name: "10回クリア！",   description: "累計10クエスト完了" },
  { id: "quest_30",  emoji: "🚀", name: "30回クリア！",   description: "累計30クエスト完了" },
  { id: "quest_50",  emoji: "💯", name: "50回クリア！",   description: "累計50クエスト完了" },
  { id: "quest_100", emoji: "🌟", name: "100回クリア！",  description: "累計100クエスト完了" },
  { id: "quest_200", emoji: "🏆", name: "200回クリア！",  description: "累計200クエスト完了" },
  { id: "quest_300", emoji: "👑", name: "300回クリア！",  description: "累計300クエスト完了" },

  // ─── #28-32: 承認カウント系 ────────────────────────────
  { id: "approval_10",  emoji: "❤️",  name: "10回承認された",  description: "累計10回承認された" },
  { id: "approval_30",  emoji: "💛",  name: "30回承認された",  description: "累計30回承認された" },
  { id: "approval_50",  emoji: "💚",  name: "50回承認された",  description: "累計50回承認された" },
  { id: "approval_100", emoji: "💙",  name: "100回承認された", description: "累計100回承認された" },
  { id: "approval_200", emoji: "💜",  name: "200回承認された", description: "累計200回承認された" },

  // ─── #33-37: 累計XP系 ─────────────────────────────────
  { id: "xp_10",  emoji: "💰", name: "10pt貯めた",  description: "累計10pt獲得" },
  { id: "xp_30",  emoji: "💎", name: "30pt貯めた",  description: "累計30pt獲得" },
  { id: "xp_50",  emoji: "🏅", name: "50pt貯めた",  description: "累計50pt獲得" },
  { id: "xp_100", emoji: "🏆", name: "100pt貯めた", description: "累計100pt獲得" },
  { id: "xp_200", emoji: "👑", name: "200pt貯めた", description: "累計200pt獲得" },

  // ─── #38-41: 写真系 ────────────────────────────────────
  { id: "photo_5",   emoji: "📸", name: "写真5枚",       description: "写真付き報告5回" },
  { id: "photo_20",  emoji: "🤳", name: "写真20枚",      description: "写真付き報告20回" },
  { id: "photo_50",  emoji: "🎞️", name: "写真50枚",      description: "写真付き報告50回" },
  { id: "photo_100", emoji: "🏆", name: "フォトマスター", description: "写真付き報告100回" },

  // ─── #42-45: 期限ボーナス系 ────────────────────────────
  { id: "deadline_first", emoji: "🎯", name: "期限内初達成",    description: "期限ボーナス付き報告を初めて達成" },
  { id: "deadline_10",    emoji: "⚡", name: "期限マスター10",  description: "期限ボーナス付き報告10回" },
  { id: "deadline_30",    emoji: "🏃", name: "期限マスター30",  description: "期限ボーナス付き報告30回" },
  { id: "deadline_50",    emoji: "💨", name: "神速クリア",      description: "期限ボーナス付き報告50回" },

  // ─── #46-51: 時間帯系 ─────────────────────────────────
  { id: "morning_first",  emoji: "🌅", name: "朝イチヒーロー",  description: "8時前にタスクを完了（初回）" },
  { id: "morning_7",      emoji: "☀️", name: "朝活の人",        description: "8時前のタスク完了7回達成" },
  { id: "afternoon_first",emoji: "☕", name: "午後の集中",      description: "15〜18時にタスクを完了（初回）" },
  { id: "afternoon_10",   emoji: "☕", name: "放課後マスター",   description: "15〜18時のタスク完了10回達成" },
  { id: "quick_first",    emoji: "⚡", name: "思い立ったが吉日", description: "タスク追加から30分以内に完了報告した" },
  { id: "quick_10",       emoji: "🚀", name: "即行動10回",      description: "タスク追加から1時間以内の完了を10回達成" },

  // ─── #52-56: 1日の達成系 ──────────────────────────────
  { id: "perfect_first", emoji: "🎯", name: "パーフェクトデイ",   description: "1日のタスクをすべて完了（初回）" },
  { id: "perfect_5",     emoji: "💪", name: "パーフェクト5回",    description: "パーフェクトデイを5日達成" },
  { id: "perfect_15",    emoji: "🌟", name: "パーフェクト15回",   description: "パーフェクトデイを15日達成" },
  { id: "day_3quests",   emoji: "🦸", name: "1日3クエスト",      description: "1日に3つのクエストを完了した" },
  { id: "day_5quests",   emoji: "💥", name: "1日5クエスト",      description: "1日に5つのクエストを完了した" },

  // ─── #57-60: 週の達成系 ───────────────────────────────
  { id: "week_5",   emoji: "📅", name: "週5達成",       description: "1週間に5日タスクを完了した" },
  { id: "week_5x3", emoji: "🌟", name: "週5を3回",      description: "週5日達成を3週間達成した" },
  { id: "week_7",   emoji: "💯", name: "週7パーフェクト",description: "1週間毎日タスクを完了した" },
  { id: "week_7x3", emoji: "👑", name: "週7を3回",      description: "週7日達成を3週間達成した" },

  // ─── #61-64: 月の達成系 ───────────────────────────────
  { id: "month_10",      emoji: "📅", name: "月10日達成",  description: "1ヶ月で10日以上タスクを完了した" },
  { id: "month_15",      emoji: "📅", name: "月15日達成",  description: "1ヶ月で15日以上タスクを完了した" },
  { id: "month_20",      emoji: "📅", name: "月20日達成",  description: "1ヶ月で20日以上タスクを完了した" },
  { id: "month_perfect", emoji: "🏆", name: "皆勤賞",      description: "1ヶ月すべての日にタスクを完了した" },

  // ─── #65-69: 転生系 ────────────────────────────────────
  { id: "rebirth_1", emoji: "♻️", name: "はじめての転生", description: "初めて転生した" },
  { id: "rebirth_2", emoji: "♻️", name: "転生2回",        description: "2回転生した" },
  { id: "rebirth_3", emoji: "♻️", name: "転生3回",        description: "3回転生した" },
  { id: "rebirth_5", emoji: "♻️", name: "転生5回",        description: "5回転生した" },
  { id: "rebirth_7", emoji: "👑", name: "転生の達人",      description: "7回転生した" },

  // ─── #70-75: コレクション系 ───────────────────────────
  { id: "collection_3",      emoji: "🎨", name: "コレクター3",     description: "モンスター3種コレクション" },
  { id: "collection_6",      emoji: "🎨", name: "コレクター6",     description: "モンスター6種コレクション" },
  { id: "collection_study",  emoji: "📚", name: "STUDY系制覇",     description: "STUDY系モンスターをコレクションした" },
  { id: "collection_stamina",emoji: "💪", name: "STAMINA系制覇",   description: "STAMINA系モンスターをコレクションした" },
  { id: "collection_life",   emoji: "🏠", name: "LIFE系制覇",      description: "LIFE系モンスターをコレクションした" },
  { id: "collection_all",    emoji: "🌈", name: "全系統制覇",      description: "3系統すべてのモンスターをコレクションした" },

  // ─── #76-83: 自発性・粘り強さ・メンタル系 ─────────────
  { id: "self_task_3",  emoji: "💡", name: "アイデアマン3",   description: "自分で作ったタスクが3個承認された" },
  { id: "self_task_10", emoji: "💡", name: "アイデアマン10",  description: "自分で作ったタスクが10個承認された" },
  { id: "self_task_20", emoji: "🚀", name: "クリエイター",    description: "自分で作ったタスクが20個承認された" },
  { id: "habit_14",     emoji: "🔁", name: "習慣メーカー",    description: "同じタスクを14日連続完了した" },
  { id: "habit_30",     emoji: "🔁", name: "習慣の鬼",        description: "同じタスクを30日連続完了した" },
  { id: "skip_recovery",emoji: "💪", name: "立ち直り",        description: "スキップが承認された翌日にタスクを完了した" },
  { id: "skip_aware",   emoji: "🧠", name: "自己認識上手",    description: "スキップ申請を5回した（自分を知ってる！）" },
  { id: "retry_5",      emoji: "💪", name: "折れない心",      description: "差し戻し後の再報告を5回成功させた" },

  // ─── #84-91: 曜日・季節系 ─────────────────────────────
  { id: "monday_5",   emoji: "💪", name: "月曜日の勇者",      description: "月曜日にタスクを完了（5回）" },
  { id: "weekend_10", emoji: "🎉", name: "週末ヒーロー",      description: "土日どちらかにタスクを完了（10回）" },
  { id: "spring",     emoji: "🌸", name: "春のスタート",      description: "4月にタスクを10日完了した" },
  { id: "summer",     emoji: "🌻", name: "夏の陣",            description: "7〜8月にタスクを15日完了した" },
  { id: "autumn",     emoji: "🍂", name: "秋の集中",          description: "9〜10月にタスクを15日完了した" },
  { id: "winter",     emoji: "⛄", name: "冬のぼうけん",      description: "12〜1月にタスクを15日完了した" },
  { id: "newyear",    emoji: "🎌", name: "お正月ファイター",  description: "1月1〜3日にタスクを完了した" },
  { id: "month_end",  emoji: "🗓️", name: "月末ファイター",    description: "月の終わりにタスクを完了した（5回）" },

  // ─── #92-100: 複合チャレンジ系 ────────────────────────
  { id: "milestone_10",   emoji: "🌟", name: "実績10個解除",      description: "この実績を除く他の実績を10個解除した" },
  { id: "milestone_25",   emoji: "🌟", name: "実績25個解除",      description: "この実績を除く他の実績を25個解除した" },
  { id: "milestone_50",   emoji: "🌟", name: "実績50個解除",      description: "この実績を除く他の実績を50個解除した" },
  { id: "milestone_75",   emoji: "👑", name: "実績75個解除",      description: "この実績を除く他の実績を75個解除した" },
  { id: "comeback_7x2",   emoji: "🌈", name: "カムバックキング2", description: "ストリークが2回以上途切れた後、また7日続けた" },
  { id: "multi_tasker",   emoji: "🔥", name: "マルチタスカー",    description: "1日に期限ボーナスと写真付きをどちらも達成した" },
  { id: "speed_star",     emoji: "⚡", name: "スピードスター",    description: "1週間で毎日期限ボーナスを獲得した" },
  { id: "triple_crown",   emoji: "💪", name: "三冠王",            description: "3pt満点（完了+期限+写真）を10日達成した" },
  { id: "comeback_14",    emoji: "🌈", name: "カムバックキング",  description: "ストリークが途切れた後また14日続けた" },
];

// ─── バッジ条件チェック（純粋関数） ──────────────────────────────────────

const BADGE_CONDITIONS: Record<string, (ctx: BadgeContext) => boolean> = {
  // #1-10: はじめて系
  "first_hatch":         c => c.evolutionStage >= 1 || c.rebirthCount >= 1,
  "first_quest":         c => c.approvedCount >= 1,
  "first_approval":      c => c.approvedCount >= 1,
  "first_photo":         c => c.photoCount >= 1,
  "first_self_task":     c => c.selfTaskCreatedCount >= 1,
  "first_self_approved": c => c.selfTaskApprovedCount >= 1,
  "first_skip":          c => c.skipCount >= 1,
  "first_retry":         c => c.retrySuccessCount >= 1,
  "first_evo2":          c => c.evolutionStage >= 2 || c.rebirthCount >= 1,
  "first_evo3":          c => c.evolutionStage >= 3 || c.rebirthCount >= 1,

  // #11-16: ストリーク系
  "streak_3":        c => c.bestTaskStreak >= 3,
  "streak_7":        c => c.bestTaskStreak >= 7,
  "streak_14":       c => c.bestTaskStreak >= 14,
  "streak_21":       c => c.bestTaskStreak >= 21,
  "streak_30":       c => c.bestTaskStreak >= 30,
  "streak_comeback": c => c.hasComeback7,

  // #17-21: ログインストリーク系
  "login_3":        c => c.loginBestStreak >= 3,
  "login_7":        c => c.loginBestStreak >= 7,
  "login_14":       c => c.loginBestStreak >= 14,
  "login_30":       c => c.loginBestStreak >= 30,
  "login_morning7": c => c.morningReportCount >= 7,

  // #22-27: クエスト数系
  "quest_10":  c => c.approvedCount >= 10,
  "quest_30":  c => c.approvedCount >= 30,
  "quest_50":  c => c.approvedCount >= 50,
  "quest_100": c => c.approvedCount >= 100,
  "quest_200": c => c.approvedCount >= 200,
  "quest_300": c => c.approvedCount >= 300,

  // #28-32: 承認カウント系
  "approval_10":  c => c.approvedCount >= 10,
  "approval_30":  c => c.approvedCount >= 30,
  "approval_50":  c => c.approvedCount >= 50,
  "approval_100": c => c.approvedCount >= 100,
  "approval_200": c => c.approvedCount >= 200,

  // #33-37: XP系
  "xp_10":  c => c.totalXp >= 10,
  "xp_30":  c => c.totalXp >= 30,
  "xp_50":  c => c.totalXp >= 50,
  "xp_100": c => c.totalXp >= 100,
  "xp_200": c => c.totalXp >= 200,

  // #38-41: 写真系
  "photo_5":   c => c.photoCount >= 5,
  "photo_20":  c => c.photoCount >= 20,
  "photo_50":  c => c.photoCount >= 50,
  "photo_100": c => c.photoCount >= 100,

  // #42-45: 期限ボーナス系
  "deadline_first": c => c.deadlineBonusCount >= 1,
  "deadline_10":    c => c.deadlineBonusCount >= 10,
  "deadline_30":    c => c.deadlineBonusCount >= 30,
  "deadline_50":    c => c.deadlineBonusCount >= 50,

  // #46-51: 時間帯系
  "morning_first":   c => c.morningReportCount >= 1,
  "morning_7":       c => c.morningReportCount >= 7,
  "afternoon_first": c => c.afternoonReportCount >= 1,
  "afternoon_10":    c => c.afternoonReportCount >= 10,
  "quick_first":     c => c.quickReportCount >= 1,
  "quick_10":        c => c.quickReportCount >= 10,

  // #52-56: 1日の達成系
  "perfect_first": c => c.perfectDaysCount >= 1,
  "perfect_5":     c => c.perfectDaysCount >= 5,
  "perfect_15":    c => c.perfectDaysCount >= 15,
  "day_3quests":   c => c.maxQuestsPerDay >= 3,
  "day_5quests":   c => c.maxQuestsPerDay >= 5,

  // #57-60: 週の達成系
  "week_5":   c => c.weeksWithFivePlusDays >= 1,
  "week_5x3": c => c.weeksWithFivePlusDays >= 3,
  "week_7":   c => c.weeksWithSevenDays >= 1,
  "week_7x3": c => c.weeksWithSevenDays >= 3,

  // #61-64: 月の達成系
  "month_10":      c => c.monthsWithTenPlusDays >= 1,
  "month_15":      c => c.monthsWithFifteenPlusDays >= 1,
  "month_20":      c => c.monthsWithTwentyPlusDays >= 1,
  "month_perfect": c => c.perfectMonthsCount >= 1,

  // #65-69: 転生系
  "rebirth_1": c => c.rebirthCount >= 1,
  "rebirth_2": c => c.rebirthCount >= 2,
  "rebirth_3": c => c.rebirthCount >= 3,
  "rebirth_5": c => c.rebirthCount >= 5,
  "rebirth_7": c => c.rebirthCount >= 7,

  // #70-75: コレクション系
  "collection_3":       c => c.collectionCount >= 3,
  "collection_6":       c => c.collectionCount >= 6,
  "collection_study":   c => c.hasStudyCollection,
  "collection_stamina": c => c.hasStaminaCollection,
  "collection_life":    c => c.hasLifeCollection,
  "collection_all":     c => c.hasAllTypesCollection,

  // #76-83: 自発性・粘り強さ・メンタル系
  "self_task_3":   c => c.selfTaskApprovedCount >= 3,
  "self_task_10":  c => c.selfTaskApprovedCount >= 10,
  "self_task_20":  c => c.selfTaskApprovedCount >= 20,
  "habit_14":      c => c.maxSingleTaskBestStreak >= 14,
  "habit_30":      c => c.maxSingleTaskBestStreak >= 30,
  "skip_recovery": c => c.skipThenNextDayCount >= 1,
  "skip_aware":    c => c.skipCount >= 5,
  "retry_5":       c => c.retrySuccessCount >= 5,

  // #84-91: 曜日・季節系
  "monday_5":   c => c.mondayCount >= 5,
  "weekend_10": c => c.weekendCount >= 10,
  "spring":     c => c.springDays >= 10,
  "summer":     c => c.summerDays >= 15,
  "autumn":     c => c.autumnDays >= 15,
  "winter":     c => c.winterDays >= 15,
  "newyear":    c => c.hasNewYearQuest,
  "month_end":  c => c.monthEndCount >= 5,

  // #92-100: 複合チャレンジ系
  "milestone_10":  c => c.unlockedBadgeCount >= 10,
  "milestone_25":  c => c.unlockedBadgeCount >= 25,
  "milestone_50":  c => c.unlockedBadgeCount >= 50,
  "milestone_75":  c => c.unlockedBadgeCount >= 75,
  "comeback_7x2":  c => c.hasComeback7After2Breaks,
  "multi_tasker":  c => c.hasMagicDay,
  "speed_star":    c => c.hasWeekWithDailyDeadline,
  "triple_crown":  c => c.tripleCrownDaysCount >= 10,
  "comeback_14":   c => c.hasComeback14,
};

/**
 * コンテキストから獲得すべきバッジIDのセットを返す（純粋関数）。
 */
export function checkBadgeConditions(ctx: BadgeContext): Set<string> {
  const earned = new Set<string>();
  for (const badge of ALL_BADGES) {
    const condition = BADGE_CONDITIONS[badge.id];
    if (condition && condition(ctx)) {
      earned.add(badge.id);
    }
  }
  return earned;
}

// ─── ISO週キー計算 ────────────────────────────────────────────────────────

function getISOWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dayOfWeek = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // 最寄りの木曜日
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ─── DB からコンテキストを構築 ────────────────────────────────────────────

export async function loadBadgeContext(childId: string): Promise<BadgeContext> {
  const JST_OFFSET = 9 * 60 * 60 * 1000;

  const [user, streakData, allQuests, taskStreaks, selfTaskApprovedCount, selfTaskCreatedCount, unlockedBadgeCount] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: childId },
        select: {
          evolutionStage: true,
          collectedPaths: true,
          studyPt: true,
          staminaPt: true,
          lifePt: true,
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
      prisma.questInstance.findMany({
        where: { childId },
        select: {
          id: true,
          date: true,
          status: true,
          photoUrl: true,
          deadlineBonusEarned: true,
          rejectionReason: true,
          reportedAt: true,
          createdAt: true,
          template: { select: { photoBonus: true } },
        },
        orderBy: { date: "asc" },
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
    ]);

  if (!user) throw new Error(`User ${childId} not found`);

  // コレクション解析
  const collectedPathsList = JSON.parse(user.collectedPaths || "[]") as string[];
  const rebirthCount = Math.max(0, Math.floor((collectedPathsList.length - 1) / 3));
  const hasStudyCollection = collectedPathsList.some(p => p.startsWith("STUDY"));
  const hasStaminaCollection = collectedPathsList.some(p => p.startsWith("STAMINA"));
  const hasLifeCollection = collectedPathsList.some(p => p.startsWith("LIFE"));

  // ステータス別分類
  const approvedQuests = allQuests.filter(q => q.status === "APPROVED");
  const skippedQuests = allQuests.filter(q => q.status === "SKIPPED");

  const approvedCount = approvedQuests.length;
  const photoCount = approvedQuests.filter(q => q.photoUrl).length;
  const deadlineBonusCount = approvedQuests.filter(q => q.deadlineBonusEarned).length;
  const skipCount = skippedQuests.length;
  const retrySuccessCount = approvedQuests.filter(q => q.rejectionReason).length;

  // 累計XP: 承認済みクエストから生涯獲得XPを算出（進化・転生でリセットされない）
  let totalLifetimeXp = 0;
  for (const q of approvedQuests) {
    totalLifetimeXp += 1;
    if (q.deadlineBonusEarned) totalLifetimeXp++;
    if (q.template.photoBonus && q.photoUrl) totalLifetimeXp++;
  }

  // 速報: 30分以内の報告（createdAt → reportedAt）
  const quickReportCount = approvedQuests.filter(q => {
    if (!q.reportedAt || !q.createdAt) return false;
    return q.reportedAt.getTime() - q.createdAt.getTime() < 30 * 60 * 1000;
  }).length;

  // 時間帯別: JST 換算
  const morningReportCount = approvedQuests.filter(q => {
    if (!q.reportedAt) return false;
    const jstHour = new Date(q.reportedAt.getTime() + JST_OFFSET).getUTCHours();
    return jstHour < 8;
  }).length;

  const afternoonReportCount = approvedQuests.filter(q => {
    if (!q.reportedAt) return false;
    const jstHour = new Date(q.reportedAt.getTime() + JST_OFFSET).getUTCHours();
    return jstHour >= 15 && jstHour < 18;
  }).length;

  // 日付別グループ化
  const todayStr = new Date(Date.now() + JST_OFFSET).toISOString().split("T")[0];

  const approvedByDate = new Map<string, typeof approvedQuests>();
  for (const q of approvedQuests) {
    const dateStr = q.date.toISOString().split("T")[0];
    if (!approvedByDate.has(dateStr)) approvedByDate.set(dateStr, []);
    approvedByDate.get(dateStr)!.push(q);
  }

  const allByDate = new Map<string, typeof allQuests>();
  for (const q of allQuests) {
    const dateStr = q.date.toISOString().split("T")[0];
    if (!allByDate.has(dateStr)) allByDate.set(dateStr, []);
    allByDate.get(dateStr)!.push(q);
  }

  // パーフェクトデイ: 過去の日付で全クエストが APPROVED または SKIPPED
  let perfectDaysCount = 0;
  for (const [dateStr, quests] of allByDate) {
    if (dateStr >= todayStr) continue;
    if (quests.length > 0 && quests.every(q => q.status === "APPROVED" || q.status === "SKIPPED")) {
      perfectDaysCount++;
    }
  }

  const maxQuestsPerDay = Math.max(0, ...[...approvedByDate.values()].map(qs => qs.length));
  const approvedDates = [...approvedByDate.keys()].sort();

  // スキップ翌日達成
  const skippedDates = new Set(skippedQuests.map(q => q.date.toISOString().split("T")[0]));
  const approvedDatesSet = new Set(approvedDates);
  let skipThenNextDayCount = 0;
  for (const dateStr of skippedDates) {
    const next = new Date(dateStr + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    if (approvedDatesSet.has(next.toISOString().split("T")[0])) {
      skipThenNextDayCount++;
    }
  }

  // 週次集計
  const approvedDatesByWeek = new Map<string, Set<string>>();
  for (const dateStr of approvedDates) {
    const weekKey = getISOWeekKey(dateStr);
    if (!approvedDatesByWeek.has(weekKey)) approvedDatesByWeek.set(weekKey, new Set());
    approvedDatesByWeek.get(weekKey)!.add(dateStr);
  }
  let weeksWithFivePlusDays = 0;
  let weeksWithSevenDays = 0;
  for (const days of approvedDatesByWeek.values()) {
    if (days.size >= 5) weeksWithFivePlusDays++;
    if (days.size >= 7) weeksWithSevenDays++;
  }

  // 月次集計
  const approvedDatesByMonth = new Map<string, Set<string>>();
  for (const dateStr of approvedDates) {
    const monthKey = dateStr.slice(0, 7);
    if (!approvedDatesByMonth.has(monthKey)) approvedDatesByMonth.set(monthKey, new Set());
    approvedDatesByMonth.get(monthKey)!.add(dateStr);
  }
  let monthsWithTenPlusDays = 0;
  let monthsWithFifteenPlusDays = 0;
  let monthsWithTwentyPlusDays = 0;
  let perfectMonthsCount = 0;
  for (const [monthKey, days] of approvedDatesByMonth) {
    const [year, month] = monthKey.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (days.size >= 10) monthsWithTenPlusDays++;
    if (days.size >= 15) monthsWithFifteenPlusDays++;
    if (days.size >= 20) monthsWithTwentyPlusDays++;
    if (days.size >= daysInMonth) perfectMonthsCount++;
  }

  // 季節・曜日別集計
  const springDatesSet = new Set<string>();
  const summerDatesSet = new Set<string>();
  const autumnDatesSet = new Set<string>();
  const winterDatesSet = new Set<string>();
  let hasNewYearQuest = false;
  let monthEndCount = 0;
  let mondayCount = 0;
  let weekendCount = 0;

  for (const dateStr of approvedDates) {
    const d = new Date(dateStr + "T00:00:00Z");
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const dayOfWeek = d.getUTCDay();
    const daysInThisMonth = new Date(Date.UTC(d.getUTCFullYear(), month, 0)).getUTCDate();

    if (month === 4) springDatesSet.add(dateStr);
    if (month === 7 || month === 8) summerDatesSet.add(dateStr);
    if (month === 9 || month === 10) autumnDatesSet.add(dateStr);
    if (month === 12 || month === 1) winterDatesSet.add(dateStr);
    if (month === 1 && day <= 3) hasNewYearQuest = true;
    if (day >= daysInThisMonth - 2) monthEndCount++;
    if (dayOfWeek === 1) mondayCount++;
    if (dayOfWeek === 0 || dayOfWeek === 6) weekendCount++;
  }

  // 複合チャレンジ
  let hasMagicDay = false;
  let tripleCrownDaysCount = 0;
  for (const quests of approvedByDate.values()) {
    const hasDeadline = quests.some(q => q.deadlineBonusEarned);
    const hasPhoto = quests.some(q => q.photoUrl);
    if (hasDeadline && hasPhoto) {
      hasMagicDay = true;
      tripleCrownDaysCount++;
    }
  }

  // スピードスター: 1週間で毎日期限ボーナス（週7日すべての曜日）
  const deadlineByWeek = new Map<string, Set<number>>();
  for (const q of approvedQuests.filter(q => q.deadlineBonusEarned)) {
    const dateStr = q.date.toISOString().split("T")[0];
    const weekKey = getISOWeekKey(dateStr);
    const dow = new Date(dateStr + "T00:00:00Z").getUTCDay();
    if (!deadlineByWeek.has(weekKey)) deadlineByWeek.set(weekKey, new Set());
    deadlineByWeek.get(weekKey)!.add(dow);
  }
  const hasWeekWithDailyDeadline = [...deadlineByWeek.values()].some(days => days.size >= 7);

  // カムバックストリーク計算
  const { segments, breaks } = computeStreakSegments(approvedDates);
  const postBreakMax = segments.length > 1 ? Math.max(...segments.slice(1)) : 0;
  const hasComeback7 = breaks >= 1 && postBreakMax >= 7;
  const hasComeback14 = breaks >= 1 && postBreakMax >= 14;
  const hasComeback7After2Breaks = breaks >= 2 && postBreakMax >= 7;

  return {
    evolutionStage: user.evolutionStage,
    rebirthCount,
    totalXp: totalLifetimeXp,
    collectionCount: collectedPathsList.length,
    hasStudyCollection,
    hasStaminaCollection,
    hasLifeCollection,
    hasAllTypesCollection: hasStudyCollection && hasStaminaCollection && hasLifeCollection,
    bestTaskStreak: Math.max(streakData?.bestStreak ?? 0, streakData?.currentStreak ?? 0),
    loginCurrentStreak: streakData?.loginCurrentStreak ?? 0,
    loginBestStreak: streakData?.loginBestStreak ?? 0,
    approvedCount,
    photoCount,
    deadlineBonusCount,
    quickReportCount,
    morningReportCount,
    afternoonReportCount,
    retrySuccessCount,
    skipCount,
    skipThenNextDayCount,
    perfectDaysCount,
    maxQuestsPerDay,
    weeksWithFivePlusDays,
    weeksWithSevenDays,
    monthsWithTenPlusDays,
    monthsWithFifteenPlusDays,
    monthsWithTwentyPlusDays,
    perfectMonthsCount,
    springDays: springDatesSet.size,
    summerDays: summerDatesSet.size,
    autumnDays: autumnDatesSet.size,
    winterDays: winterDatesSet.size,
    hasNewYearQuest,
    monthEndCount,
    mondayCount,
    weekendCount,
    selfTaskCreatedCount,
    selfTaskApprovedCount,
    maxSingleTaskBestStreak: Math.max(0, ...taskStreaks.map(t => t.bestStreak)),
    hasComeback7,
    hasComeback14,
    hasComeback7After2Breaks,
    hasMagicDay,
    hasWeekWithDailyDeadline,
    tripleCrownDaysCount,
    unlockedBadgeCount,
  };
}

/**
 * 連続日数のセグメントとブレーク数を計算する。
 * segments[0] が最初のストリーク、segments[1] 以降が各カムバック。
 */
function computeStreakSegments(
  sortedDates: string[],
): { segments: number[]; breaks: number } {
  if (sortedDates.length === 0) return { segments: [], breaks: 0 };

  const deduped = [...new Set(sortedDates)].sort();
  const segments: number[] = [];
  let current = 1;
  let breaks = 0;

  for (let i = 1; i < deduped.length; i++) {
    const prev = new Date(deduped[i - 1] + "T00:00:00Z");
    const curr = new Date(deduped[i] + "T00:00:00Z");
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      current++;
    } else {
      segments.push(current);
      breaks++;
      current = 1;
    }
  }
  segments.push(current);
  return { segments, breaks };
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
