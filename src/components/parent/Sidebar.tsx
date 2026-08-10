"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import PushSubscriber from "@/components/parent/PushSubscriber";
import { usePendingCounts } from "@/hooks/usePendingApprovalCount";

const links = [
  { href: "/app/parent/tasks", emoji: "📋", label: "タスク管理", badgeKey: "tasks" as const },
  { href: "/app/parent/approve", emoji: "✅", label: "承認", badgeKey: "approvals" as const },
  { href: "/app/parent/child-view", emoji: "🧒", label: "子供モード" },
  { href: "/app/parent/records", emoji: "📊", label: "記録" },
  { href: "/app/parent/gathering", emoji: "🏕️", label: "ひろば" },
  { href: "/app/parent/treasures", emoji: "🎁", label: "ごほうび" },
  { href: "/app/parent/family", emoji: "👨‍👩‍👧‍👦", label: "ファミリー" },
  { href: "/app/parent/plan", emoji: "💎", label: "プラン" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const counts = usePendingCounts();

  return (
    <aside className="hidden md:flex w-56 bg-quest-card border-r border-quest-border min-h-dvh p-4 flex-col">
      <div className="mb-8">
        <h1 className="font-serif text-quest-gold text-xl tracking-wider">⚔ QuestBoard</h1>
        <p className="text-quest-dim text-xs mt-1">管理画面</p>
      </div>
      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const isActive = pathname?.startsWith(link.href);
          const badgeCount = "badgeKey" in link ? counts[link.badgeKey] : 0;
          const hasBadge = badgeCount > 0;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-quest-gold/10 text-quest-gold border border-quest-gold/20"
                  : hasBadge
                  ? "text-orange-400 hover:text-orange-300 hover:bg-orange-400/5"
                  : "text-quest-dim hover:text-quest-text hover:bg-white/5"
              }`}
            >
              <span className="relative">
                {hasBadge ? "🔔" : link.emoji}
                {hasBadge && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-4 border-t border-quest-border flex flex-col gap-1">
        <PushSubscriber className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-quest-dim hover:text-quest-gold hover:bg-quest-gold/5 transition-colors w-full" />
      </div>
    </aside>
  );
}
