"use client";

import { CATEGORY_LABEL } from "@/lib/categories";
import type { Category } from "@/types";

const CATEGORY_COLORS: Record<string, { r: number; g: number; b: number }> = {
  STUDY:   { r: 96,  g: 165, b: 250 },
  STAMINA: { r: 248, g: 113, b: 113 },
  LIFE:    { r: 74,  g: 222, b: 128 },
};

export default function PathChips({ path, size = "md" }: { path: string; size?: "sm" | "md" }) {
  const parts = path.split("_");
  const chipPx = size === "sm" ? 15 : 18;
  const chipFontPx = size === "sm" ? 9 : 11;
  const arrowFontPx = size === "sm" ? 7 : 9;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "nowrap", overflow: "hidden" }}>
      {parts.map((part, i) => {
        const color = CATEGORY_COLORS[part] ?? { r: 154, g: 140, b: 110 };
        return (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 1 }}>
            {i > 0 && (
              <span style={{ fontSize: arrowFontPx, color: "rgba(154,140,110,0.75)", lineHeight: 1 }}>
                →
              </span>
            )}
            <span
              style={{
                width: chipPx,
                height: chipPx,
                fontSize: chipFontPx,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: size === "sm" ? 4 : 5,
                flexShrink: 0,
                background: `rgba(${color.r},${color.g},${color.b},0.22)`,
                boxShadow: `0 0 0 1px rgba(${color.r},${color.g},${color.b},0.3)`,
              }}
            >
              {CATEGORY_LABEL[part as Category]?.emoji ?? "❓"}
            </span>
          </span>
        );
      })}
    </div>
  );
}
