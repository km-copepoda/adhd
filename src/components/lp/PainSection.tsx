import { PAIN_POINTS } from "@/lib/lp";

export function PainSection({ s }: { s: Record<string, string> }) {
  return (
    <section id="pain" className={`${s.section} ${s.painSection}`}>
      <div className={`${s.orb} ${s.painOrb}`} />
      <div className={s.container} style={{ position: "relative", zIndex: 1 }}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>こんな悩み、ありませんか？</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>
          子どもの「やらない」「忘れる」「先延ばし」── 親が頑張るだけでは限界がある。
        </p>
        <div className={`${s.divider} ${s.fadeIn}`} />

        <div className={s.painGrid}>
          {PAIN_POINTS.map((p) => (
            <div key={p.title} className={`${s.painCard} ${s.fadeIn}`}>
              <div className={s.painIcon}>{p.icon}</div>
              <h3 className={s.painTitle}>{p.title}</h3>
              <p className={s.painBody}>{p.body}</p>
            </div>
          ))}
        </div>

        <p className={`${s.painLead} ${s.fadeIn}`}>
          QuestBoard は、これらの「親子で困りやすいポイント」を<strong>アプリの構造そのもの</strong>で支える設計にしています。
          集中しにくい・動き出しが苦手なお子さんにも、特に効果的に働きます。
        </p>
      </div>
    </section>
  );
}
