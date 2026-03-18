import Link from "next/link";
import InstallPrompt from "@/components/InstallPrompt";

export default function Home() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4">
      <div className="text-6xl animate-float mb-6">🥚</div>
      <h1 className="font-serif text-quest-gold text-3xl tracking-widest mb-2">
        QuestBoard
      </h1>
      <p className="text-quest-dim text-sm mb-12">
        クエストをクリアして、モンスターを育てよう！
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/child/login" className="btn-gold text-center">
          ⚔ ぼうけんをはじめる
        </Link>
        <Link
          href="/parent/login"
          className="text-center text-quest-dim text-sm border border-quest-border rounded-xl py-3 hover:border-quest-gold/30 transition-colors"
        >
          👨‍👩‍👧 ギルドマスター（保護者）はこちら
        </Link>
        <InstallPrompt />
      </div>
    </div>
  );
}
