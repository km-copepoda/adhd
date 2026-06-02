export function HabitSection({ s }: { s: Record<string, string> }) {
  return (
    <section id="habit" className={`${s.section} ${s.adhdSection}`}>
      <div className={`${s.orb} ${s.adhdOrbA1}`} />
      <div className={s.container}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>HABIT DESIGN</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>
          ADHD 傾向のお子さんにも届く、続けたくなる設計が詰まっています。<br />
          「即時フィードバック」「短いサイクル」「具体的な指示」── 困りごとに合わせた仕組み。
        </p>
        <div className={`${s.divider} ${s.fadeIn}`} />

        <div className={s.adhdGrid}>
          {[
            { icon: "⚡", color: s.adhdIconGold,    title: "即時フィードバック", desc: "タスク完了→承認→XP 確定のフローを最短化。自動承認機能で翌日0時に未承認分を一括処理するため、フィードバック遅延によるモチベーション低下を防ぐ。" },
            { icon: "📋", color: s.adhdIconStudy,   title: "シンプルな今日のタスク", desc: "子ども画面に表示されるのは「今日のクエスト」のみ。先のタスクで圧倒されず、今日やることだけに集中できる。" },
            { icon: "🔔", color: s.adhdIconStamina, title: "具体的なリマインド通知", desc: "「アプリを見て」ではなく「宿題がまだ終わってないよ！」と具体的なタスク名で通知。子どもは抽象的な指示より具体的な行動指示で動きやすい。" },
            { icon: "🔄", color: s.adhdIconLife,    title: "短いフィードバックループ", desc: "転生サイクルを約8〜10日に設定。長期目標より短期の達成感が、子どもにとって続けるモチベーションになる。卵→孵化→進化×3→転生のスプリント設計。" },
            { icon: "🤝", color: s.adhdIconPurple,  title: "子どもの自発性を尊重", desc: "子どもが自分でタスクを追加し、親が承認する仕組み。自己管理の練習になりながら、親の監督権限も維持する適切なバランス。" },
            { icon: "⏭", color: s.adhdIconPink,    title: "スキップにも親承認フロー", desc: "「今日はできない」と正直に申告してスキップを申請。親が承認すればストリーク継続。子どものコンディションに寄り添いつつ、安易なスキップを防ぐ。" },
            { icon: "⏱", color: s.adhdIconGold,    title: "時間の見える化", desc: "子どもは「もうこんな時間！」となりがち。報告期限を子どもごとに設定でき、期限内に報告するとボーナス XP が得られるため、「今日の締め切り」を自然に意識するきっかけになる。" },
            { icon: "🎯", color: s.adhdIconStudy,   title: "多段階の小さな達成感", desc: "タスク完了（+1pt）、期限内報告（+1pt）、写真ボーナス（+1pt）と報酬トリガーを複数設定。ログインストリーク達成でも追加 XP。さらに100種の実績バッジが「気づいたら達成！」という驚きを加え、1日に何度も「できた！」が積み重なる設計。" },
            { icon: "⚔", color: s.adhdIconLife,    title: "「クエスト」形式でタスク開始のハードルを下げる", desc: "「宿題をやりなさい」より「クエストをクリアしよう！」の方が子どもは動きやすい。ゲームとしてのフレーミングが先延ばしを抑制し、自発的なタスク開始を促す。" },
            { icon: "🧠", color: s.adhdIconPurple,  title: "やること一覧をアプリが管理", desc: "「何をするべきか」を毎日アプリが提示するため、子ども自身が全部覚えておく必要がない。「タスクを忘れてしまう」「どれから手をつければいいかわからない」という困りごとをアプリの構造でサポート。" },
            { icon: "💬", color: s.adhdIconStamina, title: "親子のポジティブな関わりを増やす", desc: "叱る・指示する場面を減らし、「クエスト承認」という形で親が子どもを認める機会を作る。承認・XP付与という肯定的な体験の積み重ねが、子どもの自己肯定感を育てる。" },
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
