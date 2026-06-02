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

export const HEAT_CLASS: Record<HeatLevel, string> = {
  none: "bg-quest-card border border-quest-border text-quest-dim/50",
  lv1: "bg-teal-500/10 border border-teal-500/20 text-teal-400/60",
  lv2: "bg-teal-500/20 border border-teal-500/30 text-teal-300",
  lv3: "bg-teal-500/35 border border-teal-500/45 text-teal-200",
  lv4: "bg-teal-500/50 border border-teal-500/60 text-white",
  lv5: "bg-quest-gold/40 border border-quest-gold/60 text-white",
  lv6: "bg-quest-gold/65 border border-quest-gold text-white font-semibold",
  skip: "bg-orange-500/20 border border-orange-500/30 text-orange-400",
};
