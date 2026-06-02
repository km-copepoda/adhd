"use client";

import { computeQuestSuccessDisplay } from "@/lib/questProgress";

type Props = {
  variant: "complete" | "skip";
  questsCompleted: number;
  questsTotal: number;
};

export default function QuestActionSuccess({ variant, questsCompleted, questsTotal }: Props) {
  return (
    <div className="text-center py-8 px-5">
      {variant === "complete" ? (
        <>
          <div
            style={{
              animation: "successPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
            }}
          >
            <p className="text-7xl mb-2">🎉</p>
          </div>
          <p
            className="text-2xl font-black mb-1"
            style={{
              animation: "successFadeUp 0.4s ease 0.15s both",
              color: "#FFD700",
              textShadow: "0 0 20px rgba(255,215,0,0.6)",
            }}
          >
            クエスト完了！
          </p>
          <p
            className="text-xs text-quest-dim mb-5"
            style={{ animation: "successFadeUp 0.4s ease 0.25s both" }}
          >
            親の確認でポイント確定
          </p>
          {/* Quest progress */}
          {questsTotal > 0 && (() => {
            const { completed, remaining, allDone } = computeQuestSuccessDisplay(questsCompleted, questsTotal);
            return (
              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{
                  animation: "successFadeUp 0.4s ease 0.35s both",
                  background: allDone
                    ? "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,107,107,0.1))"
                    : "var(--color-quest-bg)",
                  border: allDone ? "1px solid rgba(255,215,0,0.4)" : undefined,
                }}
              >
                <p className="text-quest-dim text-xs mb-1">今日のクエスト</p>
                <p className="font-bold text-quest-text">
                  {completed} / {questsTotal} 完了
                </p>
                {allDone ? (
                  <p
                    className="font-black mt-1 text-base"
                    style={{
                      color: "#FFD700",
                      textShadow: "0 0 12px rgba(255,215,0,0.7)",
                      animation: "successPulse 0.8s ease 0.5s both",
                    }}
                  >
                    🏆 全部クリア！すごい！
                  </p>
                ) : (
                  <p className="text-quest-dim text-xs mt-1">あと{remaining}個！がんばれ！</p>
                )}
              </div>
            );
          })()}
          <style>{`
            @keyframes successPop {
              0% { transform: scale(0.3) rotate(-15deg); opacity: 0; }
              70% { transform: scale(1.2) rotate(5deg); }
              100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            @keyframes successFadeUp {
              from { opacity: 0; transform: translateY(12px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes successPulse {
              0% { transform: scale(0.8); opacity: 0; }
              60% { transform: scale(1.1); }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </>
      ) : (
        <>
          <p className="text-5xl mb-3">😴</p>
          <p className="text-xl font-bold text-quest-gold">スキップを申請したよ</p>
          <p className="text-xs text-quest-dim mt-2">親が確認するよ</p>
        </>
      )}
    </div>
  );
}
