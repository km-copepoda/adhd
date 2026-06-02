"use client";

// モンスター図鑑の本体 UI。
// 旧 `/app/child/zukan` の中身を抽出し、コレクションタブ (`/app/child/collection`)
// と既存 `/app/child/zukan` の両方から同じ内容を表示できるようにした。
// マウント時に lastSeenCollectedCount を更新して BottomNav バッジを既読化する副作用は
// このコンポーネント側に持たせる（旧ページからもタブからも自動で動く）。

import { useEffect, useState } from "react";
import { MONSTER_TABLE, MONSTER_TABLE_LIGHT, EGG_STAGE, EGG_STAGE_LIGHT, getEvolutionChildren } from "@/lib/monsters";
import LoadingSpinner from "@/components/LoadingSpinner";
import MonsterImageModal from "@/components/MonsterImageModal";
import { getZukanStageLabel } from "@/lib/zukanStageLabel";
import ZukanEggSection from "./ZukanEggSection";
import ZukanEvolutionBranch from "./ZukanEvolutionBranch";

type ZukanData = {
  side: string | null;
  collectedPaths: string;
  monsterLevels: string;
  usedEggBonuses: string;
};

type SelectedMonster = { image: string; name: string; stageLabel: string };

interface ZukanContentProps {
  /** 取得元 API。親モードでは /api/parent/child-view/monster?childId=X を渡す。 */
  fetchUrl?: string;
  /** localStorage 既読フラグを更新するか。親モードでは false（親端末の子供バッジに影響させない）。 */
  trackVisit?: boolean;
}

export default function ZukanContent({
  fetchUrl = "/api/monster",
  trackVisit = true,
}: ZukanContentProps = {}) {
  const [data, setData] = useState<ZukanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedMonster | null>(null);

  useEffect(() => {
    fetch(fetchUrl)
      .then((r) => r.json())
      .then((d: ZukanData) => {
        const paths = d.collectedPaths ?? "[]";
        setData({ side: d.side ?? null, collectedPaths: paths, monsterLevels: d.monsterLevels ?? "{}", usedEggBonuses: d.usedEggBonuses ?? "[]" });
        if (trackVisit) {
          const count = (JSON.parse(paths) as string[]).length;
          localStorage.setItem("lastSeenCollectedCount", String(count));
        }
      })
      .finally(() => setLoading(false));
  }, [fetchUrl, trackVisit]);

  if (loading || !data) return <LoadingSpinner />;

  const collected = new Set<string>(JSON.parse(data.collectedPaths) as string[]);
  const usedEggs = new Set<string>(JSON.parse(data.usedEggBonuses) as string[]);

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
      <style>{`
        @keyframes s3-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      {/* ── ヘッダー ── */}
      <h1 className="font-serif text-quest-gold text-xl tracking-widest mb-1 text-center">
        📖 モンスター図鑑
      </h1>
      <p className="text-quest-dim text-xs text-center mb-4">
        {total} / {max} 体
      </p>

      {/* ── 卵 ── */}
      <ZukanEggSection eggData={eggData} usedEggs={usedEggs} />

      {/* ── 3系統ブランチ ── */}
      {stage1Keys.map((s1) => (
        <ZukanEvolutionBranch
          key={s1}
          s1={s1}
          collected={collected}
          monsterLevels={monsterLevels}
          monsterTable={monsterTable}
          openModal={openModal}
        />
      ))}

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
