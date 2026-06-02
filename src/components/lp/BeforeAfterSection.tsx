import { BEFORE_AFTER } from "@/lib/lp";

export function BeforeAfterSection({ s }: { s: Record<string, string> }) {
  return (
    <section id="beforeafter" className={`${s.section} ${s.beforeAfterSection}`}>
      <div className={s.container}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>BEFORE / AFTER</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>使う前と使った後で、家族の景色がこう変わる</p>
        <div className={`${s.divider} ${s.fadeIn}`} />

        <div className={s.beforeAfterList}>
          {BEFORE_AFTER.map((ba) => (
            <div key={ba.scene} className={`${s.beforeAfterRow} ${s.fadeIn}`}>
              <div className={s.beforeAfterScene}>{ba.scene}</div>
              <div className={s.beforeAfterCols}>
                <div className={`${s.beforeAfterCol} ${s.beforeCol}`}>
                  <div className={s.beforeAfterLabel}>BEFORE</div>
                  <p>{ba.before}</p>
                </div>
                <div className={s.beforeAfterArrow}>→</div>
                <div className={`${s.beforeAfterCol} ${s.afterCol}`}>
                  <div className={s.beforeAfterLabel}>AFTER</div>
                  <p>{ba.after}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
