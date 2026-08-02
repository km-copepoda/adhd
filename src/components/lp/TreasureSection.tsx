import { TREASURE_FEATURE, COLLECTION_FEATURE } from "@/lib/lp";

export function TreasureSection({ s }: { s: Record<string, string> }) {
  return (
    <section id="treasure" className={`${s.section} ${s.hirobaSection}`}>
      <div className={`${s.orb} ${s.hirobaOrb1}`} />
      <div className={`${s.orb} ${s.hirobaOrb2}`} />
      <div className={s.container} style={{ position: "relative", zIndex: 1 }}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>TREASURE BOX</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>
          頑張った日に必ず何かが手に入る、二重のごほうび設計
        </p>
        <div className={`${s.divider} ${s.fadeIn}`} />

        {/* 宝箱スポットライト */}
        <div className={`${s.cheerSpotlight} ${s.fadeIn}`}>
          <div className={s.cheerHeader}>
            <span className={s.cheerIcon} aria-hidden>{TREASURE_FEATURE.icon}</span>
            <div>
              <h3 className={s.cheerTitle}>{TREASURE_FEATURE.title}</h3>
              <p className={s.cheerSubTitle}>{TREASURE_FEATURE.subTitle}</p>
            </div>
            <span className={s.cheerBadge}>必ず当たる</span>
          </div>
          <p className={s.cheerBody}>{TREASURE_FEATURE.body}</p>
          <ul className={s.cheerBullets}>
            {TREASURE_FEATURE.bullets.map((b) => (
              <li key={b} className={s.cheerBullet}>
                <span className={s.cheerBulletMark} aria-hidden>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* コレクションスポットライト */}
        <div className={`${s.cheerSpotlight} ${s.fadeIn}`} style={{ marginTop: 24 }}>
          <div className={s.cheerHeader}>
            <span className={s.cheerIcon} aria-hidden>{COLLECTION_FEATURE.icon}</span>
            <div>
              <h3 className={s.cheerTitle}>{COLLECTION_FEATURE.title}</h3>
              <p className={s.cheerSubTitle}>{COLLECTION_FEATURE.subTitle}</p>
            </div>
            <span className={s.cheerBadge}>全140種</span>
          </div>
          <p className={s.cheerBody}>{COLLECTION_FEATURE.body}</p>
          <ul className={s.cheerBullets}>
            {COLLECTION_FEATURE.bullets.map((b) => (
              <li key={b} className={s.cheerBullet}>
                <span className={s.cheerBulletMark} aria-hidden>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
