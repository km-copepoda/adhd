import BottomNav from "@/components/child/BottomNav";
import PushSubscriber from "@/components/parent/PushSubscriber";
import LoginStreakChecker from "@/components/child/LoginStreakChecker";
import BadgeUnlockToast from "@/components/child/BadgeUnlockToast";
import MonsterCutsceneListener from "@/components/child/MonsterCutsceneListener";

export default function ChildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh max-w-md mx-auto relative pb-20">
      {/* 通知ベルは固定配置にせずヘッダー行に置く（コンテンツと重ならないように） */}
      <div className="flex justify-end px-3 pt-3 empty:hidden">
        <PushSubscriber
          className="flex items-center gap-1 min-h-9 bg-quest-card border border-quest-gold/30 rounded-full px-3 py-1.5 text-xs text-quest-muted hover:text-quest-gold transition-colors"
          iconClassName="text-sm"
          labelClassName="hidden sm:inline"
          showDenied
        />
      </div>
      {children}
      <BottomNav />
      <LoginStreakChecker />
      <BadgeUnlockToast />
      <MonsterCutsceneListener />
    </div>
  );
}
