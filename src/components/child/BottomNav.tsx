"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { shouldShowBottomNav } from "@/lib/bottom-nav";

const tabs: { href: string; emoji: string; label: string; disabled?: boolean }[] = [
  { href: "/child/quests", emoji: "⚔️", label: "クエスト" },
  { href: "#", emoji: "🏘️", label: "集落", disabled: true },
  { href: "/child/monster", emoji: "🐣", label: "育成" },
  { href: "/child/zukan", emoji: "📖", label: "図鑑" },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (!shouldShowBottomNav(pathname ?? "")) return null;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/child/onboarding";
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-quest-card border-t border-quest-border z-50">
      <div className="flex justify-around items-center max-w-md mx-auto h-16">
        {tabs.map((tab) => {
          const isActive = pathname?.startsWith(tab.href) && !tab.disabled;
          return (
            <Link
              key={tab.label}
              href={tab.disabled ? "#" : tab.href}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
                tab.disabled
                  ? "opacity-30 pointer-events-none"
                  : isActive
                    ? "text-quest-gold"
                    : "text-quest-dim hover:text-quest-text"
              }`}
            >
              <span className="text-xl">{tab.emoji}</span>
              <span className="text-[10px] tracking-wider">{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors text-quest-dim hover:text-red-400"
        >
          <span className="text-xl">🚪</span>
          <span className="text-[10px] tracking-wider">ログアウト</span>
        </button>
      </div>
    </nav>
  );
}
