"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import LoadingSpinner from "@/components/LoadingSpinner";
import ParentBottomNav from "@/components/parent/ParentBottomNav";
import { getMonsterMiniData } from "@/lib/monster-mini";

type Child = {
  id: string;
  name: string | null;
  monsterName: string | null;
  side: "DARK" | "LIGHT" | null;
  evolutionStage: number;
  evolutionPath: string;
  studyPt: number;
  staminaPt: number;
  lifePt: number;
  collectedPaths: string;
  rebirthEggBonus: string | null;
};

export default function ChildViewSelectorPage() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/parent/child-view/children")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setChildren(d);
        else setError(d.error ?? "読み込みに失敗しました");
      })
      .catch(() => setError("読み込みに失敗しました"));
  }, []);

  if (error) {
    return (
      <>
        <p className="p-6 text-red-400 text-sm">{error}</p>
        <ParentBottomNav />
      </>
    );
  }
  if (children === null) {
    return (
      <>
        <LoadingSpinner />
        <ParentBottomNav />
      </>
    );
  }

  return (
    <>
      <div className="px-4 pt-6">
        <h1 className="font-serif text-quest-gold text-lg tracking-wider mb-1">
          🧒 子供モード
        </h1>
        <p className="text-quest-dim text-xs mb-6">
          どの子のクエストを操作しますか？親が代理で報告するとそのまま承認扱いになります。
        </p>

        {children.length === 0 ? (
          <p className="text-quest-dim text-sm py-12 text-center">
            まだ子供が登録されていません。
            <br />
            <Link href="/app/parent/family" className="text-quest-gold underline">
              ファミリー画面
            </Link>{" "}
            で子供を追加してください。
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {children.map((c) => {
              const mini = getMonsterMiniData({
                evolutionStage: c.evolutionStage,
                evolutionPath: c.evolutionPath,
                side: c.side,
                studyPt: c.studyPt,
                staminaPt: c.staminaPt,
                lifePt: c.lifePt,
                collectedPaths: c.collectedPaths,
                rebirthEggBonus: c.rebirthEggBonus,
              });
              const xpMax = mini.isRebirth ? mini.rebirthThreshold : mini.ptToEvolve ?? 0;
              const xpPct = xpMax > 0 ? Math.min(100, (mini.ptCurrent / xpMax) * 100) : 0;
              const displayName = c.monsterName ?? c.name ?? "なまえなし";

              return (
                <Link
                  key={c.id}
                  href={`/app/parent/child-view/${c.id}/quests`}
                  className="bg-quest-card border border-quest-border rounded-xl px-4 py-3 hover:border-quest-gold/40 transition-colors flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-lg bg-quest-bg flex items-center justify-center overflow-hidden relative shrink-0">
                    {mini.image ? (
                      <Image
                        src={mini.image}
                        alt={displayName}
                        width={48}
                        height={48}
                        className="object-contain"
                      />
                    ) : (
                      <span className="text-xl">🥚</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    <div
                      role="progressbar"
                      aria-valuenow={mini.ptCurrent}
                      aria-valuemin={0}
                      aria-valuemax={xpMax}
                      className="h-2 bg-quest-border rounded-full overflow-hidden mt-1.5"
                    >
                      <div
                        className="h-full bg-gradient-to-r from-quest-gold-dark to-quest-gold rounded-full"
                        style={{ width: `${xpPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-quest-dim mt-0.5">
                      {mini.stageLabel}
                      {" ・ "}
                      {mini.isRebirth
                        ? `${mini.ptCurrent} / ${mini.rebirthThreshold} XP`
                        : mini.ptToEvolve !== null
                        ? `${mini.ptCurrent} / ${mini.ptToEvolve} XP`
                        : `${mini.ptCurrent} XP`}
                    </p>
                  </div>
                  <span className="text-quest-dim text-sm">›</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <ParentBottomNav />
    </>
  );
}
