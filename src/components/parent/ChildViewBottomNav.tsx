"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { suffix: "quests", emoji: "⚔️", label: "クエスト" },
  { suffix: "monster", emoji: "🐣", label: "育成" },
  { suffix: "gathering", emoji: "🏕️", label: "ひろば" },
] as const;

export default function ChildViewBottomNav({ childId }: { childId: string }) {
  const pathname = usePathname();
  const base = `/app/parent/child-view/${childId}`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-quest-card border-t border-quest-border z-50">
      <div className="flex justify-around items-center max-w-md mx-auto h-16">
        {tabs.map((tab) => {
          const href = `${base}/${tab.suffix}`;
          const isActive = pathname?.startsWith(href);
          return (
            <Link
              key={tab.suffix}
              href={href}
              className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
                isActive ? "text-quest-gold" : "text-quest-dim hover:text-quest-text"
              }`}
            >
              <span className="text-xl">{tab.emoji}</span>
              <span className="text-[10px] tracking-wider">{tab.label}</span>
            </Link>
          );
        })}
        <Link
          href="/app/parent/child-view"
          className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-quest-dim hover:text-quest-text transition-colors"
        >
          <span className="text-xl">🔄</span>
          <span className="text-[10px] tracking-wider">子を切替</span>
        </Link>
        <Link
          href="/app/parent/tasks"
          className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-quest-dim hover:text-quest-gold transition-colors"
        >
          <span className="text-xl">🚪</span>
          <span className="text-[10px] tracking-wider">親画面</span>
        </Link>
      </div>
    </nav>
  );
}
