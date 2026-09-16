"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getMonsterStage, themeIdFromSide } from "@/lib/monsters";
import { pickRuby } from "@/lib/ruby";
import CutsceneOverlay from "@/components/child/CutsceneOverlay";

type MonsterStatus = {
  evolutionStage: number;
  evolutionPath: string;
  side: string | null;
  monsterSetId?: string | null;
  /** Issue #140: 非 boolean（undefined/null/文字列/数値）は true（かな表示）にフォールバックする */
  rubyEnabled?: unknown;
};

type CutsceneState = {
  kind: "hatched" | "evolved";
  imageSrc: string;
  imageAlt: string;
  name: string;
  description: string;
};

const LAST_SEEN_KEY = "lastSeenEvolutionStage";

/**
 * 子レイアウト常駐の進化／孵化カットイン検知。
 * User テーブルの Realtime UPDATE で `evolutionStage` が増加したら、
 * 表示中のページに関わらず CutsceneOverlay を即時に重ねる。
 *
 * 育成画面に行かない限りカットインが出ない旧設計（useMonsterStatus 内検知）を置き換え、
 * 親のスタンプ承認で進化したケースでもクエスト画面で演出を見られるようにする。
 */
export default function MonsterCutsceneListener() {
  const [cutscene, setCutscene] = useState<CutsceneState | null>(null);
  const prevStageRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    function buildCutscene(d: MonsterStatus, kind: "hatched" | "evolved"): CutsceneState {
      const monster = getMonsterStage(d.evolutionStage, d.evolutionPath, d.monsterSetId ?? themeIdFromSide(d.side));
      const rubyEnabled = typeof d.rubyEnabled === "boolean" ? d.rubyEnabled : true;
      const name = pickRuby(monster.name, monster.nameKana, rubyEnabled);
      const description = ("description" in monster && monster.description) || "";
      const descriptionKana = ("descriptionKana" in monster && monster.descriptionKana) || "";
      return {
        kind,
        imageSrc: monster.image,
        imageAlt: name,
        name,
        description: pickRuby(description, descriptionKana, rubyEnabled),
      };
    }

    async function fetchAndCompare() {
      let res: Response;
      try {
        res = await fetch("/api/monster-status");
      } catch {
        return;
      }
      if (!res.ok || cancelled) return;
      const d = (await res.json()) as MonsterStatus;
      if (cancelled) return;

      const prev = prevStageRef.current;
      if (prev === null) {
        // 初回マウント: localStorage と比較してクロスセッション進化を検知。
        // 初訪問（lastSeen 未設定 = -1）の場合は過去進化を遡及表示しない。
        const lastSeenRaw = localStorage.getItem(LAST_SEEN_KEY);
        const lastSeen = lastSeenRaw === null ? -1 : parseInt(lastSeenRaw, 10);
        if (lastSeen !== -1 && d.evolutionStage > lastSeen) {
          setCutscene(buildCutscene(d, d.evolutionStage === 1 ? "hatched" : "evolved"));
        }
      } else if (d.evolutionStage > prev) {
        setCutscene(buildCutscene(d, prev === 0 ? "hatched" : "evolved"));
      }
      prevStageRef.current = d.evolutionStage;
      localStorage.setItem(LAST_SEEN_KEY, String(d.evolutionStage));
    }

    fetchAndCompare();

    const supabase = createClient();
    const channel = supabase
      .channel("monster-cutscene-listener")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "User" },
        () => {
          fetchAndCompare();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

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
