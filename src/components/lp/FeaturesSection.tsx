export function FeaturesSection({ s }: { s: Record<string, string> }) {
  return (
    <section id="features" className={s.section}>
      <div className={s.container}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>FEATURES</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>続けるための仕組みが詰まっている</p>
        <div className={`${s.divider} ${s.fadeIn}`} />

        <div className={s.featuresGrid}>
          <div className={`${s.featureCard} ${s.fGold} ${s.fadeIn}`}>
            <div className={s.featureIcon}>🥚</div>
            <div className={s.featureTitle}>卵から育てるモンスター</div>
            <p className={s.featureDesc}>最初は卵から。タスクを1つクリアして孵化させると、初めて自分だけのモンスターに出会える。愛着形成から始まるゲーム体験。</p>
            <span className={`${s.featureTag} ${s.tagGold}`}>MONSTER EVOLUTION</span>
          </div>

          <div className={`${s.featureCard} ${s.fStudy} ${s.fadeIn}`}>
            <div className={s.featureIcon}>📚💪🌿</div>
            <div className={s.featureTitle}>3系統パラメータ連動進化</div>
            <p className={s.featureDesc}>学力（STUDY）・体力（STAMINA）・生活力（LIFE）の3カテゴリ。こなしたタスクの傾向に応じて進化先が確率的に分岐。</p>
            <span className={`${s.featureTag} ${s.tagStudy}`}>STUDY / STAMINA / LIFE</span>
          </div>

          <div className={`${s.featureCard} ${s.fLife} ${s.fadeIn}`}>
            <div className={s.featureIcon}>🔄</div>
            <div className={s.featureTitle}>手動転生 × 卵選択ボーナス</div>
            <p className={s.featureDesc}>最終形態に到達すると「転生ボタン」が出現。子どもが自分のタイミングで次サイクルを開始できる。卵の種類（勉強・体力・生活力）を選ぶと、その系統の進化確率に+20%ボーナス。過去のモンスターは図鑑に記録され、全79種コンプリートが長期目標になる。</p>
            <span className={`${s.featureTag} ${s.tagLife}`}>REBIRTH SYSTEM</span>
          </div>

          <div className={`${s.featureCard} ${s.fStamina} ${s.fadeIn}`}>
            <div className={s.featureIcon}>🔥</div>
            <div className={s.featureTitle}>ストリーク継続ボーナス</div>
            <p className={s.featureDesc}>タスクをこなした日が連続するほどストリーク加算。マイルストーンで追加 XP ボーナス。スキップも親が承認すればストリーク継続。</p>
            <span className={`${s.featureTag} ${s.tagStamina}`}>STREAK SYSTEM</span>
          </div>

          <div className={`${s.featureCard} ${s.fPurple} ${s.fadeIn}`}>
            <div className={s.featureIcon}>🔔</div>
            <div className={s.featureTitle}>双方向プッシュ通知</div>
            <p className={s.featureDesc}>子どもの報告→親へ通知。親から子どもへリマインド送信も可。アプリを閉じていても OS 通知でリアルタイム連携。</p>
            <span className={`${s.featureTag} ${s.tagPurple}`}>PUSH NOTIFICATION</span>
          </div>

          <div className={`${s.featureCard} ${s.fLife} ${s.fadeIn}`}>
            <div className={s.featureIcon}>🌙</div>
            <div className={s.featureTitle}>日をまたいでも自動で処理</div>
            <p className={s.featureDesc}>親が承認し忘れた報告は翌日0時（JST）に自動承認。子どもの XP は必ず確定するので「今夜は確認できなかった…」という罪悪感なく使えます。忙しい日でもアプリが家族をサポートします。</p>
            <span className={`${s.featureTag} ${s.tagLife}`}>AUTO APPROVE</span>
          </div>

          <div className={`${s.featureCard} ${s.fPink} ${s.fadeIn}`}>
            <div className={s.featureIcon}>📸</div>
            <div className={s.featureTitle}>写真添付でボーナス XP</div>
            <p className={s.featureDesc}>タスク完了の証拠写真を添付すると追加 XP。完了・期限内・写真の3要素で最大3pt 獲得。写真は親の承認画面でサムネイル表示。</p>
            <span className={`${s.featureTag} ${s.tagGold}`}>PHOTO BONUS</span>
          </div>

          <div className={`${s.featureCard} ${s.fPurple} ${s.fadeIn}`}>
            <div className={s.featureIcon}>⚡🐾</div>
            <div className={s.featureTitle}>カッコいい系 or かわいい系を選べる</div>
            <p className={s.featureDesc}>モンスターのビジュアルスタイルをふたつから選択。勇者・戦士系のカッコいい「ヒーロー系」か、動物・ファンタジー系のかわいい「どうぶつ系」か。好みのスタイルで39種×2 + 卵1 = 全79種のコレクション。</p>
            <span className={`${s.featureTag} ${s.tagPurple}`}>CHARACTER STYLE</span>
          </div>

          <div className={`${s.featureCard} ${s.fGold} ${s.fadeIn}`}>
            <div className={s.featureIcon}>🏅</div>
            <div className={s.featureTitle}>100種類の実績バッジ</div>
            <p className={s.featureDesc}>初クエスト・連続ログイン・写真撮影・転生回数など多彩な条件で100種類のバッジを解除。「気づいたら達成していた」という小さな驚きが積み重なり、継続するモチベーションをさらに後押しする。</p>
            <span className={`${s.featureTag} ${s.tagGold}`}>BADGE SYSTEM</span>
          </div>

          <div className={`${s.featureCard} ${s.fPink} ${s.fadeIn}`}>
            <div className={s.featureIcon}>💎</div>
            <div className={s.featureTitle}>ごほうび宝箱（必ず当たる）</div>
            <p className={s.featureDesc}>全タスク完了やストリーク達成で宝箱が出現。開けると親が登録した「親ごほうび」（COMMON 1/10・UNCOMMON 1/20・RARE 1/45）か、外れ枠の季節コレクションアイテムが必ず手に入る。「開けたけど何ももらえない」が構造的に発生しない設計。</p>
            <span className={`${s.featureTag} ${s.tagPink}`}>TREASURE</span>
          </div>

          <div className={`${s.featureCard} ${s.fLife} ${s.fadeIn}`}>
            <div className={s.featureIcon}>📦</div>
            <div className={s.featureTitle}>季節コレクション 全80種</div>
            <p className={s.featureDesc}>春・夏・秋・冬それぞれ20種、合計 80 種のアイテムを宝箱から集める。COMMON / UNCOMMON / RARE の3段階レア度。シーズン制覇・全80種制覇は実績バッジにも連動し、長期目標を作る。</p>
            <span className={`${s.featureTag} ${s.tagLife}`}>COLLECTION</span>
          </div>
        </div>
      </div>
    </section>
  );
}
