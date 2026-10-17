"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * 子供用ログアウトボタン。ボトムナビでの押し間違いを避けるため、
 * 育成画面の下部に小さく置き、確認ダイアログを必須にする。
 */
export default function ChildLogoutButton() {
  async function handleLogout() {
    if (!confirm("ログアウトするとさいしょの画面にもどるよ。本当にログアウトする？")) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="mt-8 mb-4 flex justify-center">
      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-1.5 min-h-10 px-4 rounded-lg border border-quest-border text-quest-dim text-xs hover:text-red-400 hover:border-red-400/50 transition-colors"
      >
        <span aria-hidden>🚪</span>
        <span>ログアウト</span>
      </button>
    </div>
  );
}
