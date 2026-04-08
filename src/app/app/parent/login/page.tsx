"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    await supabase.auth.signOut({ scope: "local" });
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // DB ユーザーが存在しない場合（DB リセット後など）に再作成する
    await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, supabaseId: data.user?.id }),
    });

    window.location.href = "/app/parent/tasks";
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4">
      <h1 className="font-serif text-quest-gold text-2xl tracking-wider mb-2">
        ⚔ QuestBoard
      </h1>
      <p className="text-quest-dim text-sm mb-8">ギルドマスター ログイン</p>

      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          required
          className="w-full bg-quest-card border border-quest-border rounded-xl px-4 py-3 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-quest-gold/50"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
          required
          className="w-full bg-quest-card border border-quest-border rounded-xl px-4 py-3 text-sm text-quest-text placeholder:text-quest-dim/50 focus:outline-none focus:border-quest-gold/50"
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button type="submit" disabled={loading} className="btn-gold disabled:opacity-50">
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </form>

      <Link href="/app/register" className="text-quest-dim text-xs mt-6 hover:text-quest-gold">
        アカウントを作成する →
      </Link>
    </div>
  );
}
