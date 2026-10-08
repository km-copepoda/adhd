"use client";

import { useApiFetch } from "@/hooks/useApiFetch";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { LimitedResource } from "@/lib/subscription";

type ChildUsage = {
  childId: string;
  displayName: string;
  taskCount: number;
  treasureItemCount: number;
};

type SubscriptionStatus = {
  plan: "FREE" | "PREMIUM";
  currentPeriodEnd: string | null;
  limits: Record<LimitedResource, number | null>;
  usage: { child: number; perChild: ChildUsage[] };
};

function formatLimit(n: number | null): string {
  return n === null ? "無制限" : String(n);
}

function formatDateJST(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export default function PlanPage() {
  const { data: status, loading, error } = useApiFetch<SubscriptionStatus>(
    "/api/subscription/status",
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !status) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 text-sm">エラー: プラン情報の取得に失敗しました</p>
      </div>
    );
  }

  const isPremium = status.plan === "PREMIUM";

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-quest-gold text-2xl tracking-wider">💳 プラン管理</h1>
        <p className="text-quest-dim text-sm mt-1">現在のプランと利用状況を確認できます</p>
      </div>

      <div className="bg-quest-card border border-quest-border rounded-xl p-6 mb-6">
        <p className="text-quest-dim text-xs tracking-wider mb-2">現在のプラン</p>
        <p className="text-quest-gold text-xl font-bold mb-1">
          {isPremium ? "プレミアムプラン" : "無料プラン"}
        </p>
        {isPremium && (
          <p className="text-quest-dim text-xs">
            有効期限:{" "}
            {status.currentPeriodEnd ? formatDateJST(status.currentPeriodEnd) : "無期限"}
          </p>
        )}
        <div className="mt-4">
          {isPremium ? (
            <button
              type="button"
              disabled
              className="text-sm border border-quest-border rounded-lg px-4 py-2 text-quest-dim opacity-50 cursor-not-allowed"
            >
              解約・カード変更（準備中）
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="btn-gold text-sm opacity-50 cursor-not-allowed"
            >
              アップグレード（準備中）
            </button>
          )}
        </div>
      </div>

      <div className="bg-quest-card border border-quest-border rounded-xl p-6">
        <p className="text-quest-dim text-xs tracking-wider mb-3">利用状況</p>
        <p className="text-sm mb-4">
          子アカウント数: {status.usage.child} / {formatLimit(status.limits.child)}
        </p>
        <div className="flex flex-col gap-3">
          {status.usage.perChild.map((c) => (
            <div key={c.childId} className="bg-quest-bg rounded-lg p-3">
              <p className="text-sm font-medium mb-1">{c.displayName}</p>
              <p className="text-xs text-quest-dim">
                タスク: {c.taskCount} / {formatLimit(status.limits.task)}
              </p>
              <p className="text-xs text-quest-dim">
                ごほうび: {c.treasureItemCount} / {formatLimit(status.limits.treasure_item)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
