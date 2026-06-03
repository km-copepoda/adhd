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

  // 宝箱系（2026-06-03 追加）
  treasureOpenedCount: number;   // OPENED 状態の TreasureLog 数
  rareTreasureCount: number;     // RARE 当選の TreasureLog 数

  // コレクションアイテム系（2026-06-03 追加）
  collectionItemCount: number;       // 獲得済みの種類数（重複は count せず distinct）
  collectionSeasonsComplete: number; // 春/夏/秋/冬のうち 20種すべて揃ったシーズン数
  hasAllCollectionItems: boolean;    // 全80種制覇

  // 転生卵ボーナス（2026-06-03 追加）
  rebirthEggUsed: boolean;       // 転生卵ボーナスを1回以上使用した
};

// ─── バッジ定義（100個・2026-06 改訂版） ────────────────────────────────
//
// 設計方針:
// - 序盤（最初の数日）に解放されるのは1-2個までに絞る
// - 「初回◯◯」系は first_quest / first_hatch / first_self_approved の3つのみ
// - その他は「N回達成」系に統合し、閾値を引き上げて中盤からの達成感を確保
// - 累計クエスト系は quest_* に集約（旧 approval_* と重複していたため統合）
// - 総数100個は維持（旧IDの削除分を新IDで補填）

