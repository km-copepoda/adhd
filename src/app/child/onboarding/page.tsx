"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 全角英数字・記号 → 半角に変換（タブレットIME対策）
function toHalfWidth(str: string): string {
  return str.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false);

  // Login state
  const [familyCode, setFamilyCode] = useState("");
  const [childCode, setChildCode] = useState("");
  const [loginError, setLoginError] = useState("");

  // ファミリーコード + ユーザーコードでログイン
  async function handleLogin() {
    if (familyCode.length < 4 || childCode.length < 4) {
      setLoginError("コードを入力してね");
      return;
    }
    setLoading(true);
    setLoginError("");
    try {
      // クライアント側で匿名認証（cookieが正しくセットされる）
      const supabase = createClient();
      let { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error || !data.user) {
          setLoginError("認証に失敗しました");
          return;
        }
        user = data.user;
      }

      // APIでコード検証 + supabaseId紐付け
      const res = await fetch("/api/auth/child-rejoin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyCode, childCode, supabaseUserId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "コードが正しくありません");
        return;
      }
      // ログイン成功 → フルリロードでミドルウェアがセッションを処理
      window.location.href = "/child/quests";
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
            onChange={(e) => setFamilyCode(toHalfWidth(e.target.value).toUpperCase().slice(0, 6))}
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
            onChange={(e) => setChildCode(toHalfWidth(e.target.value).replace(/\D/g, "").slice(0, 4))}
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
