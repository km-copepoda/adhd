"use client";

import { useState } from "react";
import Image from "next/image";
import { getMonsterStage } from "@/lib/monsters";
import { getXpInfo } from "@/lib/evolution";
import LoadingSpinner from "@/components/LoadingSpinner";
import EggSelectionModal from "@/components/child/EggSelectionModal";
import CutsceneOverlay from "@/components/child/CutsceneOverlay";
import EvolutionProgressCard from "@/components/child/EvolutionProgressCard";
import StreakCard from "@/components/child/StreakCard";
import ParameterCardList from "@/components/child/ParameterCardList";
import { useMonsterStatus } from "@/hooks/useMonsterStatus";

/** rebirthEggBonus -> 卵画像のマッピング */
const EGG_BONUS_IMAGE: Record<string, string> = {
  STUDY: "/monsters/egg-study.webp",
  STAMINA: "/monsters/egg-stamina.webp",
  LIFE: "/monsters/egg-life.webp",
};

export default function MonsterPage() {
  const {
    data,
    streak,
    loading,
    showEvolution,
    setShowEvolution,
    hatched,
    setHatched,
    reborn,
    setReborn,
    unlockedAchievement,
    setUnlockedAchievement,
    setData,
    fetchStatus,
    prevStageRef,
    selfRebirthRef,
  } = useMonsterStatus();
  const [showEggSelection, setShowEggSelection] = useState(false);
  const [rebirthLoading, setRebirthLoading] = useState(false);

  const handleRebirth = async (eggType: string) => {
    setRebirthLoading(true);
    selfRebirthRef.current = true;
    try {
      const res = await fetch("/api/rebirth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eggType }),
      });
      if (res.ok) {
        const newData = await fetchStatus();
        if (!newData) return;
        setData({
          name: newData.name, side: newData.side ?? null,
          evolutionStage: newData.evolutionStage, evolutionPath: newData.evolutionPath ?? "",
          collectedPaths: newData.collectedPaths ?? "[]",
          studyPt: newData.studyPt, staminaPt: newData.staminaPt, lifePt: newData.lifePt,
          pendingStudyPt: newData.pendingStudyPt, pendingStaminaPt: newData.pendingStaminaPt, pendingLifePt: newData.pendingLifePt,
          rebirthPending: newData.rebirthPending ?? false,
          rebirthEggBonus: newData.rebirthEggBonus ?? null,
        });
        prevStageRef.current = 0;
        localStorage.setItem("lastSeenEvolutionStage", "0");
        setShowEggSelection(false);
        setReborn(true);
        // BottomNav 育成バッジ (rebirthPending) を Realtime 取りこぼし時にも即クリア
        window.dispatchEvent(new CustomEvent("monster-changed"));
      }
    } finally {
      selfRebirthRef.current = false;
      setRebirthLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <LoadingSpinner />
    );
  }

  const pendingTotal = data.pendingStudyPt + data.pendingStaminaPt + data.pendingLifePt;
  const isReborn = (JSON.parse(data.collectedPaths) as string[]).length > 0;
  const xpInfo = getXpInfo(data.evolutionStage, data.evolutionPath, data.studyPt, data.staminaPt, data.lifePt, isReborn, data.rebirthEggBonus);
  const monsterBase = getMonsterStage(data.evolutionStage, data.evolutionPath, data.side);
  // 転生後の卵は選択した卵タイプの画像を表示する
  const monster = data.evolutionStage === 0 && data.rebirthEggBonus && EGG_BONUS_IMAGE[data.rebirthEggBonus]
    ? { ...monsterBase, image: EGG_BONUS_IMAGE[data.rebirthEggBonus] }
    : monsterBase;
  const total = data.studyPt + data.staminaPt + data.lifePt;

  const params = [
    { key: "STUDY" as const, value: data.studyPt, pending: data.pendingStudyPt },
    { key: "STAMINA" as const, value: data.staminaPt, pending: data.pendingStaminaPt },
    { key: "LIFE" as const, value: data.lifePt, pending: data.pendingLifePt },
  ];

  return (
    <div className="px-4 pt-6">
      {/* Evolution cut-in overlay */}
      {showEvolution && data && (() => {
        const m = getMonsterStage(data.evolutionStage, data.evolutionPath, data.side);
        return (
          <CutsceneOverlay
            onClose={() => setShowEvolution(false)}
            imageSrc={m.image}
            imageAlt={m.name}
            title="進化した！"
            subtitle={m.name}
            description={m.description}
          />
        );
      })()}

      {/* Hatch cut-in overlay (egg → first form) */}
      {hatched && data && (() => {
        const m = getMonsterStage(data.evolutionStage, data.evolutionPath, data.side);
        return (
          <CutsceneOverlay
            onClose={() => setHatched(false)}
            imageSrc={m.image}
            imageAlt={m.name}
            title="うまれた！"
            subtitle={m.name}
            description={m.description}
          />
        );
      })()}

      {/* Rebirth cut-in overlay */}
      {reborn && (() => {
        const eggImg = data.rebirthEggBonus && EGG_BONUS_IMAGE[data.rebirthEggBonus]
          ? EGG_BONUS_IMAGE[data.rebirthEggBonus]
          : getMonsterStage(0, "", data.side).image;
        return (
          <CutsceneOverlay
            onClose={() => setReborn(false)}
            imageSrc={eggImg}
            imageAlt="たまご"
            glowColor="rgba(139,92,246,0.8)"
            title="転生！"
            titleColor="text-purple-400"
            subtitle="新たな冒険がはじまる…"
            subtitleColor="text-purple-400/70"
          />
        );
      })()}

      {/* Achievement unlock cutscene */}
      {unlockedAchievement && (
        <CutsceneOverlay
          onClose={() => {
            try {
              const seen: string[] = JSON.parse(localStorage.getItem("seenAchievementTitles") ?? "[]");
              if (!seen.includes(unlockedAchievement.title)) {
                seen.push(unlockedAchievement.title);
                localStorage.setItem("seenAchievementTitles", JSON.stringify(seen));
              }
            } catch { /* ignore */ }
            setUnlockedAchievement(null);
          }}
          emoji={unlockedAchievement.emoji}
          title="称号を獲得！"
          titleColor="text-quest-gold"
          subtitle={unlockedAchievement.title}
          subtitleColor="text-white"
          bonus={{ text: `+${unlockedAchievement.bonusPt}pt ゲット！`, color: "#fde047" }}
        />
      )}

      {/* Egg selection overlay */}
      {showEggSelection && (
        <EggSelectionModal
          side={data.side}
          loading={rebirthLoading}
          onSelect={handleRebirth}
          onCancel={() => setShowEggSelection(false)}
        />
      )}

      {/* Monster hero */}
      <div className="flex flex-col items-center py-8 mb-6 rounded-2xl bg-gradient-to-b from-purple-950/30 to-transparent">
        <div className="w-56 h-56 animate-float mb-4 mx-auto" style={{ filter: "drop-shadow(0 0 20px rgba(139,92,246,0.3))" }}>
          <Image src={monster.image} alt={monster.name} width={224} height={224} className="w-full h-full object-contain" />
        </div>
        <p className="font-serif text-quest-gold text-xl tracking-wider">
          {data.name}
        </p>
        <p className="text-quest-dim text-xs mt-1">
          {monster.name}
        </p>
      </div>

      {/* Evolution / Rebirth progress card */}
      <EvolutionProgressCard
        evolutionStage={data.evolutionStage}
        rebirthPending={data.rebirthPending}
        xpInfo={xpInfo}
        total={total}
        pendingTotal={pendingTotal}
        onRebirthClick={() => setShowEggSelection(true)}
      />

      {/* Streak card */}
      {streak && <StreakCard streak={streak} />}

      {/* Total points */}
      <div className="bg-quest-card border border-quest-border rounded-xl p-4 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-quest-dim text-xs tracking-wider">合計ポイント</span>
          <span className="text-quest-gold font-bold text-lg">{total} pt</span>
        </div>
      </div>

      {/* Parameter cards */}
      <ParameterCardList params={params} xpToEvolve={xpInfo.xpToEvolve} />

    </div>
  );
}
