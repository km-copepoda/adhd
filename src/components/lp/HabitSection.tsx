export function HabitSection({ s }: { s: Record<string, string> }) {
  return (
    <section id="habit" className={`${s.section} ${s.adhdSection}`}>
      <div className={`${s.orb} ${s.adhdOrbA1}`} />
      <div className={s.container}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>HABIT DESIGN</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>
          即時フィードバック・短いサイクル・具体的な指示 ── 続けたくなる設計
        </p>
        <div className={`${s.divider} ${s.fadeIn}`} />

        <div className={s.adhdGrid}>
          {[
            { icon: "⚡", color: s.adhdIconGold,    title: "即時フィードバック", desc: "完了→承認→XP 確定のフローを最短化。フィードバックの遅れによるモチベーション低下を防ぐ。" },
            { icon: "📋", color: s.adhdIconStudy,   title: "シンプルな今日のタスク", desc: "子ども画面に出るのは「今日のクエスト」だけ。先のタスクに圧倒されず、今日やることに集中できる。" },
            { icon: "🔔", color: s.adhdIconStamina, title: "具体的なリマインド通知", desc: "「アプリを見て」ではなく「宿題がまだだよ！」と具体的なタスク名で通知。子どもが動きやすい。" },
            { icon: "🔄", color: s.adhdIconLife,    title: "短いフィードバックループ", desc: "転生サイクルは約8〜10日。長期目標より短期の達成感が、続けるモチベーションになる。" },
            { icon: "🤝", color: s.adhdIconPurple,  title: "子どもの自発性を尊重", desc: "子どもが自分でタスクを追加し、親が承認。自己管理の練習と親の見守りのバランスを取る。" },
            { icon: "⏭", color: s.adhdIconPink,    title: "スキップにも親承認フロー", desc: "「今日はできない」を正直に申告し、親が承認すればストリーク継続。コンディションに寄り添う。" },
            { icon: "⏱", color: s.adhdIconGold,    title: "時間の見える化", desc: "報告期限を子どもごとに設定でき、期限内報告はボーナス XP。「今日の締め切り」を自然に意識できる。" },
            { icon: "🎯", color: s.adhdIconStudy,   title: "多段階の小さな達成感", desc: "完了・期限内・写真と報酬トリガーを複数用意。1日に何度も「できた！」が積み重なる。" },
            { icon: "⚔", color: s.adhdIconLife,    title: "「クエスト」形式で始めやすく", desc: "「宿題をやりなさい」より「クエストをクリアしよう！」。ゲームのフレーミングが動き出しを軽くする。" },
            { icon: "🧠", color: s.adhdIconPurple,  title: "やること一覧をアプリが管理", desc: "「何をするべきか」は毎日アプリが提示。子ども自身が全部覚えておく必要がない。" },
            { icon: "💬", color: s.adhdIconStamina, title: "ポジティブな関わりを増やす", desc: "叱る場面を減らし、「承認」で認める機会を増やす。肯定的な体験の積み重ねが自己肯定感を育てる。" },
            { icon: "🙋", color: s.adhdIconGold,    title: "先延ばしからの再スタート", desc: "手つかずのタスクに「今日やる！」宣言ボタンが出現。叱られる代わりに、本人の意思表示から再開できる。" },
          ].map((item, i) => (
            <div key={i} className={`${s.adhdPoint} ${s.fadeIn}`}>
              <div className={`${s.adhdIcon} ${item.color}`}>{item.icon}</div>
              <div className={s.adhdContent}>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
