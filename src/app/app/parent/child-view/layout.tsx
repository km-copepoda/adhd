export default function ChildViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh max-w-md mx-auto relative pb-20">
      {/* 親モードであることを明示するヘッダー（親画面への戻りは下部ナビの「親画面」から） */}
      <div className="sticky top-0 z-40 bg-quest-gold/10 border-b border-quest-gold/30 px-4 py-2 flex items-center gap-2">
        <span className="text-sm">👨‍👩‍👧</span>
        <span className="text-xs font-bold text-quest-gold">親モード（代理操作中）</span>
      </div>
      {children}
    </div>
  );
}
