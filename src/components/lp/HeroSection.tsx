import Link from "next/link";
import { HERO_SUB_TAGS } from "@/lib/lp";

export function HeroSection({ s }: { s: Record<string, string> }) {
  return (
    <section className={s.hero}>
      <div className={`${s.orb} ${s.heroOrb1}`} />
      <div className={`${s.orb} ${s.heroOrb2}`} />

      <div className={s.heroBadge}>✦ 子どもの習慣化 × ゲーミフィケーション</div>
      <div className={s.heroEgg}>🥚</div>
      <h1 className={s.heroTitle}>QuestBoard</h1>
      <p className={s.heroCatchcopy}>クエストをクリアして、モンスターを育てよう</p>
      <p className={s.heroSub}>
        子どものタスクをクエストに変える。<br />
        毎日のルーティンがゲームになれば、<br />
        やる気は自然と続いていく。
      </p>
      <div className={s.heroSubTags}>
        {HERO_SUB_TAGS.map((tag) => (
          <span key={tag} className={s.heroSubTag}>{tag}</span>
        ))}
      </div>
      <div className={s.heroCta}>
        <Link href="/login" className={s.btnGold}>⚔ 冒険をはじめる</Link>
        <a href="#pain" className={s.btnOutline}>👀 こんな悩みありませんか？</a>
      </div>
      <div className={s.heroScroll}>SCROLL</div>
    </section>
  );
}
