"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeLoginCodeText } from "@/lib/input";

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false);

  // Login state
  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState("");

  // おうちの人が発行したログインコード（8文字・1回限り）でログイン
  async function handleLogin() {
    // blur せずに直接ボタンを押した場合に備え、送信直前に正規化を再適用する
    const normalized = normalizeLoginCodeText(loginCode);
    setLoginCode(normalized);

    if (normalized.length !== 8) {
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
        body: JSON.stringify({ loginCode: normalized }),
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

        {/* Login Code */}
        <div className="mb-4">
          <label className="text-quest-dim text-xs block text-left mb-1.5 tracking-wider">
            ログインコード
          </label>
          <input
            type="text"
            value={loginCode}
            onChange={(e) => setLoginCode(e.target.value)}
            onBlur={() => setLoginCode(normalizeLoginCodeText(loginCode))}
            maxLength={24}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="ABCD2345"
            className="w-full bg-quest-card border border-quest-border rounded-xl px-4 py-3 text-center text-quest-text font-mono text-lg tracking-[0.3em] placeholder:text-quest-dim/50 placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:border-quest-gold/50"
            autoFocus
          />
          <p className="text-quest-dim/70 text-[10px] text-left mt-1.5">
            コードは10分だけ、1回だけ使えるよ
          </p>
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
