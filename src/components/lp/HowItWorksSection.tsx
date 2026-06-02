export function HowItWorksSection({ s }: { s: Record<string, string> }) {
  return (
    <section id="how" className={s.section}>
      <div className={s.container}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>HOW IT WORKS</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>たった4ステップで、習慣化が楽しくなる</p>
        <div className={`${s.divider} ${s.fadeIn}`} />

        <div className={s.stepsGrid}>
          {[
            { n: "01", icon: "📋", title: "親がクエストを設定", desc: "「宿題をする」「歯磨きをする」といった日常タスクをクエストとして登録。曜日ごとの繰り返しや一時クエストも設定できる。" },
            { n: "02", icon: "⚔", title: "子どもがクリア＆報告", desc: "子ども用画面でクエストをタップしてクリア報告。写真を添付するとボーナス XP ゲット！期限内報告でもボーナス。" },
            { n: "03", icon: "✅", title: "親が承認・プッシュ通知", desc: "報告が届くとプッシュ通知。ワンタップで承認するとXPが確定。未承認のまま翌日を迎えると自動承認される。" },
            { n: "04", icon: "🐉", title: "XP でモンスターが進化・転生", desc: "XP が貯まるとモンスターが成長・進化。最終形態に達すると「転生ボタン」が出現。勉強・体力・生活力の卵を自分で選んで次サイクルをスタート！選んだ卵の系統は進化確率+20%のボーナス。全79種コレクション＋100種の実績バッジを目指そう。" },
          ].map((step, i) => (
            <div key={i} className={`${s.stepCard} ${s.fadeIn}`}>
              <div className={s.stepNumber}>{step.n}</div>
              <div className={s.stepIcon}>{step.icon}</div>
              <div className={s.stepTitle}>{step.title}</div>
              <p className={s.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
