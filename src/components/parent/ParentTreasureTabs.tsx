"use client";

import Link from "next/link";

interface Props {
  active: "settings" | "history";
}

/**
 * 親「ごほうび」セクションのトップタブ。
 * - settings: `/app/parent/treasures` 宝箱プールの設定
 * - history:  `/app/parent/treasures/pending` 子供が引き当てた履歴
 *
 * 親ナビには `/app/parent/treasures` のみが置かれているため、
 * 履歴ページへの導線を確保する目的でタブを追加している。
 */
export default function ParentTreasureTabs({ active }: Props) {
  const base =
    "flex-1 text-sm py-1.5 rounded-md font-bold tracking-wider text-center transition-colors";
  const activeCls = "bg-quest-gold/20 text-quest-gold border border-quest-gold/30";
  const inactiveCls = "text-quest-dim hover:text-quest-text";

  return (
    <div className="flex gap-1 mb-4">
      <Link
        href="/app/parent/treasures"
        className={`${base} ${active === "settings" ? activeCls : inactiveCls}`}
      >
        ⚙️ 設定
      </Link>
      <Link
        href="/app/parent/treasures/pending"
        className={`${base} ${active === "history" ? activeCls : inactiveCls}`}
      >
        🎁 もらった履歴
      </Link>
    </div>
  );
}
