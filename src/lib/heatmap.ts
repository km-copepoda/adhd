export type DaySummary = { approved: number; skipped: number; total: number };

export type HeatLevel = "none" | "lv1" | "lv2" | "lv3" | "lv4" | "lv5" | "lv6" | "skip";

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getHeatLevel(day: DaySummary | undefined): HeatLevel {
  if (!day || day.total === 0) return "none";
  if (day.approved === 0) return "skip";
  const pct = (day.approved / day.total) * 100;
  if (pct >= 100) return "lv6";
  if (pct >= 80) return "lv5";
  if (pct >= 60) return "lv4";
  if (pct >= 40) return "lv3";
  if (pct >= 20) return "lv2";
  return "lv1";
}

// GitHub 貢献グラフ (ダークテーマ) 準拠の緑グラデーション。
// level1 #0e4429 → level2 #006d32 → level3 #26a641 → level4 #39d353。
// 6段階に拡張するため、level3〜4 の間に #2ea043、level4 の上に #56d364 を追加。
export const HEAT_CLASS: Record<HeatLevel, string> = {
  none: "bg-quest-card border border-quest-border text-quest-dim/50",
  lv1: "bg-[#0e4429] border border-[#0e4429] text-green-100/70",
  lv2: "bg-[#006d32] border border-[#006d32] text-green-50",
  lv3: "bg-[#26a641] border border-[#26a641] text-white",
  lv4: "bg-[#2ea043] border border-[#2ea043] text-white",
  lv5: "bg-[#39d353] border border-[#39d353] text-[#0d1117]",
  lv6: "bg-[#56d364] border border-[#56d364] text-[#0d1117] font-semibold",
  skip: "bg-orange-500/20 border border-orange-500/30 text-orange-400",
};
