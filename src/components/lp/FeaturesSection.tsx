type FeatureCard = {
  icon: string;
  title: string;
  desc: string;
  accent: string; // featureCard accent class key
  tag: string;
  tagClass: string; // featureTag color class key
};

type FeatureGroup = {
  heading: string;
  cards: FeatureCard[];
};

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    heading: "🐉 育てて、あつめる",
    cards: [
      {
        icon: "🥚",
        title: "卵から育てるモンスター",
        desc: "最初は1個の卵から。タスクをクリアして孵化させると、自分だけのモンスターに出会える。",
        accent: "fGold",
        tag: "MONSTER EVOLUTION",
        tagClass: "tagGold",
      },
      {
        icon: "📚💪🌿",
        title: "がんばりの傾向で進化が分岐",
        desc: "勉強（STUDY）・体力（STAMINA）・生活（LIFE）の3系統。こなしたタスクの傾向で進化先が変わる。",
        accent: "fStudy",
        tag: "STUDY / STAMINA / LIFE",
        tagClass: "tagStudy",
      },
      {
        icon: "🔄",
        title: "転生して、もう一周",
        desc: "最終形態まで育てたら転生。次の卵を自分で選んで、図鑑コンプリート（全79種）を目指す。",
        accent: "fLife",
        tag: "REBIRTH SYSTEM",
        tagClass: "tagLife",
      },
      {
        icon: "⚡🐾",
        title: "カッコいい系 or かわいい系",
        desc: "勇者系の「ヒーロー系」か、動物系の「どうぶつ系」か。好みのビジュアルスタイルを選べる。",
        accent: "fPurple",
        tag: "CHARACTER STYLE",
        tagClass: "tagPurple",
      },
      {
        icon: "💎",
        title: "ごほうび宝箱（必ず当たる）",
        desc: "頑張った日に宝箱が出現。親が登録した現実のごほうびが当たるか、外れても季節アイテムが必ず手に入る。",
        accent: "fPink",
        tag: "TREASURE",
        tagClass: "tagGold",
      },
      {
        icon: "📦",
        title: "季節コレクション 全80種",
        desc: "春夏秋冬×各20種のアイテム図鑑。宝箱から集めて、シーズン制覇バッジを狙う長期目標になる。",
        accent: "fLife",
        tag: "COLLECTION",
        tagClass: "tagLife",
      },
      {
        icon: "🏅",
        title: "100種類の実績バッジ",
        desc: "初クエスト・連続ログイン・転生回数など。「気づいたら達成していた」驚きが継続を後押しする。",
        accent: "fGold",
        tag: "BADGE SYSTEM",
        tagClass: "tagGold",
      },
    ],
  },
  {
    heading: "🔥 毎日つづく仕組み",
    cards: [
      {
        icon: "🔥",
        title: "ストリーク継続ボーナス",
        desc: "連続達成でストリーク加算、マイルストーンで追加XP。スキップも親が承認すれば途切れない。",
        accent: "fStamina",
        tag: "STREAK SYSTEM",
        tagClass: "tagStamina",
      },
      {
        icon: "🌅",
        title: "毎日ひらくだけのチェックイン",
        desc: "締切までにアプリを開くだけで成功。「まず開く」という一番小さな習慣から始められる。",
        accent: "fGold",
        tag: "CHECK-IN",
        tagClass: "tagGold",
      },
      {
        icon: "🙋",
        title: "「今日やる！」宣言ボーナス",
        desc: "手つかずが続いたタスクに宣言ボタンが出現。宣言してクリアすると追加XP。叱らずに再スタートを後押し。",
        accent: "fStamina",
        tag: "DECLARATION",
        tagClass: "tagStamina",
      },
      {
        icon: "📸",
        title: "写真添付でボーナスXP",
        desc: "完了＋期限内＋写真で最大3pt。証拠写真は親の承認画面にサムネイルで表示される。",
        accent: "fStudy",
        tag: "PHOTO BONUS",
        tagClass: "tagStudy",
      },
    ],
  },
  {
    heading: "👨‍👩‍👧 親子でつながる",
    cards: [
      {
        icon: "🔔",
        title: "双方向プッシュ通知",
        desc: "子どもの報告は親へ、親のリマインドは子どもへ。アプリを閉じていてもOS通知でつながる。",
        accent: "fPurple",
        tag: "PUSH NOTIFICATION",
        tagClass: "tagPurple",
      },
      {
        icon: "🌙",
        title: "承認し忘れても大丈夫",
        desc: "未承認の報告は翌日0時に自動承認。子どものXPは必ず確定するので、忙しい夜も罪悪感なく使える。",
        accent: "fLife",
        tag: "AUTO APPROVE",
        tagClass: "tagLife",
      },
      {
        icon: "💮",
        title: "承認スタンプで気持ちを届ける",
        desc: "承認にスタンプを添えると、子どもの画面でお祝い演出が再生。「見てもらえた」がゲームの中で伝わる。",
        accent: "fPink",
        tag: "APPROVAL STAMP",
        tagClass: "tagPurple",
      },
    ],
  },
];

export function FeaturesSection({ s }: { s: Record<string, string> }) {
  return (
    <section id="features" className={s.section}>
      <div className={s.container}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>FEATURES</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>続けるための仕組みが詰まっている</p>
        <div className={`${s.divider} ${s.fadeIn}`} />

        {FEATURE_GROUPS.map((group) => (
          <div key={group.heading} className={s.featureGroup}>
            <h3 className={`${s.featureGroupTitle} ${s.fadeIn}`}>{group.heading}</h3>
            <div className={s.featuresGrid}>
              {group.cards.map((card) => (
                <div
                  key={card.title}
                  className={`${s.featureCard} ${s[card.accent]} ${s.fadeIn}`}
                >
                  <div className={s.featureIcon}>{card.icon}</div>
                  <div className={s.featureTitle}>{card.title}</div>
                  <p className={s.featureDesc}>{card.desc}</p>
                  <span className={`${s.featureTag} ${s[card.tagClass]}`}>{card.tag}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
