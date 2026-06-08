"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CATEGORY_LABEL, CATEGORY_COLOR } from "@/lib/categories";
import type { Category, QuestStatus } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import QuestActionSheet, { type SheetQuest } from "@/components/QuestActionSheet";
import MonsterMiniCard from "@/components/MonsterMiniCard";
import TreasureGetCutscene from "@/components/child/TreasureGetCutscene";
import { getMonsterMiniData, type MonsterMiniData } from "@/lib/monster-mini";
import { computeCompletedCount, sortQuestsByCompletion } from "@/lib/questProgress";
import { DECLARATION_BONUS_XP } from "@/lib/declaration";

type Quest = {
  id: string;
  date: string;
  status: QuestStatus;
  comment: string | null;
  rejectionReason: string | null;
  approvalStamp: string | null;
  deadlineBonusEarned: boolean;
  photoUrl: string | null;
  hasDeadline: boolean;
  declaredToday: boolean;
  template: {
    id: string;
    title: string;
    emoji: string;
    category: Category;
    isTemporary: boolean;
    createdBy: string;
    photoBonus: boolean;
    taskStreaks: { currentStreak: number; bestStreak: number }[];
  };
};

export default function ChildViewQuestsPage() {
  const params = useParams<{ childId: string }>();
  const childId = params.childId;
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [childName, setChildName] = useState<string>("");
  const [monsterMini, setMonsterMini] = useState<MonsterMiniData | null>(null);
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 子供セルフ画面と同様、シートが閉じたあとに「宝箱ゲット！」カットインを出す。
  // pending にしておいて activeQuest=null になったタイミングで表示することで、
  // 報告操作とカットインがチラつかず順番に流れる。
  const pendingTreasureGetRef = useRef<number>(0);
  const [showTreasureGet, setShowTreasureGet] = useState<number>(0);

  // 代理報告後の再フェッチでは loading をトグルしない。
  // loading=true にするとページ全体が <LoadingSpinner /> に置換され、QuestActionSheet
  // ごと unmount → activeQuest だけが残るため、refetch 完了後に sheet が idle 状態で
  // 再表示されてしまう（「終わってもまたモーダルが出る」リグレッション）。
  async function refreshQuests() {
    const res = await fetch(`/api/parent/child-view/quests/today?childId=${childId}`);
    if (res.ok) {
      const loaded: Quest[] = await res.json();
      setQuests(loaded);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? `読み込みに失敗しました（${res.status}）`);
    }
  }

  async function fetchQuests() {
    setLoading(true);
    await refreshQuests();
    setLoading(false);
  }

  async function fetchChildName() {
    const res = await fetch(`/api/parent/child-view/monster-status?childId=${childId}`);
    if (res.ok) {
      const d = await res.json();
      setChildName(d.name ?? "");
      if (typeof d.evolutionStage === "number") {
        setMonsterMini(
          getMonsterMiniData({
            evolutionStage: d.evolutionStage,
            evolutionPath: d.evolutionPath ?? "",
            side: d.side ?? null,
            studyPt: d.studyPt,
            staminaPt: d.staminaPt,
            lifePt: d.lifePt,
            collectedPaths: d.collectedPaths ?? "[]",
            rebirthEggBonus: d.rebirthEggBonus ?? null,
          }),
        );
      }
    }
  }

  useEffect(() => {
    if (!childId) return;
    fetchQuests();
    fetchChildName();
    // 親モードでは Realtime 購読を行わない（決定: decisions.md 2026-05-11）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  async function handleReport(questId: string, comment: string | null, photoUrl: string | null) {
    const res = await fetch(`/api/parent/child-view/quests/${questId}/report-approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId, comment, photoUrl }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? `報告に失敗しました（${res.status}）`);
      return;
    }
    try {
      const data = (await res.json()) as { treasureId?: string | null };
      if (data.treasureId) pendingTreasureGetRef.current = 1;
    } catch {
      // 旧APIで JSON が無い場合などは無視
    }
    // 代理操作で進化が走った可能性を ChildViewMonsterCutsceneListener に知らせる（Realtime 不使用のため明示通知）
    window.dispatchEvent(new CustomEvent("child-view-monster-refresh"));
    await refreshQuests();
  }

  async function handleSkip(questId: string, reason: string) {
    const res = await fetch(`/api/parent/child-view/quests/${questId}/skip-approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId, comment: reason }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? `スキップに失敗しました（${res.status}）`);
      return;
    }
    try {
      const data = (await res.json()) as { treasureId?: string | null };
      if (data.treasureId) pendingTreasureGetRef.current = 1;
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent("child-view-monster-refresh"));
    await refreshQuests();
  }

  const completedCount = computeCompletedCount(quests);
  const sortedQuests = sortQuestsByCompletion(quests);

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="px-4 pt-6">
        <div className="mb-6">
          <h1 className="font-serif text-quest-gold text-lg tracking-wider">
            ⚔ {childName}のクエスト（代理）
          </h1>
          <p className="text-quest-dim text-xs mt-1">
            {completedCount} / {quests.length} 完了 ・ 報告すると即承認扱い
          </p>
          <div className="mt-2 h-1.5 bg-quest-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-quest-gold-dark to-quest-gold rounded-full transition-all"
              style={{
                width: quests.length > 0 ? `${(completedCount / quests.length) * 100}%` : "0%",
              }}
            />
          </div>
        </div>

        {monsterMini && (
          <MonsterMiniCard
            data={monsterMini}
            childName={childName}
            href={`/app/parent/child-view/${childId}/monster`}
          />
        )}

        {error && (
          <div className="mb-4 bg-red-400/10 border border-red-400/30 rounded-xl px-3 py-2 text-xs text-red-300 flex items-start gap-2">
            <span>⚠</span>
            <p className="flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400/60">
              ✕
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {quests.length === 0 && (
            <p className="text-quest-dim text-sm text-center py-12">
              今日のクエストはありません。
            </p>
          )}
          {sortedQuests.map((quest) => {
            const cat = CATEGORY_LABEL[quest.template.category];
            let xp = 1;
            if (quest.deadlineBonusEarned) xp++;
            if (quest.template.photoBonus && quest.photoUrl) xp++;
            if (quest.declaredToday) xp += DECLARATION_BONUS_XP;
            const isApproved = quest.status === "APPROVED";
            const isReported = quest.status === "REPORTED";
            const isSkipped = quest.status === "SKIPPED";
            const isSkipReported = quest.status === "SKIP_REPORTED";
            const isRejected = quest.status === "REJECTED";
            const isDone = isApproved || isSkipped || isSkipReported;
            const canTap = !isDone || isRejected; // REPORTED も親代理で確定可能
            const canTapReported = isReported;

            return (
              <div key={quest.id}>
                <div
                  onClick={() => (canTap || canTapReported) && setActiveQuest(quest)}
                  className={`relative bg-quest-card border rounded-xl overflow-hidden transition-all ${
                    isRejected
                      ? "border-red-400/40 cursor-pointer hover:border-red-400/60"
                      : isDone
                      ? "border-quest-border opacity-60"
                      : "border-quest-border cursor-pointer hover:border-quest-gold/30"
                  }`}
                >
                  <div className="flex items-center gap-3 p-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                      style={{ backgroundColor: `${CATEGORY_COLOR[quest.template.category]}15` }}
                    >
                      {quest.template.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium break-all">{quest.template.title}</p>
                      <span className="text-[10px] text-quest-dim">
                        {cat.emoji} {cat.name}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-xs font-bold ${
                          isSkipped || isSkipReported
                            ? "text-quest-dim line-through"
                            : isApproved
                            ? "text-quest-gold"
                            : "text-quest-gold"
                        }`}
                      >
                        +{xp}XP
                      </span>
                      {isApproved ? (
                        <span className="text-[9px] text-green-400/70">承認済み</span>
                      ) : isReported ? (
                        <span className="text-[9px] text-quest-dim">タップで確定</span>
                      ) : isRejected ? (
                        <span className="text-[9px] text-red-400/70">差し戻し</span>
                      ) : isSkipped ? (
                        <span className="text-[9px] text-quest-dim">スキップ</span>
                      ) : (
                        <div className="w-7 h-7 rounded-full border-2 border-quest-border/60" />
                      )}
                    </div>
                  </div>
                </div>

                {isRejected && quest.rejectionReason && (
                  <div className="bg-red-400/5 border border-red-400/20 border-t-0 rounded-b-xl px-4 py-3 text-xs text-red-300/70">
                    {quest.rejectionReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {activeQuest && (
        <QuestActionSheet
          quest={activeQuest as SheetQuest}
          hasDeadline={activeQuest.hasDeadline}
          questsCompleted={completedCount}
          questsTotal={quests.length}
          onReport={handleReport}
          onSkip={handleSkip}
          onClose={() => {
            setActiveQuest(null);
            if (pendingTreasureGetRef.current > 0) {
              setShowTreasureGet(pendingTreasureGetRef.current);
              pendingTreasureGetRef.current = 0;
            }
          }}
        />
      )}

      {showTreasureGet > 0 && (
        <TreasureGetCutscene
          count={showTreasureGet}
          onClose={() => setShowTreasureGet(0)}
        />
      )}
    </>
  );
}
