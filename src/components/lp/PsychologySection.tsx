import { PSYCHOLOGY_INSIGHTS } from "@/lib/lp";

const ICON_COLORS = [
  "adhdIconGold",
  "adhdIconStudy",
  "adhdIconStamina",
  "adhdIconLife",
  "adhdIconPurple",
] as const;

export function PsychologySection({ s }: { s: Record<string, string> }) {
  return (
    <section id="psychology" className={`${s.section} ${s.adhdSection}`}>
      <div className={`${s.orb} ${s.adhdOrbA1}`} />
      <div className={s.container}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>WHY IT WORKS</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>
          「なんとなく楽しい」ではなく、行動心理学の知見に基づいて設計した 5 つの仕組み
        </p>
        <div className={`${s.divider} ${s.fadeIn}`} />

        <div className={s.adhdGrid}>
          {PSYCHOLOGY_INSIGHTS.map((item, i) => (
            <div key={item.headline} className={`${s.adhdPoint} ${s.fadeIn}`}>
              <div className={`${s.adhdIcon} ${s[ICON_COLORS[i % ICON_COLORS.length]]}`}>
                {item.icon}
              </div>
              <div className={s.adhdContent}>
                <h3>{item.headline}</h3>
                <p>{item.body}</p>
                <small className={s.psychTheory}>
                  <strong>設計の根拠：</strong>
                  {item.feature} — {item.theory}
                </small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
