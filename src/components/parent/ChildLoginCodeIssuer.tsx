"use client";

import { useEffect, useState } from "react";

type Issued = { code: string; expiresAt: number };

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** 子どものログインコード（ワンタイム・10分）を発行して表示するボタン（#184） */
export default function ChildLoginCodeIssuer({ childId }: { childId: string }) {
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!issued) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [issued]);

  async function handleIssue() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/family/members/${childId}/login-code`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIssued(null);
        setError((data as { error?: string }).error || "コードの発行に失敗しました");
        return;
      }
      setIssued({
        code: (data as { code: string }).code,
        expiresAt: new Date((data as { expiresAt: string }).expiresAt).getTime(),
      });
      setNow(Date.now());
    } catch {
      setIssued(null);
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  const remaining = issued ? issued.expiresAt - now : 0;
  const expired = issued !== null && remaining <= 0;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <button
          onClick={handleIssue}
          disabled={loading}
          className="text-xs text-quest-gold hover:text-quest-gold/80 border border-quest-gold/30 rounded-lg px-3 py-1.5 min-h-9 transition-colors disabled:opacity-50"
        >
          {issued ? "ログインコードを再発行" : "ログインコードを発行"}
        </button>
      </div>
      {issued && (
        <div className="bg-quest-bg border border-quest-border rounded-lg p-3">
          <p
            className={`font-mono text-xl tracking-[0.3em] ${
              expired ? "text-quest-dim line-through" : "text-quest-gold"
            }`}
          >
            {issued.code}
          </p>
          <p className="text-[10px] text-quest-dim mt-1">
            {expired
              ? "有効期限が切れました。もう一度発行してください"
              : `残り ${formatRemaining(remaining)}（1回だけ使えます）`}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-400 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
