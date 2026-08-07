import { FAQ_ITEMS, TREASURE_FAQ_ITEMS, FAQ_PRIMARY_COUNT } from "@/lib/lp";

export function FaqSection({ s }: { s: Record<string, string> }) {
  const primary = FAQ_ITEMS.slice(0, FAQ_PRIMARY_COUNT);
  const secondary = [...FAQ_ITEMS.slice(FAQ_PRIMARY_COUNT), ...TREASURE_FAQ_ITEMS];

  return (
    <section id="faq" className={`${s.section} ${s.faqSection}`}>
      <div className={s.container}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>FAQ</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>よくいただく質問</p>
        <div className={`${s.divider} ${s.fadeIn}`} />

        <div className={s.faqList}>
          {primary.map((item) => (
            <details key={item.question} className={`${s.faqItem} ${s.fadeIn}`}>
              <summary className={s.faqQuestion}>
                <span className={s.faqQ}>Q.</span>
                <span>{item.question}</span>
                <span className={s.faqChevron} aria-hidden>▾</span>
              </summary>
              <div className={s.faqAnswer}>
                <span className={s.faqA}>A.</span>
                <p>{item.answer}</p>
              </div>
            </details>
          ))}

          {secondary.length > 0 && (
            <details className={`${s.faqMore} ${s.fadeIn}`}>
              <summary className={s.faqMoreSummary}>
                その他の質問（{secondary.length}件） ▾
              </summary>
              <div className={s.faqMoreList}>
                {secondary.map((item) => (
                  <details key={item.question} className={s.faqItem}>
                    <summary className={s.faqQuestion}>
                      <span className={s.faqQ}>Q.</span>
                      <span>{item.question}</span>
                      <span className={s.faqChevron} aria-hidden>▾</span>
                    </summary>
                    <div className={s.faqAnswer}>
                      <span className={s.faqA}>A.</span>
                      <p>{item.answer}</p>
                    </div>
                  </details>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}
