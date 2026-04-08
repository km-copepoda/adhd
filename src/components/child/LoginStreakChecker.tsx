"use client";

import { useEffect, useState } from "react";

interface LoginCheckResult {
  loginStreak: number;
  loginBestStreak: number;
  bonusGranted: number;
}

/** マウント時に1回だけログインストリークを記録し、マイルストーン達成時にカットインを表示する */
export default function LoginStreakChecker() {
  const [cutin, setCutin] = useState<LoginCheckResult | null>(null);

  useEffect(() => {
    fetch("/api/streak/login-check", { method: "POST" })
      .then((res) => res.json())
      .then((data: LoginCheckResult) => {
        if (data.bonusGranted > 0) {
          setCutin(data);
          // 3秒後に自動で閉じる
          setTimeout(() => setCutin(null), 3000);
        }
      })
      .catch(() => {
        // 失敗してもUXに影響させない
      });
  }, []);

  if (!cutin) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 px-6"
      onClick={() => setCutin(null)}
      style={{ animation: "fadeIn 0.3s ease-out" }}
    >
      <div style={{ animation: "streakIn 0.5s ease-out" }}>
        <div
          className="text-8xl mb-6 text-center"
          style={{
            filter: "drop-shadow(0 0 30px rgba(251,191,36,0.9))",
            animation: "pulse 0.8s ease-in-out infinite alternate",
          }}
        >
          🔥
        </div>
      </div>
      <p
        className="font-serif text-quest-gold text-4xl tracking-widest mb-2"
        style={{
          animation: "streakIn 0.6s ease-out",
          textShadow: "0 0 20px rgba(251,191,36,0.8)",
        }}
      >
        {cutin.loginStreak}日連続！
      </p>
      <p
        className="text-quest-gold/80 text-xl mb-2"
        style={{ animation: "streakIn 0.65s ease-out" }}
      >
        ログインボーナス
      </p>
      <p
        className="text-yellow-300 text-2xl font-bold mb-8"
        style={{
          animation: "streakIn 0.7s ease-out",
          textShadow: "0 0 12px rgba(253,224,71,0.6)",
        }}
      >
        +{cutin.bonusGranted}pt ゲット！
      </p>
      <p className="text-quest-dim text-xs">タップして閉じる</p>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes streakIn { from { opacity: 0; transform: scale(0.3) } to { opacity: 1; transform: scale(1) } }
        @keyframes pulse { from { transform: scale(1) } to { transform: scale(1.15) } }
      `}</style>
    </div>
  );
}
