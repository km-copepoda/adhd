// 子画面のスキップ理由テンプレート。
// 幼児でも文字を入力せずタップだけでスキップ申請できるようにするための定型文。
// label はそのまま `skip API` の `comment` として送信される。

export type SkipReasonTemplate = {
  id: string;
  emoji: string;
  label: string;
};

export const SKIP_REASON_TEMPLATES: readonly SkipReasonTemplate[] = [
  { id: "no_time", emoji: "⏰", label: "時間がなかった" },
  { id: "not_done", emoji: "🙅", label: "今日はできなかった" },
  { id: "tired", emoji: "😴", label: "つかれた" },
  { id: "forgot", emoji: "😅", label: "わすれちゃった" },
  { id: "sick", emoji: "🤒", label: "たいちょうがわるい" },
];
