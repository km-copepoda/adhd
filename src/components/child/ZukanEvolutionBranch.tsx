"use client";

import Image from "next/image";
import { getEvolutionChildren } from "@/lib/monsters";
import { CATEGORY_LABEL } from "@/lib/categories";
import type { Category } from "@/types";
import { getS3Aura } from "@/lib/s3Aura";
import { getMonsterLevel } from "@/lib/monsterThemes/monsterLevels";
import PathChips from "./PathChips";

function shadowPath(imagePath: string): string {
  return imagePath.replace("/monsters/", "/monsters/shadow/");
}

const CATEGORY_COLORS: Record<string, { r: number; g: number; b: number }> = {
  STUDY:   { r: 96,  g: 165, b: 250 },
  STAMINA: { r: 248, g: 113, b: 113 },
  LIFE:    { r: 74,  g: 222, b: 128 },
};

type MonsterEntry = { image: string; name: string };

interface ZukanEvolutionBranchProps {
  s1: string;
  collected: Set<string>;
  monsterLevels: Record<string, number>;
  monsterTable: Record<string, MonsterEntry>;
  themeId: string;
  openModal: (image: string, name: string, path: string) => void;
}

export default function ZukanEvolutionBranch({
  s1,
  collected,
  monsterLevels,
  monsterTable,
  themeId,
  openModal,
}: ZukanEvolutionBranchProps) {
  const s1Color = CATEGORY_COLORS[s1] ?? { r: 154, g: 140, b: 110 };
  const s1Cat = CATEGORY_LABEL[s1 as Category];
  const s2Keys = getEvolutionChildren(s1);
  const m1 = monsterTable[s1];
  const isS1Collected = collected.has(s1);

  const branchPaths = [s1, ...s2Keys, ...s2Keys.flatMap((s2) => getEvolutionChildren(s2))];
  const branchCollected = branchPaths.filter((p) => collected.has(p)).length;

  return (
    <div
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
                  // Lv: monsterLevels に記録があればその値（テーマ名前空間対応）、
                  // 収集済みだが記録なし（旧データ）は 1
                  const recordedLv = getMonsterLevel(monsterLevels, themeId, s3);
                  const lv = recordedLv > 0 ? recordedLv : isS3Collected ? 1 : 0;
                  const aura = isS3Collected ? getS3Aura(lv) : null;
                  return (
                    <div
                      key={s3}
                      className={`flex flex-col items-center gap-1 rounded-lg p-1${isS3Collected ? " cursor-pointer active:opacity-80" : ""}`}
                      style={{
                        position: "relative",
                        overflow: "hidden",
                        background: "linear-gradient(160deg, #1e1a2e, #1a1829)",
                        border: aura
                          ? `${aura.borderWidth}px solid rgba(${aura.r},${aura.g},${aura.b},${aura.borderAlpha})`
                          : `1px solid ${isS3Collected ? "rgba(139,92,246,0.35)" : "#3d3450"}`,
                        boxShadow: aura?.glow
                          ? `0 0 8px rgba(${aura.r},${aura.g},${aura.b},0.4)`
                          : undefined,
                      }}
                      onClick={isS3Collected ? () => openModal(m3.image, m3.name, s3) : undefined}
                    >
                      {/* ::before 相当：レベルオーラ背景 */}
                      {aura && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: `rgba(${aura.r},${aura.g},${aura.b},${aura.bgAlpha})`,
                            animation: aura.pulse ? "s3-pulse 3s ease-in-out infinite" : undefined,
                            pointerEvents: "none",
                          }}
                        />
                      )}
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
                            color: aura
                              ? `rgba(${aura.r},${aura.g},${aura.b},1)`
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
}
