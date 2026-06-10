import BottomNav from "@/components/child/BottomNav";
import PushSubscriber from "@/components/parent/PushSubscriber";
import LoginStreakChecker from "@/components/child/LoginStreakChecker";
import BadgeUnlockToast from "@/components/child/BadgeUnlockToast";
import MonsterCutsceneListener from "@/components/child/MonsterCutsceneListener";
import StreakHeaderBadge from "@/components/child/StreakHeaderBadge";

export default function ChildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh max-w-md mx-auto relative pb-20">
      {children}
      <BottomNav />
      <StreakHeaderBadge />
      <LoginStreakChecker />
      <BadgeUnlockToast />
      <MonsterCutsceneListener />
      <PushSubscriber
        className="fixed top-3 right-3 z-50 flex items-center gap-1 bg-quest-card border border-quest-gold/30 rounded-full px-3 py-1.5 text-xs text-quest-dim hover:text-quest-gold transition-colors"
        iconClassName="text-sm"
        labelClassName="hidden sm:inline"
        showDenied
      />
    </div>
  );
}
