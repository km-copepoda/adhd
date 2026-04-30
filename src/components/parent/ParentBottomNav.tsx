"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PushSubscriber from "@/components/parent/PushSubscriber";
import { usePendingCounts } from "@/hooks/usePendingApprovalCount";

const tabs = [
  { href: "/app/parent/tasks", emoji: "📋", label: "タスク", badgeKey: "tasks" as const },
  { href: "/app/parent/approve", emoji: "✅", label: "承認", badgeKey: "approvals" as const },
  { href: "/app/parent/completed", emoji: "🏆", label: "完了" },
  { href: "/app/parent/history", emoji: "📅", label: "履歴" },
  { href: "/app/parent/gathering", emoji: "🏕️", label: "ギルド" },
  { href: "/app/parent/family", emoji: "👨‍👩‍👧‍👦", label: "家族" },
] as const;

export default function ParentBottomNav() {
  const pathname = usePathname();
  const counts = usePendingCounts();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-quest-card border-t border-quest-border z-50">
      <div className="flex justify-around items-center h-16 px-1">
        {tabs.map((tab) => {
          const isActive = pathname?.startsWith(tab.href);
          const badgeCount = "badgeKey" in tab ? counts[tab.badgeKey] : 0;
          const hasBadge = badgeCount > 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
                isActive ? "text-quest-gold" : hasBadge ? "text-orange-400 hover:text-orange-300" : "text-quest-dim hover:text-quest-text"
              }`}
            >
              <span className="relative text-xl">
                {hasBadge ? "🔔" : tab.emoji}
                {hasBadge && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </span>
              <span className="text-[10px] tracking-wider">{tab.label}</span>
            </Link>
          );
        })}
        <PushSubscriber
          className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors text-quest-dim hover:text-quest-gold"
          iconClassName="text-xl"
          labelClassName="text-[10px] tracking-wider"
        />
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors text-quest-dim hover:text-red-400"
        >
          <span className="text-xl">🚪</span>
          <span className="text-[10px] tracking-wider">ログアウト</span>
        </button>
      </div>
    </nav>
  );
}
