import type { Category } from "@/types";

// 承認スタンプ（親が承認時に子供へ送るスタンプ）
export const APPROVAL_STAMPS = [
  { emoji: "⭐", label: "よくできた" },
  { emoji: "🎉", label: "すごい" },
  { emoji: "👏", label: "えらい" },
  { emoji: "💪", label: "がんばった" },
  { emoji: "🌟", label: "さすが" },
  { emoji: "❤️", label: "うれしい" },
  { emoji: "🏆", label: "完璧" },
  { emoji: "🎯", label: "ぴったり" },
] as const;

// Category labels
export const CATEGORY_LABEL: Record<Category, { emoji: string; name: string }> = {
  STUDY: { emoji: "📚", name: "学力" },
  STAMINA: { emoji: "💪", name: "体力" },
  LIFE: { emoji: "🌿", name: "生活力" },
};

// Category colors (Tailwind classes)
export const CATEGORY_COLOR: Record<Category, string> = {
  STUDY: "#60a5fa",
  STAMINA: "#f87171",
  LIFE: "#4ade80",
};

// ─── タスクテンプレート ──────────────────────
export type TaskPreset = { title: string; category: Category };

export type AgeGroup = "preschool" | "elementary_low" | "elementary_high" | "middle";

export const AGE_GROUPS: AgeGroup[] = [
  "preschool",
  "elementary_low",
  "elementary_high",
  "middle",
];

export const AGE_GROUP_LABEL: Record<AgeGroup, string> = {
  preschool: "園児",
  elementary_low: "小学低・中学年",
  elementary_high: "小学高学年",
  middle: "中学生",
};

export const TASK_TEMPLATES_BY_AGE: Record<AgeGroup, TaskPreset[]> = {
  preschool: [
    { title: "おもちゃを片付ける", category: "LIFE" },
    { title: "着替えをする", category: "LIFE" },
    { title: "手を洗う", category: "LIFE" },
    { title: "歯磨きをする", category: "LIFE" },
    { title: "あいさつをする", category: "LIFE" },
    { title: "絵本を読む", category: "STUDY" },
    { title: "ひらがなを書く", category: "STUDY" },
    { title: "数を数える", category: "STUDY" },
    { title: "外で遊ぶ", category: "STAMINA" },
    { title: "体操をする", category: "STAMINA" },
    { title: "公園に行く", category: "STAMINA" },
  ],
  elementary_low: [
    { title: "宿題をやる", category: "STUDY" },
    { title: "音読をする", category: "STUDY" },
    { title: "ドリルをやる", category: "STUDY" },
    { title: "本を読む", category: "STUDY" },
    { title: "漢字の練習をする", category: "STUDY" },
    { title: "外で遊ぶ", category: "STAMINA" },
    { title: "縄跳びをする", category: "STAMINA" },
    { title: "体操をする", category: "STAMINA" },
    { title: "散歩に行く", category: "STAMINA" },
    { title: "部屋を片付ける", category: "LIFE" },
    { title: "お手伝いをする", category: "LIFE" },
    { title: "歯磨きをする", category: "LIFE" },
    { title: "早く寝る", category: "LIFE" },
  ],
  elementary_high: [
    { title: "宿題をやる", category: "STUDY" },
    { title: "漢字の練習をする", category: "STUDY" },
    { title: "計算ドリルをやる", category: "STUDY" },
    { title: "読書をする", category: "STUDY" },
    { title: "自主学習をする", category: "STUDY" },
    { title: "英語の勉強をする", category: "STUDY" },
    { title: "運動する", category: "STAMINA" },
    { title: "部活の自主練をする", category: "STAMINA" },
    { title: "ストレッチをする", category: "STAMINA" },
    { title: "縄跳びをする", category: "STAMINA" },
    { title: "部屋を片付ける", category: "LIFE" },
    { title: "食器を洗う", category: "LIFE" },
    { title: "お風呂に入る", category: "LIFE" },
    { title: "早寝早起きをする", category: "LIFE" },
  ],
  middle: [
    { title: "宿題をやる", category: "STUDY" },
    { title: "テスト勉強をする", category: "STUDY" },
    { title: "読書をする", category: "STUDY" },
    { title: "英単語を覚える", category: "STUDY" },
    { title: "予習・復習をする", category: "STUDY" },
    { title: "部活をする", category: "STAMINA" },
    { title: "運動する", category: "STAMINA" },
    { title: "ストレッチをする", category: "STAMINA" },
    { title: "筋トレをする", category: "STAMINA" },
    { title: "部屋を整理する", category: "LIFE" },
    { title: "自分の洗濯をする", category: "LIFE" },
    { title: "朝食を自分で作る", category: "LIFE" },
    { title: "早起きする", category: "LIFE" },
  ],
};

/** @deprecated TASK_TEMPLATES_BY_AGE を使うこと */
export const TEMP_TASK_TEMPLATES: TaskPreset[] = TASK_TEMPLATES_BY_AGE.elementary_low;

// Day of week labels (Japanese)
export const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

// Rejection reason presets by category
export const REJECTION_REASONS: Record<Category, string[]> = {
  STUDY: [
    "宿題のページが違うよ",
    "まだ全部終わってないみたい",
    "字が読めないよ、書き直してね",
    "写真が暗くてよく見えないよ",
    "その他",
  ],
  STAMINA: [
    "時間が短すぎるよ、もう少しやってみよう",
    "まだ全部終わってないみたい",
    "写真や動画をつけてね",
    "別のことをやってたみたい",
    "その他",
  ],
  LIFE: [
    "まだ全部終わってないみたい",
    "きれいになってないところがあるよ",
    "写真が暗くてよく見えないよ",
    "もう少し丁寧にやってみよう",
    "その他",
  ],
};

// Generate 6-char family code
export function generateFamilyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Generate 4-digit child code (ユーザーコード)
export function generateChildCode(): string {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}