export const ALL_BADGES: Badge[] = [
  // ─── #1-3: ようこそ系（序盤の最初の1-2個） ────────────
  { id: "first_quest",         emoji: "🌟", name: "さいしょの一歩",     description: "はじめてクエストを承認してもらった" },
  { id: "first_hatch",         emoji: "🥚", name: "たんじょう！",       description: "はじめてモンスターを進化させた" },
  { id: "first_self_approved", emoji: "💡", name: "アイデア採用！",     description: "自分で作ったタスクがはじめて承認された" },

  // ─── #4-11: 累計クエスト系（8個・旧 approval_* と統合） ─
  { id: "quest_10",   emoji: "🎉", name: "10回クリア！",    description: "累計10クエスト完了" },
  { id: "quest_25",   emoji: "🚀", name: "25回クリア！",    description: "累計25クエスト完了" },
  { id: "quest_50",   emoji: "💯", name: "50回クリア！",    description: "累計50クエスト完了" },
  { id: "quest_100",  emoji: "🌟", name: "100回クリア！",   description: "累計100クエスト完了" },
  { id: "quest_200",  emoji: "🏆", name: "200回クリア！",   description: "累計200クエスト完了" },
  { id: "quest_300",  emoji: "👑", name: "300回クリア！",   description: "累計300クエスト完了" },
  { id: "quest_500",  emoji: "💎", name: "500回クリア！",   description: "累計500クエスト完了" },
  { id: "quest_1000", emoji: "🌈", name: "1000回クリア！",  description: "累計1000クエスト完了" },

  // ─── #12-18: タスクストリーク系（7個） ────────────────
  { id: "streak_5",        emoji: "⚡", name: "5日コンボ",         description: "タスクストリーク5日達成" },
  { id: "streak_10",       emoji: "🔥", name: "10日コンボ",        description: "タスクストリーク10日達成" },
  { id: "streak_14",       emoji: "💥", name: "2週間バースト",     description: "タスクストリーク14日達成" },
  { id: "streak_21",       emoji: "🏆", name: "3週間マスター",     description: "タスクストリーク21日達成" },
  { id: "streak_30",       emoji: "💎", name: "1ヶ月チャンピオン", description: "タスクストリーク30日達成" },
  { id: "streak_100",      emoji: "🌈", name: "100日コンボ",       description: "タスクストリーク100日達成" },
  { id: "streak_comeback", emoji: "🌟", name: "ストリーク復活",    description: "ストリークが途切れた後また7日続けた" },

  // ─── #19-22: ログインストリーク系（4個） ──────────────
  { id: "login_7",   emoji: "📅", name: "1週間ログイン",   description: "ログインストリーク7日" },
  { id: "login_14",  emoji: "🌱", name: "2週間ログイン",   description: "ログインストリーク14日" },
  { id: "login_30",  emoji: "🌿", name: "1ヶ月ログイン",   description: "ログインストリーク30日" },
  { id: "login_100", emoji: "🏆", name: "100日ログイン",   description: "ログインストリーク100日" },

  // ─── #27-31: 累計XP系（5個・閾値を引き上げ） ──────────
  { id: "xp_50",   emoji: "💰", name: "50pt貯めた",   description: "累計50pt獲得" },
  { id: "xp_100",  emoji: "💎", name: "100pt貯めた",  description: "累計100pt獲得" },
  { id: "xp_300",  emoji: "🏅", name: "300pt貯めた",  description: "累計300pt獲得" },
  { id: "xp_500",  emoji: "🏆", name: "500pt貯めた",  description: "累計500pt獲得" },
  { id: "xp_1000", emoji: "👑", name: "1000pt貯めた", description: "累計1000pt獲得" },

  // ─── #28-31: 写真系（4個・閾値を引き上げ） ────────────
  { id: "photo_15",  emoji: "📸", name: "写真15枚",       description: "写真付き報告15回" },
  { id: "photo_30",  emoji: "🤳", name: "写真30枚",       description: "写真付き報告30回" },
  { id: "photo_100", emoji: "🏆", name: "フォトマスター", description: "写真付き報告100回" },
  { id: "photo_200", emoji: "👑", name: "フォトキング",   description: "写真付き報告200回" },

  // ─── #32-35: 期限ボーナス系（4個） ────────────────────
  { id: "deadline_10",  emoji: "🎯", name: "期限マスター10",  description: "期限ボーナス付き報告10回" },
  { id: "deadline_50",  emoji: "💨", name: "神速クリア",      description: "期限ボーナス付き報告50回" },
  { id: "deadline_100", emoji: "🏆", name: "期限ファイター",  description: "期限ボーナス付き報告100回" },
  { id: "deadline_200", emoji: "👑", name: "期限の覇者",      description: "期限ボーナス付き報告200回" },

  // ─── #36-40: 時間帯・速報系（5個） ────────────────────
  { id: "morning_10",   emoji: "🌅", name: "朝活デビュー",    description: "8時前にクエスト完了10回達成" },
  { id: "morning_30",   emoji: "☀️", name: "朝活の人",        description: "8時前にクエスト完了30回達成" },
  { id: "afternoon_15", emoji: "☕", name: "放課後ファイター",description: "15〜18時にクエスト完了15回達成" },
  { id: "quick_10",     emoji: "🚀", name: "思い立ったが吉日",description: "タスク追加から30分以内の完了を10回達成" },
  { id: "quick_30",     emoji: "⚡", name: "即行動の達人",    description: "タスク追加から30分以内の完了を30回達成" },

  // ─── #49-54: 1日の達成系（6個） ───────────────────────
  { id: "perfect_5",   emoji: "🎯", name: "パーフェクト5回",  description: "パーフェクトデイを5日達成" },
  { id: "perfect_15",  emoji: "💪", name: "パーフェクト15回", description: "パーフェクトデイを15日達成" },
  { id: "perfect_30",  emoji: "🌟", name: "パーフェクト30回", description: "パーフェクトデイを30日達成" },
  { id: "perfect_50",  emoji: "👑", name: "パーフェクト50回", description: "パーフェクトデイを50日達成" },
  { id: "day_4quests", emoji: "🦸", name: "1日4クエスト",     description: "1日に4つのクエストを完了した" },
  { id: "day_6quests", emoji: "💥", name: "1日6クエスト",     description: "1日に6つのクエストを完了した" },

  // ─── #55-59: 週の達成系（5個） ────────────────────────
  { id: "week_5",     emoji: "📅", name: "週5達成",         description: "1週間に5日タスクを完了した" },
  { id: "week_5x3",   emoji: "🌟", name: "週5を3回",        description: "週5日達成を3週間達成した" },
  { id: "week_5x10",  emoji: "🏆", name: "週5を10回",       description: "週5日達成を10週間達成した" },
  { id: "week_7",     emoji: "💯", name: "週7パーフェクト", description: "1週間毎日タスクを完了した" },
  { id: "week_7x5",   emoji: "👑", name: "週7を5回",        description: "週7日達成を5週間達成した" },

  // ─── #60-64: 月の達成系（5個） ────────────────────────
  { id: "month_15",         emoji: "📅", name: "月15日達成",     description: "1ヶ月で15日以上タスクを完了した" },
  { id: "month_20",         emoji: "📅", name: "月20日達成",     description: "1ヶ月で20日以上タスクを完了した" },
  { id: "month_perfect",    emoji: "🏆", name: "皆勤賞",         description: "1ヶ月すべての日にタスクを完了した" },
  { id: "month_perfect_x3", emoji: "👑", name: "3ヶ月皆勤",      description: "皆勤賞を3ヶ月達成した" },
  { id: "month_15x6",       emoji: "🌟", name: "半年コツコツ",   description: "月15日達成を6ヶ月達成した" },

  // ─── #65-69: 転生系（5個） ────────────────────────────
  { id: "rebirth_1",  emoji: "♻️", name: "はじめての転生", description: "初めて転生した" },
  { id: "rebirth_2",  emoji: "♻️", name: "転生2回",        description: "2回転生した" },
  { id: "rebirth_3",  emoji: "♻️", name: "転生3回",        description: "3回転生した" },
  { id: "rebirth_5",  emoji: "♻️", name: "転生5回",        description: "5回転生した" },
  { id: "rebirth_10", emoji: "👑", name: "転生の達人",      description: "10回転生した" },

  // ─── #70-75: コレクション系（6個） ────────────────────
  { id: "collection_3",       emoji: "🎨", name: "コレクター3",     description: "モンスター3種コレクション" },
  { id: "collection_6",       emoji: "🎨", name: "コレクター6",     description: "モンスター6種コレクション" },
  { id: "collection_study",   emoji: "📚", name: "STUDY系制覇",     description: "STUDY系モンスターをコレクションした" },
  { id: "collection_stamina", emoji: "💪", name: "STAMINA系制覇",   description: "STAMINA系モンスターをコレクションした" },
  { id: "collection_life",    emoji: "🏠", name: "LIFE系制覇",      description: "LIFE系モンスターをコレクションした" },
  { id: "collection_all",     emoji: "🌈", name: "全系統制覇",      description: "3系統すべてのモンスターをコレクションした" },

  // ─── #76-82: 自発性・粘り強さ・メンタル系（7個） ──────
  { id: "self_task_5",  emoji: "💡", name: "アイデアマン5",   description: "自分で作ったタスクが5個承認された" },
  { id: "self_task_15", emoji: "💡", name: "アイデアマン15",  description: "自分で作ったタスクが15個承認された" },
  { id: "self_task_30", emoji: "🚀", name: "クリエイター",    description: "自分で作ったタスクが30個承認された" },
  { id: "habit_14",     emoji: "🔁", name: "習慣メーカー",    description: "同じタスクを14日連続完了した" },
  { id: "habit_30",     emoji: "🔁", name: "習慣の鬼",        description: "同じタスクを30日連続完了した" },
  { id: "habit_60",     emoji: "🔁", name: "習慣の達人",      description: "同じタスクを60日連続完了した" },
  { id: "skip_aware",   emoji: "🧠", name: "自己認識上手",    description: "スキップ申請を10回した（自分を知ってる！）" },

  // ─── #83-90: 曜日・季節系（8個） ──────────────────────
  { id: "monday_10",    emoji: "💪", name: "月曜日の勇者",     description: "月曜日にタスクを完了（10回）" },
  { id: "weekend_20",   emoji: "🎉", name: "週末ヒーロー",     description: "土日にタスクを完了（20回）" },
  { id: "spring",       emoji: "🌸", name: "春のスタート",     description: "4月にタスクを15日完了した" },
  { id: "summer",       emoji: "🌻", name: "夏の陣",           description: "7〜8月にタスクを20日完了した" },
  { id: "autumn",       emoji: "🍂", name: "秋の集中",         description: "9〜10月にタスクを20日完了した" },
  { id: "winter",       emoji: "⛄", name: "冬のぼうけん",     description: "12〜1月にタスクを20日完了した" },
  { id: "newyear",      emoji: "🎌", name: "お正月ファイター", description: "1月1〜3日にタスクを完了した" },
  { id: "month_end_10", emoji: "🗓️", name: "月末ファイター",   description: "月の終わりにタスクを完了した（10回）" },

  // ─── #91-100: 複合・終盤チャレンジ系（10個） ──────────
  { id: "milestone_25", emoji: "🌟", name: "実績25個解除",      description: "この実績を除く他の実績を25個解除した" },
  { id: "milestone_50", emoji: "🌟", name: "実績50個解除",      description: "この実績を除く他の実績を50個解除した" },
  { id: "milestone_75", emoji: "👑", name: "実績75個解除",      description: "この実績を除く他の実績を75個解除した" },
  { id: "milestone_90", emoji: "👑", name: "実績90個解除",      description: "この実績を除く他の実績を90個解除した" },
  { id: "multi_tasker", emoji: "🔥", name: "マルチタスカー",    description: "1日に期限ボーナスと写真付きをどちらも達成した" },
  { id: "speed_star",   emoji: "⚡", name: "スピードスター",    description: "1週間で毎日期限ボーナスを獲得した" },
  { id: "triple_crown", emoji: "💪", name: "三冠王",            description: "3pt満点（完了+期限+写真）を25日達成した" },
  { id: "comeback_14",  emoji: "🌈", name: "カムバックキング",  description: "ストリークが途切れた後また14日続けた" },
  { id: "comeback_7x2", emoji: "🌈", name: "カムバックキング2", description: "ストリークが2回以上途切れた後、また7日続けた" },
  { id: "retry_10",     emoji: "💪", name: "折れない心",        description: "差し戻し後の再報告を10回成功させた" },

  // ─── 宝箱系（3個） ───────────────────────────────────
  { id: "treasure_first", emoji: "🎁", name: "はじめての宝箱",     description: "はじめて宝箱を開けた" },
  { id: "treasure_25",    emoji: "🗝️", name: "宝箱コレクター",     description: "累計25個の宝箱を開けた" },
  { id: "treasure_rare",  emoji: "💎", name: "レア当選！",         description: "レア（RARE）のごほうびを引き当てた" },

  // ─── コレクションアイテム系（4個） ────────────────────
  { id: "item_first",      emoji: "🌱", name: "はじめてのコレクション", description: "はじめて季節アイテムを獲得した" },
  { id: "item_30",         emoji: "📦", name: "アイテム30種",         description: "季節アイテムを30種類獲得した" },
  { id: "season_complete", emoji: "🍀", name: "シーズン制覇",         description: "1シーズン（20種）すべてのアイテムを集めた" },
  { id: "item_80_all",     emoji: "🌌", name: "全アイテム制覇",       description: "全80種の季節アイテムを集めた" },

  // ─── 転生卵系（1個） ─────────────────────────────────
  { id: "rebirth_egg_used", emoji: "🥚", name: "卵えらびマスター",   description: "転生卵ボーナスを使った" },
];

