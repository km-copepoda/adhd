"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACCOUNT_DELETE_CONFIRM_TEXT, isDeleteConfirmed } from "@/lib/accountDeletion.data";

const GENERIC_ERROR = "アカウントの削除に失敗しました。時間をおいてもう一度お試しください";
const SUBSCRIPTION_ERROR =
  "有料プランが有効なままです。App Store / Google Play などのストアで解約してから、もう一度お試しください";

/** 親アカウントの削除 UI（確認文字列の入力が必要）。成功したらサインアウトして LP へ戻る */
export default function AccountDeleteSection() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (deleting || !isDeleteConfirmed(confirmText)) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmText }),
      });
      if (!res.ok) {
        // 非 JSON のレスポンス（HTML のエラーページ等）でも落とさない
        const json: { code?: string } | null = await res.json().catch(() => null);
        setError(res.status === 409 && json?.code === "SUBSCRIPTION_ACTIVE" ? SUBSCRIPTION_ERROR : GENERIC_ERROR);
        setDeleting(false);
        return;
      }
    } catch {
      setError(GENERIC_ERROR);
      setDeleting(false);
      return;
    }

    // サインアウトに失敗してもセッションの User は既に無いので LP へ遷移する
    try {
      await createClient().auth.signOut();
    } catch {
      // ignore
    }
    window.location.href = "/";
  }

  if (!open) {
    return (
      <div className="mt-8 flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-quest-dim hover:text-red-400 transition-colors underline underline-offset-2"
        >
          アカウントを削除
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 bg-quest-card border border-red-400/40 rounded-xl p-4">
      <h2 className="text-sm font-bold tracking-wider text-red-400 mb-2">アカウントを削除</h2>
      <ul className="text-xs text-quest-dim leading-relaxed list-disc pl-4 mb-3 space-y-1">
        <li>あなた以外に親がいない場合、子どもを含む家族の全データ（クエスト・記録・写真など）が削除されます。</li>
        <li>他の親がいる場合は、あなたのアカウントだけが削除され、家族のデータは残ります。</li>
        <li>有料プランに加入中の場合は、先にストアで解約してください。</li>
        <li>削除したデータは元に戻せません。</li>
      </ul>

      <label htmlFor="account-delete-confirm" className="block text-xs text-quest-dim mb-1">
        確認のため「{ACCOUNT_DELETE_CONFIRM_TEXT}」と入力してください
      </label>
      <input
        id="account-delete-confirm"
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        disabled={deleting}
        autoComplete="off"
        placeholder={ACCOUNT_DELETE_CONFIRM_TEXT}
        className="w-full bg-quest-bg border border-quest-border rounded-lg px-3 py-2 text-sm text-quest-text placeholder:text-quest-dim focus:outline-none focus:border-red-400/60 disabled:opacity-40 disabled:cursor-not-allowed"
      />

      {error && (
        <p role="alert" className="text-red-400 text-xs mt-2">
          {error}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={() => {
            setOpen(false);
            setConfirmText("");
            setError("");
          }}
          disabled={deleting}
          className="border border-quest-border text-quest-dim rounded-lg py-2 px-4 text-sm hover:text-quest-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          キャンセル
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting || !isDeleteConfirmed(confirmText)}
          className="bg-red-400 text-quest-bg font-bold rounded-lg py-2 px-4 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {deleting ? "削除中..." : "完全に削除する"}
        </button>
      </div>
    </div>
  );
}
