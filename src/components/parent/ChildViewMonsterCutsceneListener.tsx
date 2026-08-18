"use client";

import { useEffect, useRef, useState } from "react";
import { getMonsterStage, themeIdFromSide } from "@/lib/monsters";
import CutsceneOverlay from "@/components/child/CutsceneOverlay";

type MonsterStatus = {
  evolutionStage: number;
  evolutionPath: string;
  side: string | null;
};

type CutsceneState = {
  kind: "hatched" | "evolved";
  imageSrc: string;
  imageAlt: string;
  name: string;
  description: string;
};

/**
 * 親モード（child-view）専用の進化／孵化カットイン検知。
 *
 * 子供レイアウト側の MonsterCutsceneListener と違い、
 * - Supabase Realtime 購読は行わない（decisions.md 2026-05-11「親モードでは onload + 手動リロードのみ」）
 * - 代理報告 / 代理スキップ完了時に親側ページが発火する CustomEvent("child-view-monster-refresh") を契機に再フェッチする
 * - localStorage キーは child ごとに独立（兄弟切替で誤発火しないため）
 * - API 経路は PARENT ロール用の /api/parent/child-view/monster-status?childId=...
 */
export default function ChildViewMonsterCutsceneListener({ childId }: { childId: string }) {
  const [cutscene, setCutscene] = useState<CutsceneState | null>(null);
  const prevStageRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const storageKey = `lastSeenEvolutionStage:${childId}`;

    function buildCutscene(d: MonsterStatus, kind: "hatched" | "evolved"): CutsceneState {
      const monster = getMonsterStage(d.evolutionStage, d.evolutionPath, themeIdFromSide(d.side));
      return {
        kind,
        imageSrc: monster.image,
        imageAlt: monster.name,
        name: monster.name,
        description: ("description" in monster && monster.description) || "",
      };
    }

    async function fetchAndCompare() {
      let res: Response;
      try {
        res = await fetch(`/api/parent/child-view/monster-status?childId=${childId}`);
      } catch {
        return;
      }
      if (!res.ok || cancelled) return;
      const d = (await res.json()) as MonsterStatus;
      if (cancelled) return;

      const prev = prevStageRef.current;
      if (prev === null) {
        // 初回マウント: localStorage と比較してクロスセッション進化を検知。
        // 初訪問（未設定 = -1）なら過去進化を遡及表示せず lastSeen の記録だけ行う。
        const lastSeenRaw = localStorage.getItem(storageKey);
        const lastSeen = lastSeenRaw === null ? -1 : parseInt(lastSeenRaw, 10);
        if (lastSeen !== -1 && d.evolutionStage > lastSeen) {
          setCutscene(buildCutscene(d, d.evolutionStage === 1 ? "hatched" : "evolved"));
        }
      } else if (d.evolutionStage > prev) {
        setCutscene(buildCutscene(d, prev === 0 ? "hatched" : "evolved"));
      }
      prevStageRef.current = d.evolutionStage;
      localStorage.setItem(storageKey, String(d.evolutionStage));
    }

    fetchAndCompare();

    const onRefresh = () => {
      fetchAndCompare();
    };
    window.addEventListener("child-view-monster-refresh", onRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener("child-view-monster-refresh", onRefresh);
    };
  }, [childId]);

  if (!cutscene) return null;

  return (
    <CutsceneOverlay
      onClose={() => setCutscene(null)}
      imageSrc={cutscene.imageSrc}
      imageAlt={cutscene.imageAlt}
      title={cutscene.kind === "hatched" ? "うまれた！" : "進化した！"}
      subtitle={cutscene.name}
      description={cutscene.description}
    />
  );
}
