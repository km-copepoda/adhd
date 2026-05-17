"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";

type Child = {
  id: string;
  name: string | null;
  monsterName: string | null;
  side: "DARK" | "LIGHT" | null;
  evolutionStage: number;
  evolutionPath: string;
};

export default function ChildViewSelectorPage() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/parent/child-view/children")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setChildren(d);
        else setError(d.error ?? "読み込みに失敗しました");
      })
      .catch(() => setError("読み込みに失敗しました"));
  }, []);

  if (error) {
    return <p className="p-6 text-red-400 text-sm">{error}</p>;
  }
  if (children === null) {
    return <LoadingSpinner />;
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="font-serif text-quest-gold text-lg tracking-wider mb-1">
        🧒 子供モード
      </h1>
      <p className="text-quest-dim text-xs mb-6">
        どの子のクエストを操作しますか？親が代理で報告するとそのまま承認扱いになります。
      </p>

      {children.length === 0 ? (
        <p className="text-quest-dim text-sm py-12 text-center">
          まだ子供が登録されていません。
          <br />
          <Link href="/app/parent/family" className="text-quest-gold underline">
            ファミリー画面
          </Link>{" "}
          で子供を追加してください。
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {children.map((c) => (
            <Link
              key={c.id}
              href={`/app/parent/child-view/${c.id}/quests`}
              className="bg-quest-card border border-quest-border rounded-xl px-4 py-3 hover:border-quest-gold/40 transition-colors flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-quest-bg flex items-center justify-center text-xl">
                🐲
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {c.monsterName ?? c.name ?? "なまえなし"}
                </p>
                <p className="text-[10px] text-quest-dim mt-0.5">
                  stage {c.evolutionStage}
                  {c.evolutionPath ? ` ・ ${c.evolutionPath}` : ""}
                </p>
              </div>
              <span className="text-quest-dim text-sm">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
