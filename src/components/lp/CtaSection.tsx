import Link from "next/link";

export function CtaSection({ s }: { s: Record<string, string> }) {
  return (
    <section id="cta" className={`${s.section} ${s.ctaSection}`}>
      <div className={`${s.orb} ${s.ctaOrb}`} />
      <div className={s.container}>
        <div className={s.heroEgg} style={{ marginBottom: 16 }}>🥚</div>
        <h2 className={s.ctaTitle}>さあ、冒険をはじめよう</h2>
        <p className={s.ctaDesc}>
          子どもの習慣化をゲームに変える。今日の小さなクエストが、明日の大きな力になる。
        </p>
        <div className={s.ctaBtns}>
          <Link href="/login" className={s.btnGold}>⚔ 無料ではじめる</Link>
          <Link href="/app/register" className={s.btnOutline}>👨‍👩‍👧 保護者登録</Link>
        </div>
        <p className={s.ctaNote}>ファミリーコードで子どもアカウントと連携。セットアップは5分。</p>
      </div>
    </section>
  );
}
