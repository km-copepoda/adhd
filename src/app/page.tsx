"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./lp.module.css";
import { Share } from "next/font/google";

type MonsterStyle = "dark" | "light";

/** モンスター画像コンポーネント（読み込み失敗時は絵文字フォールバック） */
function MonsterImg({
  src,
  alt,
  fallback,
  style,
}: {
  src: string;
  alt: string;
  fallback: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span style={{ fontSize: "28px", ...style }}>{fallback}</span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}

export default function LpPage() {
  const [monsterStyle, setMonsterStyle] = useState<MonsterStyle>("dark");
  const lpRef = useRef<HTMLDivElement>(null);

  // Scroll fade-in via IntersectionObserver
  useEffect(() => {
    const root = lpRef.current;
    if (!root) return;
    const elements = root.querySelectorAll(`.${styles.fadeIn}`);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.visible);
          }
        });
      },
      { threshold: 0.1 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.lpRoot} ref={lpRef}>
      {/* ===== NAV ===== */}
      <nav className={styles.nav}>
        <a href="#" className={styles.navLogo}>QuestBoard</a>
        <ul className={styles.navLinks}>
          <li><a href="#features">機能</a></li>
          <li><a href="#monsters">モンスター</a></li>
          <li><a href="#habit">続ける仕組み</a></li>
          <li><a href="#screens">画面紹介</a></li>
          <li><a href="#install">インストール</a></li>
          <li>
            <a href="#cta" className={`${styles.btnOutline} ${styles.navCta}`}>
              はじめる
            </a>
          </li>
        </ul>
      </nav>

      {/* ===== HERO ===== */}
      <section className={styles.hero}>
        <div className={`${styles.orb} ${styles.heroOrb1}`} />
        <div className={`${styles.orb} ${styles.heroOrb2}`} />

        <div className={styles.heroBadge}>✦ 子どもの習慣化 × ゲーミフィケーション</div>
        <div className={styles.heroEgg}>🥚</div>
        <h1 className={styles.heroTitle}>QuestBoard</h1>
        <p className={styles.heroCatchcopy}>クエストをクリアして、モンスターを育てよう</p>
        <p className={styles.heroSub}>
          子どものタスクをクエストに変える。<br />
          毎日のルーティンがゲームになれば、<br />
          やる気は自然と続いていく。
        </p>
        <div className={styles.heroCta}>
          <Link href="/login" className={styles.btnGold}>⚔ 冒険をはじめる</Link>
          <a href="#features" className={styles.btnOutline}>👀 もっと見る</a>
        </div>
        <div className={styles.heroScroll}>SCROLL</div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how" className={styles.section}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionHeading} ${styles.fadeIn}`}>HOW IT WORKS</h2>
          <p className={`${styles.sectionSub} ${styles.fadeIn}`}>たった4ステップで、習慣化が楽しくなる</p>
          <div className={`${styles.divider} ${styles.fadeIn}`} />

          <div className={styles.stepsGrid}>
            {[
              { n: "01", icon: "📋", title: "親がクエストを設定", desc: "「宿題をする」「歯磨きをする」といった日常タスクをクエストとして登録。曜日ごとの繰り返しや一時クエストも設定できる。" },
              { n: "02", icon: "⚔", title: "子どもがクリア＆報告", desc: "子ども用画面でクエストをタップしてクリア報告。写真を添付するとボーナス XP ゲット！期限内報告でもボーナス。" },
              { n: "03", icon: "✅", title: "親が承認・プッシュ通知", desc: "報告が届くとプッシュ通知。ワンタップで承認するとXPが確定。未承認のまま翌日を迎えると自動承認される。" },
              { n: "04", icon: "🐉", title: "XP でモンスターが進化・転生", desc: "XP が貯まるとモンスターが成長・進化。最終形態に達すると「転生ボタン」が出現。勉強・体力・生活力の卵を自分で選んで次サイクルをスタート！選んだ卵の系統は進化確率+20%のボーナス。全79種コレクション＋100種の実績バッジを目指そう。" },
            ].map((step, i) => (
              <div key={i} className={`${styles.stepCard} ${styles.fadeIn}`}>
                <div className={styles.stepNumber}>{step.n}</div>
                <div className={styles.stepIcon}>{step.icon}</div>
                <div className={styles.stepTitle}>{step.title}</div>
                <p className={styles.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className={styles.section}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionHeading} ${styles.fadeIn}`}>FEATURES</h2>
          <p className={`${styles.sectionSub} ${styles.fadeIn}`}>続けるための仕組みが詰まっている</p>
          <div className={`${styles.divider} ${styles.fadeIn}`} />

          <div className={styles.featuresGrid}>
            <div className={`${styles.featureCard} ${styles.fGold} ${styles.fadeIn}`}>
              <div className={styles.featureIcon}>🥚</div>
              <div className={styles.featureTitle}>卵から育てるモンスター</div>
              <p className={styles.featureDesc}>最初は卵から。タスクを1つクリアして孵化させると、初めて自分だけのモンスターに出会える。愛着形成から始まるゲーム体験。</p>
              <span className={`${styles.featureTag} ${styles.tagGold}`}>MONSTER EVOLUTION</span>
            </div>

            <div className={`${styles.featureCard} ${styles.fStudy} ${styles.fadeIn}`}>
              <div className={styles.featureIcon}>📚💪🌿</div>
              <div className={styles.featureTitle}>3系統パラメータ連動進化</div>
              <p className={styles.featureDesc}>学力（STUDY）・体力（STAMINA）・生活力（LIFE）の3カテゴリ。こなしたタスクの傾向に応じて進化先が確率的に分岐。</p>
              <span className={`${styles.featureTag} ${styles.tagStudy}`}>STUDY / STAMINA / LIFE</span>
            </div>

            <div className={`${styles.featureCard} ${styles.fLife} ${styles.fadeIn}`}>
              <div className={styles.featureIcon}>🔄</div>
              <div className={styles.featureTitle}>手動転生 × 卵選択ボーナス</div>
              <p className={styles.featureDesc}>最終形態に到達すると「転生ボタン」が出現。子どもが自分のタイミングで次サイクルを開始できる。卵の種類（勉強・体力・生活力）を選ぶと、その系統の進化確率に+20%ボーナス。過去のモンスターは図鑑に記録され、全79種コンプリートが長期目標になる。</p>
              <span className={`${styles.featureTag} ${styles.tagLife}`}>REBIRTH SYSTEM</span>
            </div>

            <div className={`${styles.featureCard} ${styles.fStamina} ${styles.fadeIn}`}>
              <div className={styles.featureIcon}>🔥</div>
              <div className={styles.featureTitle}>ストリーク継続ボーナス</div>
              <p className={styles.featureDesc}>タスクをこなした日が連続するほどストリーク加算。マイルストーンで追加 XP ボーナス。スキップも親が承認すればストリーク継続。</p>
              <span className={`${styles.featureTag} ${styles.tagStamina}`}>STREAK SYSTEM</span>
            </div>

            <div className={`${styles.featureCard} ${styles.fPurple} ${styles.fadeIn}`}>
              <div className={styles.featureIcon}>🔔</div>
              <div className={styles.featureTitle}>双方向プッシュ通知</div>
              <p className={styles.featureDesc}>子どもの報告→親へ通知。親から子どもへリマインド送信も可。アプリを閉じていても OS 通知でリアルタイム連携。</p>
              <span className={`${styles.featureTag} ${styles.tagPurple}`}>PUSH NOTIFICATION</span>
            </div>

            <div className={`${styles.featureCard} ${styles.fLife} ${styles.fadeIn}`}>
              <div className={styles.featureIcon}>🌙</div>
              <div className={styles.featureTitle}>日をまたいでも自動で処理</div>
              <p className={styles.featureDesc}>親が承認し忘れた報告は翌日0時（JST）に自動承認。子どもの XP は必ず確定するので「今夜は確認できなかった…」という罪悪感なく使えます。忙しい日でもアプリが家族をサポートします。</p>
              <span className={`${styles.featureTag} ${styles.tagLife}`}>AUTO APPROVE</span>
            </div>

            <div className={`${styles.featureCard} ${styles.fPink} ${styles.fadeIn}`}>
              <div className={styles.featureIcon}>📸</div>
              <div className={styles.featureTitle}>写真添付でボーナス XP</div>
              <p className={styles.featureDesc}>タスク完了の証拠写真を添付すると追加 XP。完了・期限内・写真の3要素で最大3pt 獲得。写真は親の承認画面でサムネイル表示。</p>
              <span className={`${styles.featureTag} ${styles.tagGold}`}>PHOTO BONUS</span>
            </div>

            <div className={`${styles.featureCard} ${styles.fPurple} ${styles.fadeIn}`}>
              <div className={styles.featureIcon}>⚡🐾</div>
              <div className={styles.featureTitle}>カッコいい系 or かわいい系を選べる</div>
              <p className={styles.featureDesc}>モンスターのビジュアルスタイルをふたつから選択。勇者・戦士系のカッコいい「ヒーロー系」か、動物・ファンタジー系のかわいい「どうぶつ系」か。好みのスタイルで39種×2 + 卵1 = 全79種のコレクション。</p>
              <span className={`${styles.featureTag} ${styles.tagPurple}`}>CHARACTER STYLE</span>
            </div>

            <div className={`${styles.featureCard} ${styles.fGold} ${styles.fadeIn}`}>
              <div className={styles.featureIcon}>🏅</div>
              <div className={styles.featureTitle}>100種類の実績バッジ</div>
              <p className={styles.featureDesc}>初クエスト・連続ログイン・写真撮影・転生回数など多彩な条件で100種類のバッジを解除。「気づいたら達成していた」という小さな驚きが積み重なり、継続するモチベーションをさらに後押しする。</p>
              <span className={`${styles.featureTag} ${styles.tagGold}`}>BADGE SYSTEM</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MONSTER COLLECTION ===== */}
      <section id="monsters" className={`${styles.section} ${styles.monsterSection}`}>
        <div className={`${styles.orb} ${styles.monsterOrbM1}`} />
        <div className={`${styles.orb} ${styles.monsterOrbM2}`} />
        <div className={styles.container} style={{ position: "relative", zIndex: 1 }}>
          <h2 className={`${styles.sectionHeading} ${styles.fadeIn}`}>MONSTER COLLECTION</h2>
          <p className={`${styles.sectionSub} ${styles.fadeIn}`}>3系統 × 2スタイル × ステージ3 = 全79種類のモンスターたち</p>
          <div className={`${styles.divider} ${styles.fadeIn}`} />

          {/* スタイル切り替えトグル */}
          <div className={`${styles.styleToggleWrap} ${styles.fadeIn}`}>
            <button
              type="button"
              className={`${styles.styleToggleBtn} ${monsterStyle === "dark" ? styles.activeDark : ""}`}
              onClick={() => setMonsterStyle("dark")}
            >
              ⚡ カッコいい系（ヒーロー）
            </button>
            <button
              type="button"
              className={`${styles.styleToggleBtn} ${monsterStyle === "light" ? styles.activeLight : ""}`}
              onClick={() => setMonsterStyle("light")}
            >
              🐾 かわいい系（どうぶつ）
            </button>
          </div>

          {/* カッコいい系（DARK） */}
          {monsterStyle === "dark" && (
            <div className={styles.monsterPaths}>
              {/* STUDY系 */}
              <MonsterPath
                label={{ text: "📚 学力系", colorClass: styles.pathLabelStudy }}
                s={styles}
                stage1={{ src: "/monsters/dark/STUDY_ラーン.webp", name: "ラーン", fallback: "📚" }}
                stage2={[
                  { src: "/monsters/dark/STUDY_STUDY_ライブラ.webp", name: "ライブラ", fallback: "📚", revealed: true },
                  { src: "/monsters/dark/STUDY_STAMINA_アーマード.webp", name: "？？？", fallback: "⚔️", revealed: false },
                  { src: "/monsters/dark/STUDY_LIFE_クリン.webp", name: "？？？", fallback: "✨", revealed: false },
                ]}
                stage3={[
                  { src: "/monsters/dark/STUDY_STUDY_STUDY_ウィズダム.webp", name: "？？？", fallback: "🧙", revealed: false },
                  { src: "/monsters/dark/STUDY_STAMINA_STAMINA_イージス.webp", name: "？？？", fallback: "🛡️", revealed: false },
                  { src: "/monsters/dark/STUDY_LIFE_LIFE_セバス.webp", name: "？？？ ...", fallback: "🤖", revealed: false },
                ]}
              />
              {/* STAMINA系 */}
              <MonsterPath
                label={{ text: "💪 体力系", colorClass: styles.pathLabelStamina }}
                s={styles}
                stage1={{ src: "/monsters/dark/STAMINA_ストーン.webp", name: "ストーン", fallback: "💪" }}
                stage2={[
                  { src: "/monsters/dark/STAMINA_STAMINA_ブロック.webp", name: "ブロック", fallback: "🪨", revealed: true },
                  { src: "/monsters/dark/STAMINA_STUDY_グラビド.webp", name: "？？？", fallback: "🌀", revealed: false },
                  { src: "/monsters/dark/STAMINA_LIFE_わっしょい.webp", name: "？？？", fallback: "🎉", revealed: false },
                ]}
                stage3={[
                  { src: "/monsters/dark/STAMINA_STAMINA_STAMINA_ゴッドストーン.webp", name: "？？？", fallback: "⛰️", revealed: false },
                  { src: "/monsters/dark/STAMINA_STAMINA_STUDY_ガイア.webp", name: "？？？", fallback: "🌍", revealed: false },
                  { src: "/monsters/dark/STAMINA_LIFE_LIFE_ミコシ.webp", name: "？？？ ...", fallback: "🏮", revealed: false },
                ]}
              />
              {/* LIFE系 */}
              <MonsterPath
                label={{ text: "🌿 生活力系", colorClass: styles.pathLabelLife }}
                s={styles}
                stage1={{ src: "/monsters/dark/LIFE_ヘルプ.webp", name: "ヘルプ", fallback: "🌿" }}
                stage2={[
                  { src: "/monsters/dark/LIFE_LIFE_マザー.webp", name: "マザー", fallback: "🌿", revealed: true },
                  { src: "/monsters/dark/LIFE_STUDY_チックタック.webp", name: "？？？", fallback: "⏰", revealed: false },
                  { src: "/monsters/dark/LIFE_STAMINA_キャリア.webp", name: "？？？", fallback: "📦", revealed: false },
                ]}
                stage3={[
                  { src: "/monsters/dark/LIFE_LIFE_LIFE_ゴッドセバス.webp", name: "？？？", fallback: "👑", revealed: false },
                  { src: "/monsters/dark/LIFE_STUDY_STUDY_カレンダー.webp", name: "？？？", fallback: "📅", revealed: false },
                  { src: "/monsters/dark/LIFE_STAMINA_LIFE_ナース.webp", name: "？？？ ...", fallback: "🏥", revealed: false },
                ]}
              />
            </div>
          )}

          {/* かわいい系（LIGHT） */}
          {monsterStyle === "light" && (
            <div className={styles.monsterPaths}>
              {/* STUDY系 */}
              <MonsterPath
                label={{ text: "📚 学力系", colorClass: styles.pathLabelStudy }}
                s={styles}
                stage1={{ src: "/monsters/light/STUDY_ルミナ.webp", name: "ルミナ", fallback: "📚" }}
                stage2={[
                  { src: "/monsters/light/STUDY_STUDY_インテリキャット.webp", name: "インテリキャット", fallback: "🐱", revealed: true },
                  { src: "/monsters/light/STUDY_STAMINA_クリスタルバード.webp", name: "？？？", fallback: "🐦", revealed: false },
                  { src: "/monsters/light/STUDY_LIFE_インクペンギン.webp", name: "？？？", fallback: "🐧", revealed: false },
                ]}
                stage3={[
                  { src: "/monsters/light/STUDY_STUDY_STUDY_大魔導士プラチナキャット.webp", name: "？？？", fallback: "🐱", revealed: false },
                  { src: "/monsters/light/STUDY_STAMINA_STAMINA_空の覇者グリフォン.webp", name: "？？？", fallback: "🦅", revealed: false },
                  { src: "/monsters/light/STUDY_LIFE_LIFE_調香師のリス.webp", name: "？？？ ...", fallback: "🐿️", revealed: false },
                ]}
              />
              {/* STAMINA系 */}
              <MonsterPath
                label={{ text: "💪 体力系", colorClass: styles.pathLabelStamina }}
                s={styles}
                stage1={{ src: "/monsters/light/STAMINA_アクティ.webp", name: "アクティ", fallback: "💪" }}
                stage2={[
                  { src: "/monsters/light/STAMINA_STAMINA_ブレイブレオ.webp", name: "ブレイブレオ", fallback: "🦁", revealed: true },
                  { src: "/monsters/light/STAMINA_STUDY_スカウトフォックス.webp", name: "？？？", fallback: "🦊", revealed: false },
                  { src: "/monsters/light/STAMINA_LIFE_レスキューパピー.webp", name: "？？？", fallback: "🐶", revealed: false },
                ]}
                stage3={[
                  { src: "/monsters/light/STAMINA_STAMINA_STAMINA_太陽の黄金龍.webp", name: "？？？", fallback: "🐉", revealed: false },
                  { src: "/monsters/light/STAMINA_STAMINA_STUDY_真実の聖騎士・レオ.webp", name: "？？？", fallback: "🦁", revealed: false },
                  { src: "/monsters/light/STAMINA_LIFE_LIFE_忠義の守護柴犬.webp", name: "？？？ ...", fallback: "🐕", revealed: false },
                ]}
              />
              {/* LIFE系 */}
              <MonsterPath
                label={{ text: "🌿 生活力系", colorClass: styles.pathLabelLife }}
                s={styles}
                stage1={{ src: "/monsters/light/LIFE_メルル.webp", name: "メルル", fallback: "🌿" }}
                stage2={[
                  { src: "/monsters/light/LIFE_LIFE_コットンラム.webp", name: "コットンラム", fallback: "🐑", revealed: true },
                  { src: "/monsters/light/LIFE_STUDY_ミントアライグマ.webp", name: "？？？", fallback: "🦝", revealed: false },
                  { src: "/monsters/light/LIFE_STAMINA_ポポパンダ.webp", name: "？？？", fallback: "🐼", revealed: false },
                ]}
                stage3={[
                  { src: "/monsters/light/LIFE_LIFE_LIFE_慈愛の聖母ラム.webp", name: "？？？", fallback: "🐑", revealed: false },
                  { src: "/monsters/light/LIFE_STUDY_STUDY_薬剤師のシロクマ.webp", name: "？？？", fallback: "🐻‍❄️", revealed: false },
                  { src: "/monsters/light/LIFE_STAMINA_LIFE_陽だまりのカピバラ.webp", name: "？？？ ...", fallback: "🐾", revealed: false },
                ]}
              />
            </div>
          )}

          <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
            <div className={`${styles.monsterCountBadge} ${styles.fadeIn}`}>
              <span>🥚</span>
              <span>卵 1 + (stage1 <strong>3</strong> + stage2 <strong>9</strong> + stage3 <strong>27</strong>) × 2スタイル = 合計<strong>79</strong>種</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HABIT DESIGN ===== */}
      <section id="habit" className={`${styles.section} ${styles.adhdSection}`}>
        <div className={`${styles.orb} ${styles.adhdOrbA1}`} />
        <div className={styles.container}>
          <h2 className={`${styles.sectionHeading} ${styles.fadeIn}`}>HABIT DESIGN</h2>
          <p className={`${styles.sectionSub} ${styles.fadeIn}`}>続けたくなる設計が詰まっている。集中しにくい・動き出しが苦手なお子さんにも特に効果的。</p>
          <div className={`${styles.divider} ${styles.fadeIn}`} />

          <div className={styles.adhdGrid}>
            {[
              { icon: "⚡", color: styles.adhdIconGold,    title: "即時フィードバック", desc: "タスク完了→承認→XP 確定のフローを最短化。自動承認機能で翌日0時に未承認分を一括処理するため、フィードバック遅延によるモチベーション低下を防ぐ。" },
              { icon: "📋", color: styles.adhdIconStudy,   title: "シンプルな今日のタスク", desc: "子ども画面に表示されるのは「今日のクエスト」のみ。先のタスクで圧倒されず、今日やることだけに集中できる。" },
              { icon: "🔔", color: styles.adhdIconStamina, title: "具体的なリマインド通知", desc: "「アプリを見て」ではなく「宿題がまだ終わってないよ！」と具体的なタスク名で通知。子どもは抽象的な指示より具体的な行動指示で動きやすい。" },
              { icon: "🔄", color: styles.adhdIconLife,    title: "短いフィードバックループ", desc: "転生サイクルを約8〜10日に設定。長期目標より短期の達成感が、子どもにとって続けるモチベーションになる。卵→孵化→進化×3→転生のスプリント設計。" },
              { icon: "🤝", color: styles.adhdIconPurple,  title: "子どもの自発性を尊重", desc: "子どもが自分でタスクを追加し、親が承認する仕組み。自己管理の練習になりながら、親の監督権限も維持する適切なバランス。" },
              { icon: "⏭", color: styles.adhdIconPink,    title: "スキップにも親承認フロー", desc: "「今日はできない」と正直に申告してスキップを申請。親が承認すればストリーク継続。子どものコンディションに寄り添いつつ、安易なスキップを防ぐ。" },
              { icon: "⏱", color: styles.adhdIconGold,    title: "時間の見える化", desc: "子どもは「もうこんな時間！」となりがち。報告期限を子どもごとに設定でき、期限内に報告するとボーナス XP が得られるため、「今日の締め切り」を自然に意識するきっかけになる。" },
              { icon: "🎯", color: styles.adhdIconStudy,   title: "多段階の小さな達成感", desc: "タスク完了（+1pt）、期限内報告（+1pt）、写真ボーナス（+1pt）と報酬トリガーを複数設定。ログインストリーク達成でも追加 XP。さらに100種の実績バッジが「気づいたら達成！」という驚きを加え、1日に何度も「できた！」が積み重なる設計。" },
              { icon: "⚔", color: styles.adhdIconLife,    title: "「クエスト」形式でタスク開始のハードルを下げる", desc: "「宿題をやりなさい」より「クエストをクリアしよう！」の方が子どもは動きやすい。ゲームとしてのフレーミングが先延ばしを抑制し、自発的なタスク開始を促す。" },
              { icon: "🧠", color: styles.adhdIconPurple,  title: "やること一覧をアプリが管理", desc: "「何をするべきか」を毎日アプリが提示するため、子ども自身が全部覚えておく必要がない。「タスクを忘れてしまう」「どれから手をつければいいかわからない」という困りごとをアプリの構造でサポート。" },
              { icon: "💬", color: styles.adhdIconStamina, title: "親子のポジティブな関わりを増やす", desc: "叱る・指示する場面を減らし、「クエスト承認」という形で親が子どもを認める機会を作る。承認・XP付与という肯定的な体験の積み重ねが、子どもの自己肯定感を育てる。" },
            ].map((item, i) => (
              <div key={i} className={`${styles.adhdPoint} ${styles.fadeIn}`}>
                <div className={`${styles.adhdIcon} ${item.color}`}>{item.icon}</div>
                <div className={styles.adhdContent}>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== APP SCREENS ===== */}
      <section id="screens" className={`${styles.section} ${styles.screensSection}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionHeading} ${styles.fadeIn}`}>APP SCREENS</h2>
          <p className={`${styles.sectionSub} ${styles.fadeIn}`}>子ども画面と親画面の2ロール構成</p>
          <div className={`${styles.divider} ${styles.fadeIn}`} />

          <div className={styles.screensShowcase}>
            {/* 子ども: 今日のクエスト */}
            <div className={`${styles.phoneWrap} ${styles.fadeIn}`}>
              <div className={styles.phoneLabel}>⚔ 子ども — 今日のクエスト</div>
              <div className={`${styles.phone} ${styles.phoneLarge}`}>
                <div className={`${styles.screen} ${styles.screenLarge}`}>
                  <div className={styles.sHeader}>
                    <div className={styles.sTitle}>TODAY&apos;S QUEST</div>
                    <div className={styles.sXp}>🔥 3日連続</div>
                  </div>
                  <div className={styles.sMonsterArea}>
                    <MonsterImg
                      src="/monsters/dark/STUDY_ラーン.webp"
                      alt="ラーン"
                      fallback="📚"
                      style={{ width: 80, height: 80, objectFit: "contain", animation: "float 3s ease-in-out infinite", filter: "drop-shadow(0 4px 20px rgba(167,139,250,0.3))" }}
                    />
                    <div className={styles.sMonsterName}>ラーン Lv.2</div>
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--dim)" }}>
                        <span>次の進化まで</span>
                        <span style={{ color: "var(--gold)" }}>6/10 pt</span>
                      </div>
                      <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                        <div className={styles.fillEvolve} style={{ width: "60%", height: "100%", borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.pEvoBar}>
                    {[
                      { label: "📚学力", cls: styles.fillStudy, w: "70%", val: 7 },
                      { label: "💪体力", cls: styles.fillStamina, w: "30%", val: 3 },
                      { label: "🌿生活", cls: styles.fillLife, w: "50%", val: 5 },
                    ].map((b) => (
                      <div key={b.label} className={styles.pEvoBarRow}>
                        <div className={styles.pEvoLabel}>{b.label}</div>
                        <div className={styles.pEvoBg}><div className={`${styles.pEvoFill} ${b.cls}`} style={{ width: b.w }} /></div>
                        <div className={styles.pEvoVal}>{b.val}</div>
                      </div>
                    ))}
                  </div>
                  <div className={styles.sSectionLabel}>今日のクエスト</div>
                  <div className={styles.sQuestList}>
                    <div className={`${styles.sQuestItem} ${styles.sQuestItemDone}`}>
                      <div className={`${styles.sCheck} ${styles.sCheckChecked}`}>✓</div>
                      <div className={`${styles.sQuestIcon} ${styles.iconLife}`}>🌿</div>
                      <div className={styles.sQuestText}>歯磨きをする</div>
                      <div className={styles.sQuestXp}>+1</div>
                    </div>
                    {[
                      { icon: "📚", text: "宿題をする", xp: "+2", iconCls: styles.iconStudy },
                      { icon: "💪", text: "公園で遊ぶ", xp: "+1", iconCls: styles.iconStamina },
                      { icon: "🌿", text: "お風呂に入る", xp: "+1", iconCls: styles.iconLife },
                    ].map((q) => (
                      <div key={q.text} className={styles.sQuestItem}>
                        <div className={styles.sCheck} />
                        <div className={`${styles.sQuestIcon} ${q.iconCls}`}>{q.icon}</div>
                        <div className={styles.sQuestText}>{q.text}</div>
                        <div className={styles.sQuestXp}>{q.xp}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 親: 承認センター */}
            <div className={`${styles.phoneWrap} ${styles.fadeIn}`}>
              <div className={styles.phoneLabel}>👨‍👩‍👧 親 — 承認センター</div>
              <div className={`${styles.phone} ${styles.phoneLarge}`}>
                <div className={`${styles.screen} ${styles.screenLarge}`}>
                  <div className={styles.sHeader}>
                    <div className={styles.sTitle}>APPROVE</div>
                    <div style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "var(--stamina)", fontSize: 9, padding: "3px 8px", borderRadius: 20 }}>3件待ち</div>
                  </div>
                  <div className={styles.notifyBubble}>
                    <div className={styles.notifyDot} />
                    <div className={styles.notifyText}>もも が「宿題をする」を報告</div>
                    <div className={styles.notifyTime}>今</div>
                  </div>
                  <div className={styles.sSectionLabel}>承認待ち</div>
                  <div className={styles.sApproveItem}>
                    <div className={styles.sApproveRow}>
                      <div>
                        <div className={styles.sApproveName}>📚 宿題をする</div>
                        <div className={styles.sApproveTask}>もも • 写真あり 📸</div>
                      </div>
                      <div className={styles.sApproveBtns}>
                        <button type="button" className={styles.sBtnOk}>承認 ✓</button>
                        <button type="button" className={styles.sBtnNg}>差戻</button>
                      </div>
                    </div>
                  </div>
                  <div className={styles.sApproveItem}>
                    <div className={styles.sApproveRow}>
                      <div>
                        <div className={styles.sApproveName}>💪 公園で遊ぶ</div>
                        <div className={styles.sApproveTask}>はな • 完了報告</div>
                      </div>
                      <div className={styles.sApproveBtns}>
                        <button type="button" className={styles.sBtnOk}>承認 ✓</button>
                        <button type="button" className={styles.sBtnNg}>差戻</button>
                      </div>
                    </div>
                  </div>
                  <div className={styles.sApproveItem} style={{ borderLeftColor: "var(--stamina)" }}>
                    <div className={styles.sApproveRow}>
                      <div>
                        <div className={styles.sApproveName} style={{ color: "var(--stamina)" }}>⏭ 習い事をスキップ申請</div>
                        <div className={styles.sApproveTask}>もも • 体調不良</div>
                      </div>
                      <div className={styles.sApproveBtns}>
                        <button type="button" className={styles.sBtnOk}>承認 ✓</button>
                        <button type="button" className={styles.sBtnNg}>却下</button>
                      </div>
                    </div>
                  </div>
                  <div className={styles.sSectionLabel}>今日の完了</div>
                  <div style={{ fontSize: 10, color: "var(--dim)", background: "var(--card2)", borderRadius: 10, padding: 10, textAlign: "center" }}>
                    <span style={{ color: "var(--life)" }}>✓ 2件承認済み</span>
                    &nbsp;/&nbsp;
                    <span style={{ color: "var(--dim)" }}>⏭ 1件スキップ</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <button type="button" style={{ flex: 1, background: "rgba(240,192,64,0.1)", border: "1px solid rgba(240,192,64,0.25)", color: "var(--gold)", fontSize: 9, padding: 6, borderRadius: 8, cursor: "pointer" }}>
                      🔔 リマインドを送る
                    </button>
                    <button type="button" style={{ flex: 1, background: "var(--card2)", border: "1px solid var(--border)", color: "var(--dim)", fontSize: 9, padding: 6, borderRadius: 8, cursor: "pointer" }}>
                      📋 タスク管理
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 子ども: 実績バッジ */}
            <div className={`${styles.phoneWrap} ${styles.fadeIn}`}>
              <div className={styles.phoneLabel}>🏅 子ども — 実績バッジ</div>
              <div className={`${styles.phone} ${styles.phoneLarge}`}>
                <div className={`${styles.screen} ${styles.screenLarge}`}>
                  <div className={styles.sHeader}>
                    <div className={styles.sTitle}>BADGES</div>
                    <div className={styles.sXp}>🏅 12 / 100</div>
                  </div>
                  {/* 新バッジ解除演出 */}
                  <div className={styles.notifyBubble} style={{ background: "rgba(240,192,64,0.1)", borderLeft: "3px solid var(--gold)" }}>
                    <div className={styles.notifyDot} style={{ background: "var(--gold)" }} />
                    <div className={styles.notifyText} style={{ color: "var(--gold)" }}>🏅 新バッジ解除！「3日連続クリア」</div>
                  </div>
                  <div className={styles.sSectionLabel}>最近の解除</div>
                  {/* バッジ一覧 */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {[
                      { icon: "⚔", label: "初クリア", unlocked: true },
                      { icon: "🔥", label: "3日連続", unlocked: true },
                      { icon: "📸", label: "写真初投稿", unlocked: true },
                      { icon: "🥚", label: "孵化！", unlocked: true },
                      { icon: "📚", label: "宿題10回", unlocked: true },
                      { icon: "🌟", label: "7日連続", unlocked: false },
                      { icon: "🔄", label: "初転生", unlocked: false },
                      { icon: "💪", label: "体力30pt", unlocked: false },
                    ].map((b, i) => (
                      <div key={i} style={{
                        background: b.unlocked ? "rgba(240,192,64,0.1)" : "var(--card2)",
                        border: `1px solid ${b.unlocked ? "rgba(240,192,64,0.4)" : "var(--border)"}`,
                        borderRadius: 8,
                        padding: "6px 2px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                        opacity: b.unlocked ? 1 : 0.4,
                      }}>
                        <span style={{ fontSize: 18, filter: b.unlocked ? "none" : "grayscale(1)" }}>{b.icon}</span>
                        <span style={{ fontSize: 7, color: b.unlocked ? "var(--gold)" : "var(--dim)", textAlign: "center", lineHeight: 1.2 }}>{b.unlocked ? b.label : "？？？"}</span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.sSectionLabel}>進捗</div>
                  <div style={{ background: "var(--card2)", borderRadius: 8, padding: 8, fontSize: 9, color: "var(--dim)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>全100バッジ達成まで</span>
                      <span style={{ color: "var(--gold)" }}>12%</span>
                    </div>
                    <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: "12%", height: "100%", background: "var(--gold)", borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 子ども: モンスター育成 */}
            <div className={`${styles.phoneWrap} ${styles.fadeIn}`}>
              <div className={styles.phoneLabel}>🐉 子ども — モンスター育成</div>
              <div className={`${styles.phone} ${styles.phoneLarge}`}>
                <div className={`${styles.screen} ${styles.screenLarge}`}>
                  <div className={styles.sHeader}>
                    <div className={styles.sTitle}>MONSTER</div>
                    <div className={styles.sXp}>Total 15pt</div>
                  </div>
                  <div className={styles.sMonsterArea} style={{ padding: "20px 0" }}>
                    <MonsterImg
                      src="/monsters/dark/STUDY_STUDY_ライブラ.webp"
                      alt="ライブラ"
                      fallback="📚"
                      style={{ width: 100, height: 100, objectFit: "contain", animation: "float 3s ease-in-out infinite", filter: "drop-shadow(0 4px 20px rgba(167,139,250,0.3))" }}
                    />
                    <div className={styles.sMonsterName} style={{ fontSize: 15 }}>ライブラ</div>
                    <div style={{ fontSize: 10, color: "var(--dim)" }}>stage 2 / 学力系</div>
                    <div style={{ width: "100%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--dim)", marginBottom: 4 }}>
                        <span>進化まで</span><span style={{ color: "var(--gold)" }}>8/30 pt</span>
                      </div>
                      <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                        <div className={styles.fillEvolve} style={{ width: "27%", height: "100%", borderRadius: 4 }} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.pEvoBar}>
                    {[
                      { label: "📚学力", cls: styles.fillStudy, w: "80%", val: 12 },
                      { label: "💪体力", cls: styles.fillStamina, w: "20%", val: 3 },
                      { label: "🌿生活", cls: styles.fillLife, w: "40%", val: 6 },
                    ].map((b) => (
                      <div key={b.label} className={styles.pEvoBarRow}>
                        <div className={styles.pEvoLabel}>{b.label}</div>
                        <div className={styles.pEvoBg}><div className={`${styles.pEvoFill} ${b.cls}`} style={{ width: b.w }} /></div>
                        <div className={styles.pEvoVal}>{b.val}</div>
                      </div>
                    ))}
                  </div>
                  <div className={styles.sStreak}>
                    <div className={styles.sStreakIcon}>🔥</div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div className={styles.sStreakNum}>7</div>
                      <div className={styles.sStreakLabel}>日連続クリア中</div>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "var(--gold)" }}>ベスト 12日</div>
                      <div style={{ fontSize: 9, color: "var(--dim)" }}>今月 18/30日</div>
                    </div>
                  </div>
                  <div className={styles.sSectionLabel}>コレクション</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[
                      { src: "/monsters/dark/STUDY_ラーン.webp", name: "ラーン", fallback: "📚", gold: false },
                      { src: "/monsters/dark/STUDY_STUDY_ライブラ.webp", name: "ライブラ", fallback: "📖", gold: true },
                    ].map((m) => (
                      <div key={m.name} style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 8, padding: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <MonsterImg src={m.src} alt={m.name} fallback={m.fallback} style={{ width: 32, height: 32, objectFit: "contain" }} />
                        <div style={{ fontSize: 8, color: m.gold ? "var(--gold)" : "var(--dim)" }}>{m.gold ? `${m.name} ★` : m.name}</div>
                      </div>
                    ))}
                    {[0, 1].map((i) => (
                      <div key={i} style={{ background: "var(--border)", borderRadius: 8, padding: 6, width: 48, height: 52, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.3 }}>
                        <span style={{ fontSize: 18 }}>?</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== INSTALL GUILD ===== */}
      <InstallGuideSection s={styles} />

      {/* ===== TESTIMONIALS ===== */}
      <section className={styles.section}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionHeading} ${styles.fadeIn}`}>VOICES</h2>
          <p className={`${styles.sectionSub} ${styles.fadeIn}`}>使ってみた保護者の声（想定）</p>
          <div className={`${styles.divider} ${styles.fadeIn}`} />
          <div className={styles.testimonialsGrid}>
            {[
              { stars: "★★★★★", text: "毎日「宿題やった？」と言い続けていたのが嘘のように、子どもが自分から動くようになりました。モンスターを進化させたいという気持ちが強くて。", avatar: "👩", name: "Aさん", role: "8歳の子を持つ保護者" },
              { stars: "★★★★★", text: "子どもが ADHD 傾向があり、タスク管理に悩んでいました。「今日のクエスト」だけが見えるシンプルな設計が、うちの子にはぴったりでした。", avatar: "👨", name: "Bさん", role: "10歳の子を持つ保護者" },
              { stars: "★★★★☆", text: "スキップ申請で子どもが「今日は体調が悪い」と自分で伝えてくれるようになったのが嬉しい。自分のコンディションを言語化する練習にもなっています。", avatar: "👩", name: "Cさん", role: "7歳・9歳の子を持つ保護者" },
            ].map((t, i) => (
              <div key={i} className={`${styles.testimonialCard} ${styles.fadeIn}`}>
                <div className={styles.testimonialQuote}>&ldquo;</div>
                <div className={styles.stars}>{t.stars}</div>
                <p className={styles.testimonialText}>{t.text}</p>
                <div className={styles.testimonialAuthor}>
                  <div className={styles.testimonialAvatar}>{t.avatar}</div>
                  <div>
                    <div className={styles.testimonialName}>{t.name}</div>
                    <div className={styles.testimonialRole}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section id="cta" className={`${styles.section} ${styles.ctaSection}`}>
        <div className={`${styles.orb} ${styles.ctaOrb}`} />
        <div className={styles.container}>
          <div className={styles.heroEgg} style={{ marginBottom: 16 }}>🥚</div>
          <h2 className={styles.ctaTitle}>さあ、冒険をはじめよう</h2>
          <p className={styles.ctaDesc}>
            子どもの習慣化をゲームに変える。<br />
            今日の小さなクエストが、明日の大きな力になる。
          </p>
          <div className={styles.ctaBtns}>
            <Link href="/login" className={styles.btnGold}>⚔ 無料ではじめる</Link>
            <Link href="/app/register" className={styles.btnOutline}>👨‍👩‍👧 保護者登録</Link>
          </div>
          <p className={styles.ctaNote}>ファミリーコードで子どもアカウントと連携。セットアップは5分。</p>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>QuestBoard</div>
        <p>© 2026 QuestBoard. All rights reserved.</p>
        <p style={{ marginTop: 8 }}>クエストをクリアして、モンスターを育てよう</p>
      </footer>
    </div>
  );
}

/* ===== InstallGuideSection サブコンポーネント ===== */
function InstallGuideSection({ s }: { s: typeof styles }) {
  const [deferredPrompt, setDeferredPrompt] = useState<
    (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null
  >(null);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = 
      /iPhone|iPod/.test(ua) ||
      /iPad/.test(ua) ||
      (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const android = /Android/.test(ua);
    setIsIos(ios);
    setIsAndroid(android);

    // すでにインストールされているか判定
    const standalone =
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone) ||
      window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalone(standalone);

     // Android / Chrome のbeforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as typeof deferredPrompt);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  //インストール済みなら非表示
  if (isStandalone) return null;

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  };

  return (
    <section id="install" className={`${s.section} ${s.installSection}`}>
      <div className={s.container}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>INSTALL</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>
          ホーム画面に追加して、アプリとして使おう
        </p>
        <div className={`${s.divider} ${s.fadeIn}`} />

        <div className={`${s.installCards} ${s.fadeIn}`}>
          {/* ---- iOS / iPad カード ---- */}
          <div className={`${s.installCard} ${isIos ? s.installCardHighlight : ""}`} >
            <div className={s.installCardIcon}>🍎</div>
            <div className={s.installCardTitle}>iPhone / iPad</div>
            <div className={s.installSteps}>
              <div className={s.installStep}>
                <span className={s.installStepNum}>1</span>
                <span>
                  <strong>Safari</strong> でこのページを開く
                </span>
              </div>
              <div className={s.installStep}>
                <span className={s.installStepNum}>2</span>
                <span>
                  画面下の{" "}
                  <span className={s.installShareIcon}>
                    <ShareIcon />
                  </span>{" "}
                  共有ボタンをタップ
                </span>
              </div>
              <div className={s.installStep}>
                <span className={s.installStepNum}>3</span>
                <span>
                  「<span className={s.installHighlightText}>ホーム画面に追加</span>」を選択
                </span>
              </div>
            </div>
            {isIos && (
              <div className={s.installHint} style={{ marginTop: 8, fontSize: 11 }}>
                ※「ホーム画面に追加」が見つからない場合は「もっと見る」をタップしてください
              </div>
            )}
          </div>

          {/* ---- Android カード ---- */}
          <div className={`${s.installCard} ${isAndroid ? s.installCardHighlight : ""}`} >
            <div className={s.installCardIcon}>🤖</div>
            <div className={s.installCardTitle}>Android</div>
            {deferredPrompt ? (
              <>
                <div className={s.installSteps}>
                  <div className={s.installStep}>
                    <span className={s.installStepNum}>✓</span>
                    <span>ワンタップでインストールできます</span>
                  </div>
                </div>
                <div className={s.installBtnWrap}>
                  <button
                    type="button"
                    className={s.installBtn}
                    onClick={handleInstallClick}
                  >
                    📲 今すぐインストール
                  </button>
                </div>
              </>
            ) : (
              <div className={s.installSteps}>
                <div className={s.installStep}>
                  <span className={s.installStepNum}>1</span>
                  <span>
                    <strong>Chrome</strong> でこのページを開く
                  </span>
                </div>
                <div className={s.installStep}>
                  <span className={s.installStepNum}>2</span>
                  <span>
                    右上の <strong>︙</strong> メニューをタップ
                  </span>
                </div>
                <div className={s.installStep}>
                  <span className={s.installStepNum}>3</span>
                  <span>
                    「<span className={s.installHighlightText}>ホーム画面に追加</span>」
                    または
                    「<span className={s.installHighlightText}>アプリをインストール</span>」
                    を選択
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <p className={`${s.installHint} ${s.fadeIn}`}>
          QuestBoard は PWA （Progressive Web App） です。<br />
          ストアからのダウンロードは不要。ブラウザからそのままインストールできます。
        </p>
      </div>
    </section>
  );
}

function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

/* ===== MonsterPath サブコンポーネント ===== */
type MonsterEntry = { src: string; name: string; fallback: string; revealed?: boolean };
type MonsterPathProps = {
  label: { text: string; colorClass: string };
  s: typeof styles;
  stage1: Omit<MonsterEntry, "revealed">;
  stage2: MonsterEntry[];
  stage3: MonsterEntry[];
};

function MonsterPath({ label, s, stage1, stage2, stage3 }: MonsterPathProps) {
  return (
    <div className={s.monsterPath}>
      <div className={`${s.pathLabel} ${label.colorClass}`}>{label.text}</div>
      <div className={s.pathMonsters}>
        {/* Stage 1 */}
        <div className={s.monsterStage}>
          <div className={s.monsterItem}>
            <div className={s.monsterImgWrap}>
              <MonsterImg src={stage1.src} alt={stage1.name} fallback={stage1.fallback} style={{ width: 72, height: 72, objectFit: "contain" }} />
            </div>
            <div className={s.monsterItemName}>{stage1.name}</div>
          </div>
        </div>
        <div className={s.pathArrow}>↓</div>
        {/* Stage 2 */}
        <div className={s.monsterStage} style={{ gap: 6 }}>
          {stage2.map((m) => (
            <div key={m.name} className={`${s.monsterItem} ${!m.revealed ? s.monsterShadow : ""}`}>
              <div className={s.monsterImgWrap} style={{ width: 72, height: 72 }}>
                <MonsterImg src={m.src} alt={m.name} fallback={m.fallback} style={{ width: 62, height: 62, objectFit: "contain" }} />
              </div>
              <div className={s.monsterItemName}>{m.name}</div>
            </div>
          ))}
        </div>
        <div className={s.pathArrow}>↓</div>
        {/* Stage 3 */}
        <div className={s.monsterStage} style={{ gap: 6 }}>
          {stage3.map((m) => (
            <div key={m.name} className={`${s.monsterItem} ${s.monsterShadow}`}>
              <div className={s.monsterImgWrap} style={{ width: 64, height: 64 }}>
                <MonsterImg src={m.src} alt={m.name} fallback={m.fallback} style={{ width: 54, height: 54, objectFit: "contain" }} />
              </div>
              <div className={s.monsterItemName} style={{ fontSize: 8 }}>{m.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
