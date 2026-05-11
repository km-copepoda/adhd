export default function ChildViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh max-w-md mx-auto relative pb-20">
      {/* 親モードであることを明示するヘッダー */}
      <div className="sticky top-0 z-40 bg-quest-gold/10 border-b border-quest-gold/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">👨‍👩‍👧</span>
          <span className="text-xs font-bold text-quest-gold">親モード（代理操作中）</span>
        </div>
        <a
          href="/app/parent/tasks"
          className="text-[10px] text-quest-dim hover:text-quest-gold border border-quest-border rounded px-2 py-0.5"
        >
          管理画面へ戻る
        </a>
      </div>
      {children}
    </div>
  );
}
