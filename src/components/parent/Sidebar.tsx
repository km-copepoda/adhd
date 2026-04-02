"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PushSubscriber from "@/components/parent/PushSubscriber";

const links = [
  { href: "/app/parent/tasks", emoji: "📋", label: "タスク管理" },
  { href: "/app/parent/approve", emoji: "✅", label: "承認" },
  { href: "/app/parent/completed", emoji: "🏆", label: "今日の完了" },
  { href: "/app/parent/history", emoji: "📅", label: "過去の記録" },
  { href: "/app/parent/family", emoji: "👨‍👩‍👧‍👦", label: "ファミリー" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/app/parent/login";
  }

  return (
    <aside className="hidden md:flex w-56 bg-quest-card border-r border-quest-border min-h-dvh p-4 flex-col">
      <div className="mb-8">
        <h1 className="font-serif text-quest-gold text-xl tracking-wider">⚔ QuestBoard</h1>
        <p className="text-quest-dim text-xs mt-1">ギルドマスター管理画面</p>
      </div>
      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const isActive = pathname?.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-quest-gold/10 text-quest-gold border border-quest-gold/20"
                  : "text-quest-dim hover:text-quest-text hover:bg-white/5"
              }`}
            >
              <span>{link.emoji}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-4 border-t border-quest-border flex flex-col gap-1">
        <PushSubscriber className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-quest-dim hover:text-quest-gold hover:bg-quest-gold/5 transition-colors w-full" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-quest-dim hover:text-red-400 hover:bg-red-400/5 transition-colors w-full"
        >
          <span>🚪</span>
          <span>ログアウト</span>
        </button>
      </div>
    </aside>
  );
}