// ─── バッジ条件チェック（純粋関数） ──────────────────────────────────────

const BADGE_CONDITIONS: Record<string, (ctx: BadgeContext) => boolean> = {
  // #1-3: ようこそ系
  "first_quest":         c => c.approvedCount >= 1,
  "first_hatch":         c => c.evolutionStage >= 1 || c.rebirthCount >= 1,
  "first_self_approved": c => c.selfTaskApprovedCount >= 1,

  // #4-12: 累計クエスト系
  "quest_10":   c => c.approvedCount >= 10,
  "quest_25":   c => c.approvedCount >= 25,
  "quest_50":   c => c.approvedCount >= 50,
  "quest_100":  c => c.approvedCount >= 100,
  "quest_200":  c => c.approvedCount >= 200,
  "quest_300":  c => c.approvedCount >= 300,
  "quest_500":  c => c.approvedCount >= 500,
  "quest_1000": c => c.approvedCount >= 1000,

  // タスクストリーク系
  "streak_5":        c => c.bestTaskStreak >= 5,
  "streak_10":       c => c.bestTaskStreak >= 10,
  "streak_14":       c => c.bestTaskStreak >= 14,
  "streak_21":       c => c.bestTaskStreak >= 21,
  "streak_30":       c => c.bestTaskStreak >= 30,
  "streak_100":      c => c.bestTaskStreak >= 100,
  "streak_comeback": c => c.hasComeback7,

  // ログインストリーク系
  "login_7":   c => c.loginBestStreak >= 7,
  "login_14":  c => c.loginBestStreak >= 14,
  "login_30":  c => c.loginBestStreak >= 30,
  "login_100": c => c.loginBestStreak >= 100,

  // #27-31: XP系
  "xp_50":   c => c.totalXp >= 50,
  "xp_100":  c => c.totalXp >= 100,
  "xp_300":  c => c.totalXp >= 300,
  "xp_500":  c => c.totalXp >= 500,
  "xp_1000": c => c.totalXp >= 1000,

  // 写真系
  "photo_15":  c => c.photoCount >= 15,
  "photo_30":  c => c.photoCount >= 30,
  "photo_100": c => c.photoCount >= 100,
  "photo_200": c => c.photoCount >= 200,

  // 期限ボーナス系
  "deadline_10":  c => c.deadlineBonusCount >= 10,
  "deadline_50":  c => c.deadlineBonusCount >= 50,
  "deadline_100": c => c.deadlineBonusCount >= 100,
  "deadline_200": c => c.deadlineBonusCount >= 200,

  // 時間帯・速報系
  "morning_10":   c => c.morningReportCount >= 10,
  "morning_30":   c => c.morningReportCount >= 30,
  "afternoon_15": c => c.afternoonReportCount >= 15,
  "quick_10":     c => c.quickReportCount >= 10,
  "quick_30":     c => c.quickReportCount >= 30,

  // #49-54: 1日の達成系
  "perfect_5":   c => c.perfectDaysCount >= 5,
  "perfect_15":  c => c.perfectDaysCount >= 15,
  "perfect_30":  c => c.perfectDaysCount >= 30,
  "perfect_50":  c => c.perfectDaysCount >= 50,
  "day_4quests": c => c.maxQuestsPerDay >= 4,
  "day_6quests": c => c.maxQuestsPerDay >= 6,

  // #55-59: 週の達成系
  "week_5":    c => c.weeksWithFivePlusDays >= 1,
  "week_5x3":  c => c.weeksWithFivePlusDays >= 3,
  "week_5x10": c => c.weeksWithFivePlusDays >= 10,
  "week_7":    c => c.weeksWithSevenDays >= 1,
  "week_7x5":  c => c.weeksWithSevenDays >= 5,

  // #60-64: 月の達成系
  "month_15":         c => c.monthsWithFifteenPlusDays >= 1,
  "month_20":         c => c.monthsWithTwentyPlusDays >= 1,
  "month_perfect":    c => c.perfectMonthsCount >= 1,
  "month_perfect_x3": c => c.perfectMonthsCount >= 3,
  "month_15x6":       c => c.monthsWithFifteenPlusDays >= 6,

  // #65-69: 転生系
  "rebirth_1":  c => c.rebirthCount >= 1,
  "rebirth_2":  c => c.rebirthCount >= 2,
  "rebirth_3":  c => c.rebirthCount >= 3,
  "rebirth_5":  c => c.rebirthCount >= 5,
  "rebirth_10": c => c.rebirthCount >= 10,

  // #70-75: コレクション系
  "collection_3":       c => c.collectionCount >= 3,
  "collection_6":       c => c.collectionCount >= 6,
  "collection_study":   c => c.hasStudyCollection,
  "collection_stamina": c => c.hasStaminaCollection,
  "collection_life":    c => c.hasLifeCollection,
  "collection_all":     c => c.hasAllTypesCollection,

  // #76-82: 自発性・粘り強さ・メンタル系
  "self_task_5":  c => c.selfTaskApprovedCount >= 5,
  "self_task_15": c => c.selfTaskApprovedCount >= 15,
  "self_task_30": c => c.selfTaskApprovedCount >= 30,
  "habit_14":     c => c.maxSingleTaskBestStreak >= 14,
  "habit_30":     c => c.maxSingleTaskBestStreak >= 30,
  "habit_60":     c => c.maxSingleTaskBestStreak >= 60,
  "skip_aware":   c => c.skipCount >= 10,

  // #83-90: 曜日・季節系
  "monday_10":    c => c.mondayCount >= 10,
  "weekend_20":   c => c.weekendCount >= 20,
  "spring":       c => c.springDays >= 15,
  "summer":       c => c.summerDays >= 20,
  "autumn":       c => c.autumnDays >= 20,
  "winter":       c => c.winterDays >= 20,
  "newyear":      c => c.hasNewYearQuest,
  "month_end_10": c => c.monthEndCount >= 10,

  // #91-100: 複合・終盤チャレンジ系
  "milestone_25": c => c.unlockedBadgeCount >= 25,
  "milestone_50": c => c.unlockedBadgeCount >= 50,
  "milestone_75": c => c.unlockedBadgeCount >= 75,
  "milestone_90": c => c.unlockedBadgeCount >= 90,
  "multi_tasker": c => c.hasMagicDay,
  "speed_star":   c => c.hasWeekWithDailyDeadline,
  "triple_crown": c => c.tripleCrownDaysCount >= 25,
  "comeback_14":  c => c.hasComeback14,
  "comeback_7x2": c => c.hasComeback7After2Breaks,
  "retry_10":     c => c.retrySuccessCount >= 10,

  // 宝箱系
  "treasure_first": c => c.treasureOpenedCount >= 1,
  "treasure_25":    c => c.treasureOpenedCount >= 25,
  "treasure_rare":  c => c.rareTreasureCount >= 1,

  // コレクションアイテム系
  "item_first":      c => c.collectionItemCount >= 1,
  "item_30":         c => c.collectionItemCount >= 30,
  "season_complete": c => c.collectionSeasonsComplete >= 1,
  "item_80_all":     c => c.hasAllCollectionItems,

  // 転生卵系
  "rebirth_egg_used": c => c.rebirthEggUsed,
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

// ─── 進捗ヒント（純粋関数） ───────────────────────────────────────────────
//
// 数値系バッジは { current, target } を返し、UI で「あと N で解錠」表示に使う。
// ブール系（OR条件・hasXxx 系）は target が意味を持たないので null を返す。

export type BadgeProgress = { current: number; target: number };

const BADGE_PROGRESS_MAP: Record<string, (ctx: BadgeContext) => BadgeProgress> = {
  // ようこそ系（first_hatch は OR 条件のため除外）
  "first_quest":         c => ({ current: c.approvedCount, target: 1 }),
  "first_self_approved": c => ({ current: c.selfTaskApprovedCount, target: 1 }),

  // 累計クエスト系
  "quest_10":   c => ({ current: c.approvedCount, target: 10 }),
  "quest_25":   c => ({ current: c.approvedCount, target: 25 }),
  "quest_50":   c => ({ current: c.approvedCount, target: 50 }),
  "quest_100":  c => ({ current: c.approvedCount, target: 100 }),
  "quest_200":  c => ({ current: c.approvedCount, target: 200 }),
  "quest_300":  c => ({ current: c.approvedCount, target: 300 }),
  "quest_500":  c => ({ current: c.approvedCount, target: 500 }),
  "quest_1000": c => ({ current: c.approvedCount, target: 1000 }),

  // タスクストリーク系（streak_comeback は hasComeback7 のため除外）
  "streak_5":   c => ({ current: c.bestTaskStreak, target: 5 }),
  "streak_10":  c => ({ current: c.bestTaskStreak, target: 10 }),
  "streak_14":  c => ({ current: c.bestTaskStreak, target: 14 }),
  "streak_21":  c => ({ current: c.bestTaskStreak, target: 21 }),
  "streak_30":  c => ({ current: c.bestTaskStreak, target: 30 }),
  "streak_100": c => ({ current: c.bestTaskStreak, target: 100 }),

  // ログインストリーク系
  "login_7":   c => ({ current: c.loginBestStreak, target: 7 }),
  "login_14":  c => ({ current: c.loginBestStreak, target: 14 }),
  "login_30":  c => ({ current: c.loginBestStreak, target: 30 }),
  "login_100": c => ({ current: c.loginBestStreak, target: 100 }),

  // XP系
  "xp_50":   c => ({ current: c.totalXp, target: 50 }),
  "xp_100":  c => ({ current: c.totalXp, target: 100 }),
  "xp_300":  c => ({ current: c.totalXp, target: 300 }),
  "xp_500":  c => ({ current: c.totalXp, target: 500 }),
  "xp_1000": c => ({ current: c.totalXp, target: 1000 }),

  // 写真系
  "photo_15":  c => ({ current: c.photoCount, target: 15 }),
  "photo_30":  c => ({ current: c.photoCount, target: 30 }),
  "photo_100": c => ({ current: c.photoCount, target: 100 }),
  "photo_200": c => ({ current: c.photoCount, target: 200 }),

  // 期限ボーナス系
  "deadline_10":  c => ({ current: c.deadlineBonusCount, target: 10 }),
  "deadline_50":  c => ({ current: c.deadlineBonusCount, target: 50 }),
  "deadline_100": c => ({ current: c.deadlineBonusCount, target: 100 }),
  "deadline_200": c => ({ current: c.deadlineBonusCount, target: 200 }),

  // 時間帯・速報系
  "morning_10":   c => ({ current: c.morningReportCount, target: 10 }),
  "morning_30":   c => ({ current: c.morningReportCount, target: 30 }),
  "afternoon_15": c => ({ current: c.afternoonReportCount, target: 15 }),
  "quick_10":     c => ({ current: c.quickReportCount, target: 10 }),
  "quick_30":     c => ({ current: c.quickReportCount, target: 30 }),

  // 1日の達成系
  "perfect_5":   c => ({ current: c.perfectDaysCount, target: 5 }),
  "perfect_15":  c => ({ current: c.perfectDaysCount, target: 15 }),
  "perfect_30":  c => ({ current: c.perfectDaysCount, target: 30 }),
  "perfect_50":  c => ({ current: c.perfectDaysCount, target: 50 }),
  "day_4quests": c => ({ current: c.maxQuestsPerDay, target: 4 }),
  "day_6quests": c => ({ current: c.maxQuestsPerDay, target: 6 }),

  // 週の達成系
  "week_5":    c => ({ current: c.weeksWithFivePlusDays, target: 1 }),
  "week_5x3":  c => ({ current: c.weeksWithFivePlusDays, target: 3 }),
  "week_5x10": c => ({ current: c.weeksWithFivePlusDays, target: 10 }),
  "week_7":    c => ({ current: c.weeksWithSevenDays, target: 1 }),
  "week_7x5":  c => ({ current: c.weeksWithSevenDays, target: 5 }),

  // 月の達成系
  "month_15":         c => ({ current: c.monthsWithFifteenPlusDays, target: 1 }),
  "month_20":         c => ({ current: c.monthsWithTwentyPlusDays, target: 1 }),
  "month_perfect":    c => ({ current: c.perfectMonthsCount, target: 1 }),
  "month_perfect_x3": c => ({ current: c.perfectMonthsCount, target: 3 }),
  "month_15x6":       c => ({ current: c.monthsWithFifteenPlusDays, target: 6 }),

  // 転生系
  "rebirth_1":  c => ({ current: c.rebirthCount, target: 1 }),
  "rebirth_2":  c => ({ current: c.rebirthCount, target: 2 }),
  "rebirth_3":  c => ({ current: c.rebirthCount, target: 3 }),
  "rebirth_5":  c => ({ current: c.rebirthCount, target: 5 }),
  "rebirth_10": c => ({ current: c.rebirthCount, target: 10 }),

  // コレクション系（collection_study/stamina/life/all はブール、除外）
  "collection_3": c => ({ current: c.collectionCount, target: 3 }),
  "collection_6": c => ({ current: c.collectionCount, target: 6 }),

  // 自発性・粘り強さ系
  "self_task_5":  c => ({ current: c.selfTaskApprovedCount, target: 5 }),
  "self_task_15": c => ({ current: c.selfTaskApprovedCount, target: 15 }),
  "self_task_30": c => ({ current: c.selfTaskApprovedCount, target: 30 }),
  "habit_14":     c => ({ current: c.maxSingleTaskBestStreak, target: 14 }),
  "habit_30":     c => ({ current: c.maxSingleTaskBestStreak, target: 30 }),
  "habit_60":     c => ({ current: c.maxSingleTaskBestStreak, target: 60 }),
  "skip_aware":   c => ({ current: c.skipCount, target: 10 }),

  // 曜日・季節系（newyear はブール、除外）
  "monday_10":    c => ({ current: c.mondayCount, target: 10 }),
  "weekend_20":   c => ({ current: c.weekendCount, target: 20 }),
  "spring":       c => ({ current: c.springDays, target: 15 }),
  "summer":       c => ({ current: c.summerDays, target: 20 }),
  "autumn":       c => ({ current: c.autumnDays, target: 20 }),
  "winter":       c => ({ current: c.winterDays, target: 20 }),
  "month_end_10": c => ({ current: c.monthEndCount, target: 10 }),

  // 複合・終盤系（multi_tasker/speed_star/comeback_* はブール、除外）
  "milestone_25": c => ({ current: c.unlockedBadgeCount, target: 25 }),
  "milestone_50": c => ({ current: c.unlockedBadgeCount, target: 50 }),
  "milestone_75": c => ({ current: c.unlockedBadgeCount, target: 75 }),
  "milestone_90": c => ({ current: c.unlockedBadgeCount, target: 90 }),
  "triple_crown": c => ({ current: c.tripleCrownDaysCount, target: 25 }),
  "retry_10":     c => ({ current: c.retrySuccessCount, target: 10 }),

  // 宝箱系
  "treasure_first": c => ({ current: c.treasureOpenedCount, target: 1 }),
  "treasure_25":    c => ({ current: c.treasureOpenedCount, target: 25 }),
  "treasure_rare":  c => ({ current: c.rareTreasureCount, target: 1 }),

  // コレクションアイテム系（item_80_all はブール、除外）
  "item_first":      c => ({ current: c.collectionItemCount, target: 1 }),
  "item_30":         c => ({ current: c.collectionItemCount, target: 30 }),
  "season_complete": c => ({ current: c.collectionSeasonsComplete, target: 1 }),
};

/**
 * バッジ ID と現在のコンテキストから進捗を返す（純粋関数）。
 * 数値系バッジは { current, target }、ブール系・未定義IDは null。
 */
export function getBadgeProgress(badgeId: string, ctx: BadgeContext): BadgeProgress | null {
  const fn = BADGE_PROGRESS_MAP[badgeId];
  return fn ? fn(ctx) : null;
}
