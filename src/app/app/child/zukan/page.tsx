"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MONSTER_TABLE, MONSTER_TABLE_LIGHT, EGG_STAGE, EGG_STAGE_LIGHT, getEvolutionChildren } from "@/lib/monsters";
import { CATEGORY_LABEL } from "@/lib/categories";
import type { Category } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import MonsterImageModal from "@/components/MonsterImageModal";
import { getZukanStageLabel } from "@/lib/zukanStageLabel";

type ZukanData = {
  side: string | null;
  collectedPaths: string;
  monsterLevels: string;
};

function shadowPath(imagePath: string): string {
  return imagePath.replace("/monsters/", "/monsters/shadow/");
}

const CATEGORY_COLORS: Record<string, { r: number; g: number; b: number }> = {
  STUDY:   { r: 96,  g: 165, b: 250 },
  STAMINA: { r: 248, g: 113, b: 113 },
  LIFE:    { r: 74,  g: 222, b: 128 },
};

function PathChips({ path, size = "md" }: { path: string; size?: "sm" | "md" }) {
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

type SelectedMonster = { image: string; name: string; stageLabel: string };

export default function ZukanPage() {
  const [data, setData] = useState<ZukanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedMonster | null>(null);

  useEffect(() => {
    fetch("/api/monster")
      .then((r) => r.json())
      .then((d: ZukanData) => {
        const paths = d.collectedPaths ?? "[]";
        setData({ side: d.side ?? null, collectedPaths: paths, monsterLevels: d.monsterLevels ?? "{}" });
        // 図鑑を開いた時点で「見た」とマーク → BottomNav バッジをクリア
        const count = (JSON.parse(paths) as string[]).length;
        localStorage.setItem("lastSeenCollectedCount", String(count));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <LoadingSpinner />;

  const collected = new Set<string>(JSON.parse(data.collectedPaths) as string[]);

  const openModal = (image: string, name: string, path: string) =>
    setSelected({ image, name, stageLabel: getZukanStageLabel(path) });
  const monsterLevels = JSON.parse(data.monsterLevels) as Record<string, number>;
  const monsterTable = data.side === "LIGHT" ? MONSTER_TABLE_LIGHT : MONSTER_TABLE;
  const eggData = data.side === "LIGHT" ? EGG_STAGE_LIGHT : EGG_STAGE;
  const total = collected.size;
  const max = Object.keys(MONSTER_TABLE).length;

  const stage1Keys = getEvolutionChildren("");

  return (
    <div className="px-4 pt-6 pb-24">
      {/* ── ヘッダー ── */}
      <h1 className="font-serif text-quest-gold text-xl tracking-widest mb-1 text-center">
        📖 モンスター図鑑
      </h1>
      <p className="text-quest-dim text-xs text-center mb-4">
        {total} / {max} 体
      </p>

      {/* ── 卵 ── */}
      <div className="flex flex-col items-center mb-4">
        <div className="flex gap-2 justify-center flex-wrap">
          <div className="bg-quest-card border border-quest-border rounded-xl p-3 flex flex-col items-center gap-1 w-28">
            <Image
              src={eggData.image}
              alt="たまご"
              width={56}
              height={56}
              className="object-contain"
            />
            <p className="text-xs text-quest-text">🥚 たまご</p>
          </div>
          {[
            { img: "/monsters/egg-study.webp", label: "📚 勉強の卵", color: "rgba(96,165,250,0.3)" },
            { img: "/monsters/egg-stamina.webp", label: "💪 体力の卵", color: "rgba(248,113,113,0.3)" },
            { img: "/monsters/egg-life.webp", label: "🌿 生活力の卵", color: "rgba(74,222,128,0.3)" },
          ].map((egg) => (
            <div key={egg.label} className="bg-quest-card border border-quest-border rounded-xl p-3 flex flex-col items-center gap-1 w-28" style={{ borderColor: egg.color }}>
              <Image
                src={egg.img}
                alt={egg.label}
                width={56}
                height={56}
                className="object-contain"
              />
              <p className="text-[10px] text-quest-text text-center">{egg.label}</p>
            </div>
          ))}
        </div>
        <div className="text-quest-dim/50 text-[11px] mt-2">▾ 孵化</div>
      </div>

      {/* ── 3系統ブランチ ── */}
      {stage1Keys.map((s1) => {
        const s1Color = CATEGORY_COLORS[s1] ?? { r: 154, g: 140, b: 110 };
        const s1Cat = CATEGORY_LABEL[s1 as Category];
        const s2Keys = getEvolutionChildren(s1);
        const m1 = monsterTable[s1];
        const isS1Collected = collected.has(s1);

        const branchPaths = [s1, ...s2Keys, ...s2Keys.flatMap((s2) => getEvolutionChildren(s2))];
        const branchCollected = branchPaths.filter((p) => collected.has(p)).length;

        return (
          <div
            key={s1}
            className="mb-5 rounded-2xl overflow-hidden"
            style={{ border: `1px solid rgba(${s1Color.r},${s1Color.g},${s1Color.b},0.2)` }}
          >
            {/* Branch header */}
            <div
              className="flex items-center justify-between px-3 py-2 text-xs font-bold tracking-widest"
              style={{
                background: `rgba(${s1Color.r},${s1Color.g},${s1Color.b},0.12)`,
                color: `rgba(${s1Color.r},${s1Color.g},${s1Color.b},1)`,
                borderBottom: `1px solid rgba(${s1Color.r},${s1Color.g},${s1Color.b},0.2)`,
              }}
            >
              <span>{s1Cat?.emoji} {s1Cat?.name}系</span>
              <span className="font-normal opacity-70 text-[10px]">
                {branchCollected} / {branchPaths.length} 体
              </span>
            </div>

            {/* S1 feature card */}
            <div
              className="flex items-center gap-3 px-3 py-3"
              style={{ background: "#1a1829", borderBottom: "1px solid #1e1c2e" }}
            >
              <div
                className={`flex flex-col items-center gap-1 flex-shrink-0${isS1Collected ? " cursor-pointer active:opacity-80" : ""}`}
                onClick={isS1Collected ? () => openModal(m1.image, m1.name, s1) : undefined}
              >
                <Image
                  src={isS1Collected ? m1.image : shadowPath(m1.image)}
                  alt={m1.name}
                  width={88}
                  height={88}
                  className="object-contain"
                  style={{
                    filter: isS1Collected
                      ? `drop-shadow(0 0 14px rgba(${s1Color.r},${s1Color.g},${s1Color.b},0.5))`
                      : "none",
                  }}
                />
                <p className="text-[11px] text-center" style={{ color: "#c9bfa0" }}>
                  {isS1Collected ? m1.name : "？？？"}
                </p>
              </div>
              <div className="flex flex-col gap-1 flex-1 justify-center">
                {s2Keys.map((s2) => (
                  <PathChips key={s2} path={s2} />
                ))}
              </div>
            </div>

            {/* S2 + S3 rows */}
            <div style={{ background: "#14131f" }}>
              {s2Keys.map((s2, rowIdx) => {
                const m2 = monsterTable[s2];
                const isS2Collected = collected.has(s2);
                const s3Keys = getEvolutionChildren(s2);

                return (
                  <div
                    key={s2}
                    className="flex items-start gap-2 px-2 py-2"
                    style={{
                      borderBottom:
                        rowIdx < s2Keys.length - 1 ? "1px solid rgba(30,28,46,0.8)" : "none",
                    }}
                  >
                    {/* S2 card */}
                    <div
                      className={`flex flex-col items-center gap-1 flex-shrink-0 rounded-xl p-1${isS2Collected ? " cursor-pointer active:opacity-80" : ""}`}
                      style={{
                        width: 76,
                        background: "#1a1829",
                        border: `1px solid ${isS2Collected ? "rgba(251,191,36,0.28)" : "#2e2a42"}`,
                      }}
                      onClick={isS2Collected ? () => openModal(m2.image, m2.name, s2) : undefined}
                    >
                      <PathChips path={s2} />
                      <Image
                        src={isS2Collected ? m2.image : shadowPath(m2.image)}
                        alt={m2.name}
                        width={50}
                        height={50}
                        className="object-contain"
                      />
                      <p className="text-[9px] text-center leading-tight" style={{ color: "#c9bfa0" }}>
                        {isS2Collected ? m2.name : "？？？"}
                      </p>
                    </div>

                    {/* Arrow */}
                    <div className="text-quest-dim/50 text-xs mt-6 flex-shrink-0">›</div>

                    {/* S3 grid */}
                    <div className="flex-1 grid grid-cols-3 gap-1">
                      {s3Keys.map((s3) => {
                        const m3 = monsterTable[s3];
                        const isS3Collected = collected.has(s3);
                        // Lv: monsterLevels に記録があればその値、収集済みだが記録なし（旧データ）は 1
                        const lv = monsterLevels[s3] ?? (isS3Collected ? 1 : 0);
                        return (
                          <div
                            key={s3}
                            className={`flex flex-col items-center gap-1 rounded-lg p-1${isS3Collected ? " cursor-pointer active:opacity-80" : ""}`}
                            style={{
                              background: "linear-gradient(160deg, #1e1a2e, #1a1829)",
                              border: `1px solid ${isS3Collected ? "rgba(139,92,246,0.35)" : "#3d3450"}`,
                            }}
                            onClick={isS3Collected ? () => openModal(m3.image, m3.name, s3) : undefined}
                          >
                            <PathChips path={s3} size="sm" />
                            <Image
                              src={isS3Collected ? m3.image : shadowPath(m3.image)}
                              alt={m3.name}
                              width={40}
                              height={40}
                              className="w-full aspect-square object-contain"
                            />
                            <p className="text-[8px] text-center leading-tight" style={{ color: "#c9bfa0" }}>
                              {isS3Collected ? m3.name : "？？？"}
                            </p>
                            {isS3Collected && (
                              <span
                                style={{
                                  fontSize: 8,
                                  fontWeight: "bold",
                                  color: lv >= 5 ? "#fbbf24"
                                       : lv === 4 ? "#fb923c"
                                       : lv === 3 ? "#60a5fa"
                                       : lv === 2 ? "#a78bfa"
                                       : "#9ca3af",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                Lv {lv}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {selected && (
        <MonsterImageModal
          image={selected.image}
          monsterName={selected.name}
          stageLabel={selected.stageLabel}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
