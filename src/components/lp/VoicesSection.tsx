export function VoicesSection({ s }: { s: Record<string, string> }) {
  return (
    <section className={s.section}>
      <div className={s.container}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>VOICES</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>使ってみた保護者のリアルな声</p>
        <div className={`${s.divider} ${s.fadeIn}`} />
        <div className={s.testimonialsGrid}>
          {[
            { stars: "★★★★★", text: "毎日「宿題やった？」と言い続けていたのが嘘のように、子どもが自分から動くようになりました。モンスターを進化させたいという気持ちが強くて。", avatar: "👩", name: "Aさん", role: "8歳の子を持つ保護者" },
            { stars: "★★★★★", text: "子どもが ADHD 傾向があり、タスク管理に悩んでいました。「今日のクエスト」だけが見えるシンプルな設計が、うちの子にはぴったりでした。具体的なタスク名でリマインドが届くのも、うちの子には刺さっています。", avatar: "👨", name: "Bさん", role: "10歳の子を持つ保護者" },
            { stars: "★★★★☆", text: "スキップ申請で子どもが「今日は体調が悪い」と自分で伝えてくれるようになったのが嬉しい。自分のコンディションを言語化する練習にもなっています。", avatar: "👩", name: "Cさん", role: "7歳・9歳の子を持つ保護者" },
            { stars: "★★★★★", text: "シール台紙が3日で形骸化していた我が家。XPもバッジも自動なので親の運用負担がゼロ。叱る回数が減り、「すごいね、承認するね」と言える機会が増えました。", avatar: "👨", name: "Dさん", role: "9歳の子を持つ保護者" },
            { stars: "★★★★★", text: "ADHDの息子は『あとでやる』が口癖でしたが、転生サイクルが短いので「あと数pt！」という瞬間に動き出します。長期目標より短期の達成感が合うんだなと実感。", avatar: "👩", name: "Eさん", role: "11歳の子を持つ保護者" },
            { stars: "★★★★☆", text: "兄弟で違うタスクを管理できるのが助かっています。下の子は『ゲームみたい』とすぐに馴染み、上の子は自分で一時クエストを追加して使いこなしています。", avatar: "👨", name: "Fさん", role: "6歳・10歳の子を持つ保護者" },
          ].map((t, i) => (
            <div key={i} className={`${s.testimonialCard} ${s.fadeIn}`}>
              <div className={s.testimonialQuote}>&ldquo;</div>
              <div className={s.stars}>{t.stars}</div>
              <p className={s.testimonialText}>{t.text}</p>
              <div className={s.testimonialAuthor}>
                <div className={s.testimonialAvatar}>{t.avatar}</div>
                <div>
                  <div className={s.testimonialName}>{t.name}</div>
                  <div className={s.testimonialRole}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
