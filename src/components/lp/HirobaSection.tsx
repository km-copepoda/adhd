import { HIROBA_FEATURES, CHEER_FEATURE, HIROBA_PRIVACY_NOTES } from "@/lib/lp";

export function HirobaSection({ s }: { s: Record<string, string> }) {
  return (
    <section id="hiroba" className={`${s.section} ${s.hirobaSection}`}>
      <div className={`${s.orb} ${s.hirobaOrb1}`} />
      <div className={`${s.orb} ${s.hirobaOrb2}`} />
      <div className={s.container} style={{ position: "relative", zIndex: 1 }}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>HIROBA</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>
          「自分だけが頑張ってる」感じを、なかまの存在で和らげる場所
        </p>
        <div className={`${s.divider} ${s.fadeIn}`} />

        <div className={s.hirobaGrid}>
          {HIROBA_FEATURES.map((f) => (
            <div key={f.title} className={`${s.hirobaCard} ${s.fadeIn}`}>
              <div className={s.hirobaIcon}>{f.icon}</div>
              <h3 className={s.hirobaTitle}>{f.title}</h3>
              <p className={s.hirobaBody}>{f.body}</p>
            </div>
          ))}
        </div>

        {/* CHEER（エール）スポットライト */}
        <div className={`${s.cheerSpotlight} ${s.fadeIn}`}>
          <div className={s.cheerHeader}>
            <span className={s.cheerIcon} aria-hidden>{CHEER_FEATURE.icon}</span>
            <div>
              <h3 className={s.cheerTitle}>{CHEER_FEATURE.title}</h3>
              <p className={s.cheerSubTitle}>{CHEER_FEATURE.subTitle}</p>
            </div>
            <span className={s.cheerBadge}>1日1回</span>
          </div>
          <p className={s.cheerBody}>{CHEER_FEATURE.body}</p>
          <ul className={s.cheerBullets}>
            {CHEER_FEATURE.bullets.map((b) => (
              <li key={b} className={s.cheerBullet}>
                <span className={s.cheerBulletMark} aria-hidden>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* プライバシー */}
        <div className={`${s.privacyBox} ${s.fadeIn}`}>
          <div className={s.privacyTitle}>
            <span aria-hidden>🛡</span>
            <span>親が安心して使わせられるプライバシー設計</span>
          </div>
          <ul className={s.privacyList}>
            {HIROBA_PRIVACY_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
