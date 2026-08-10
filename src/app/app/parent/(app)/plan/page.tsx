"use client";

import { useEffect, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";

type Limits = {
  child: number | null;
  task: number | null;
  treasure_item: number | null;
};

type PerChild = {
  childId: string;
  name: string;
  taskCount: number;
  treasureItemCount: number;
};

type Status = {
  plan: "FREE" | "PREMIUM";
  currentPeriodEnd: string | null;
  limits: Limits;
  usage: { child: number; perChild: PerChild[] };
};

function formatLimit(n: number | null): string {
  return n === null ? "無制限" : `${n}`;
}

function formatDateJST(iso: string | null): string {
  if (!iso) return "無期限";
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

export default function PlanPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/subscription/status")
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data: Status) => setStatus(data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <div>
        <h1 className="font-serif text-quest-gold text-2xl tracking-wider mb-8">💎 プラン管理</h1>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }
  if (!status) return null;

  const isPremium = status.plan === "PREMIUM";

  return (
    <div>
      <h1 className="font-serif text-quest-gold text-2xl tracking-wider mb-8">💎 プラン管理</h1>

      {/* 現在のプラン */}
      <div className="bg-quest-card border border-quest-border rounded-xl p-6 mb-6">
        <p className="text-quest-dim text-xs tracking-wider mb-3">現在のプラン</p>
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
              isPremium
                ? "bg-quest-gold/20 text-quest-gold border border-quest-gold/40"
                : "bg-quest-border text-quest-text border border-quest-border"
            }`}
          >
            {isPremium ? "💎 プレミアム" : "🆓 無料プラン"}
          </span>
          {isPremium && (
            <span className="text-quest-dim text-xs">
              有効期限: {formatDateJST(status.currentPeriodEnd)}
            </span>
          )}
        </div>
        {!isPremium && (
          <p className="text-quest-dim text-xs mt-2">
            無料プランでも基本機能はすべてお使いいただけます。プレミアムでは子供・タスク・ごほうび・季節コレクションが無制限になります。
          </p>
        )}
      </div>

      {/* 使用状況 */}
      <div className="bg-quest-card border border-quest-border rounded-xl p-6 mb-6">
        <p className="text-quest-dim text-xs tracking-wider mb-4">使用状況</p>

        <div className="mb-4">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm">👨‍👩‍👧‍👦 子アカウント</span>
            <span className="text-quest-gold font-mono text-sm">
              {status.usage.child} / {formatLimit(status.limits.child)}
            </span>
          </div>
        </div>

        {status.usage.perChild.length > 0 && (
          <div className="mt-4 pt-4 border-t border-quest-border">
            <p className="text-quest-dim text-[10px] tracking-wider mb-3">子ごとの内訳</p>
            <div className="flex flex-col gap-3">
              {status.usage.perChild.map((c) => (
                <div key={c.childId} className="bg-quest-bg rounded-lg p-3">
                  <p className="text-sm font-medium mb-2">{c.name || "未設定"}</p>
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-quest-dim">📋 タスク</span>
                      <span className="text-quest-text font-mono">
                        {c.taskCount} / {formatLimit(status.limits.task)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-quest-dim">🎁 ごほうび</span>
                      <span className="text-quest-text font-mono">
                        {c.treasureItemCount} / {formatLimit(status.limits.treasure_item)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* アップグレード / 管理 */}
      <div className="bg-quest-card border border-quest-border rounded-xl p-6">
        {isPremium ? (
          <>
            <p className="text-quest-dim text-xs tracking-wider mb-3">プランの管理</p>
            <p className="text-sm text-quest-text mb-4">
              現在プレミアムをご利用中です。ありがとうございます 🙏
            </p>
            <button
              disabled
              className="text-sm text-quest-dim border border-quest-border rounded-lg px-4 py-2 opacity-50 cursor-not-allowed"
              title="準備中"
            >
              解約・カード変更 (準備中)
            </button>
          </>
        ) : (
          <>
            <p className="text-quest-dim text-xs tracking-wider mb-3">プレミアムにアップグレード</p>
            <ul className="text-sm text-quest-text list-disc list-inside mb-4 space-y-1">
              <li>子アカウント無制限</li>
              <li>タスク無制限 (1 人につき 10 個 → 無制限)</li>
              <li>ごほうび無制限 (1 人につき 5 個 → 無制限)</li>
              <li>季節コレクション 80 種フル解放</li>
            </ul>
            <button
              disabled
              className="btn-gold text-sm opacity-50 cursor-not-allowed"
              title="準備中"
            >
              アップグレード (準備中)
            </button>
            <p className="text-quest-dim text-[10px] mt-2">
              決済機能は近日公開予定です。しばらくお待ちください。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
