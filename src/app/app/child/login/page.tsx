"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toHalfWidth } from "@/lib/input";
import { useImeSafeText } from "@/hooks/useImeSafeText";

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false);

  // Login state
  const [familyCode, setFamilyCode] = useState("");
  const [childCode, setChildCode] = useState("");
  const [loginError, setLoginError] = useState("");

  // IME ON 状態で英字を入れると二重発火する問題への対策。
  // ファミリー/ユーザーコードはどちらも ASCII のみなので合成を抑止する。
  const familyCodeHandlers = useImeSafeText(setFamilyCode, (raw) =>
    toHalfWidth(raw).toUpperCase().slice(0, 6),
  );
  const childCodeHandlers = useImeSafeText(setChildCode, (raw) =>
    toHalfWidth(raw).replace(/\D/g, "").slice(0, 4),
  );

  // ファミリーコード + ユーザーコードでログイン
  async function handleLogin() {
    if (familyCode.length < 4 || childCode.length < 4) {
      setLoginError("コードを入力してね");
      return;
    }
    setLoading(true);
    setLoginError("");
    try {
      // 既存セッション（親など）をクリアしてから匿名認証
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "local" });
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.user) {
        setLoginError("認証に失敗しました");
        return;
      }

      // APIでコード検証 + supabaseId紐付け（supabaseIdはサーバー側でセッションから取得）
      const res = await fetch("/api/auth/child-rejoin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyCode, childCode }),
      });
      if (!res.ok) {
        const resData = await res.json().catch(() => ({}));
        setLoginError((resData as { error?: string }).error || "コードが正しくありません");
        return;
      }
      // ログイン成功 → フルリロードでミドルウェアがセッションを処理
      window.location.href = "/app/child/quests";
    } catch {
      setLoginError("エラーが発生しました。もう一度お試しください");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="text-center w-full max-w-xs">
        <div className="text-7xl animate-float mb-6">🥚</div>
        <h2 className="font-serif text-quest-gold text-2xl tracking-wider mb-2">
          ようこそ、冒険者よ！
        </h2>
        <p className="text-quest-dim text-xs mb-8">
          おうちの人にもらったコードを入力してね
        </p>

        {/* Family Code */}
        <div className="mb-4">
          <label className="text-quest-dim text-xs block text-left mb-1.5 tracking-wider">
            ファミリーコード
          </label>
          <input
            type="text"
            value={familyCode}
            {...familyCodeHandlers}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="ABC123"
            className="w-full bg-quest-card border border-quest-border rounded-xl px-4 py-3 text-center text-quest-text font-mono text-lg tracking-[0.3em] placeholder:text-quest-dim/50 placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:border-quest-gold/50"
            autoFocus
          />
        </div>

        {/* Child Code */}
        <div className="mb-4">
          <label className="text-quest-dim text-xs block text-left mb-1.5 tracking-wider">
            ユーザーコード
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={childCode}
            {...childCodeHandlers}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="1234"
            className="w-full bg-quest-card border border-quest-border rounded-xl px-4 py-3 text-center text-quest-text font-mono text-lg tracking-[0.3em] placeholder:text-quest-dim/50 placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:border-quest-gold/50"
          />
        </div>

        {loginError && (
          <p className="text-red-400 text-xs mb-2">{loginError}</p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="btn-gold w-full mt-4 disabled:opacity-50"
        >
          {loading ? "ログイン中..." : "⚔ ログイン"}
        </button>
      </div>
    </div>
  );
}
