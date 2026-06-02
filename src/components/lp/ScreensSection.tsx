import { MonsterImg } from "./MonsterImg";

export function ScreensSection({ s }: { s: Record<string, string> }) {
  return (
    <section id="screens" className={`${s.section} ${s.screensSection}`}>
      <div className={s.container}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>APP SCREENS</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>子ども画面と親画面の2ロール構成</p>
        <div className={`${s.divider} ${s.fadeIn}`} />

        <div className={s.screensShowcase}>
          {/* 子ども: 今日のクエスト */}
          <div className={`${s.phoneWrap} ${s.fadeIn}`}>
            <div className={s.phoneLabel}>⚔ 子ども — 今日のクエスト</div>
            <div className={`${s.phone} ${s.phoneLarge}`}>
              <div className={`${s.screen} ${s.screenLarge}`}>
                <div className={s.sHeader}>
                  <div className={s.sTitle}>TODAY&apos;S QUEST</div>
                  <div className={s.sXp}>🔥 3日連続</div>
                </div>
                <div className={s.sMonsterArea}>
                  <MonsterImg
                    src="/monsters/dark/STUDY_ラーン.webp"
                    alt="ラーン"
                    fallback="📚"
                    style={{ width: 80, height: 80, objectFit: "contain", animation: "float 3s ease-in-out infinite", filter: "drop-shadow(0 4px 20px rgba(167,139,250,0.3))" }}
                  />
                  <div className={s.sMonsterName}>ラーン Lv.2</div>
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--dim)" }}>
                      <span>次の進化まで</span>
                      <span style={{ color: "var(--gold)" }}>6/10 pt</span>
                    </div>
                    <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                      <div className={s.fillEvolve} style={{ width: "60%", height: "100%", borderRadius: 3 }} />
                    </div>
                  </div>
                </div>
                <div className={s.pEvoBar}>
                  {[
                    { label: "📚学力", cls: s.fillStudy, w: "70%", val: 7 },
                    { label: "💪体力", cls: s.fillStamina, w: "30%", val: 3 },
                    { label: "🌿生活", cls: s.fillLife, w: "50%", val: 5 },
                  ].map((b) => (
                    <div key={b.label} className={s.pEvoBarRow}>
                      <div className={s.pEvoLabel}>{b.label}</div>
                      <div className={s.pEvoBg}><div className={`${s.pEvoFill} ${b.cls}`} style={{ width: b.w }} /></div>
                      <div className={s.pEvoVal}>{b.val}</div>
                    </div>
                  ))}
                </div>
                <div className={s.sSectionLabel}>今日のクエスト</div>
                <div className={s.sQuestList}>
                  <div className={`${s.sQuestItem} ${s.sQuestItemDone}`}>
                    <div className={`${s.sCheck} ${s.sCheckChecked}`}>✓</div>
                    <div className={`${s.sQuestIcon} ${s.iconLife}`}>🌿</div>
                    <div className={s.sQuestText}>歯磨きをする</div>
                    <div className={s.sQuestXp}>+1</div>
                  </div>
                  {[
                    { icon: "📚", text: "宿題をする", xp: "+2", iconCls: s.iconStudy },
                    { icon: "💪", text: "公園で遊ぶ", xp: "+1", iconCls: s.iconStamina },
                    { icon: "🌿", text: "お風呂に入る", xp: "+1", iconCls: s.iconLife },
                  ].map((q) => (
                    <div key={q.text} className={s.sQuestItem}>
                      <div className={s.sCheck} />
                      <div className={`${s.sQuestIcon} ${q.iconCls}`}>{q.icon}</div>
                      <div className={s.sQuestText}>{q.text}</div>
                      <div className={s.sQuestXp}>{q.xp}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 親: 承認センター */}
          <div className={`${s.phoneWrap} ${s.fadeIn}`}>
            <div className={s.phoneLabel}>👨‍👩‍👧 親 — 承認センター</div>
            <div className={`${s.phone} ${s.phoneLarge}`}>
              <div className={`${s.screen} ${s.screenLarge}`}>
                <div className={s.sHeader}>
                  <div className={s.sTitle}>APPROVE</div>
                  <div style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "var(--stamina)", fontSize: 9, padding: "3px 8px", borderRadius: 20 }}>3件待ち</div>
                </div>
                <div className={s.notifyBubble}>
                  <div className={s.notifyDot} />
                  <div className={s.notifyText}>もも が「宿題をする」を報告</div>
                  <div className={s.notifyTime}>今</div>
                </div>
                <div className={s.sSectionLabel}>承認待ち</div>
                <div className={s.sApproveItem}>
                  <div className={s.sApproveRow}>
                    <div>
                      <div className={s.sApproveName}>📚 宿題をする</div>
                      <div className={s.sApproveTask}>もも • 写真あり 📸</div>
                    </div>
                    <div className={s.sApproveBtns}>
                      <button type="button" className={s.sBtnOk}>承認 ✓</button>
                      <button type="button" className={s.sBtnNg}>差戻</button>
                    </div>
                  </div>
                </div>
                <div className={s.sApproveItem}>
                  <div className={s.sApproveRow}>
                    <div>
                      <div className={s.sApproveName}>💪 公園で遊ぶ</div>
                      <div className={s.sApproveTask}>はな • 完了報告</div>
                    </div>
                    <div className={s.sApproveBtns}>
                      <button type="button" className={s.sBtnOk}>承認 ✓</button>
                      <button type="button" className={s.sBtnNg}>差戻</button>
                    </div>
                  </div>
                </div>
                <div className={s.sApproveItem} style={{ borderLeftColor: "var(--stamina)" }}>
                  <div className={s.sApproveRow}>
                    <div>
                      <div className={s.sApproveName} style={{ color: "var(--stamina)" }}>⏭ 習い事をスキップ申請</div>
                      <div className={s.sApproveTask}>もも • 体調不良</div>
                    </div>
                    <div className={s.sApproveBtns}>
                      <button type="button" className={s.sBtnOk}>承認 ✓</button>
                      <button type="button" className={s.sBtnNg}>却下</button>
                    </div>
                  </div>
                </div>
                <div className={s.sSectionLabel}>今日の完了</div>
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
          <div className={`${s.phoneWrap} ${s.fadeIn}`}>
            <div className={s.phoneLabel}>🏅 子ども — 実績バッジ</div>
            <div className={`${s.phone} ${s.phoneLarge}`}>
              <div className={`${s.screen} ${s.screenLarge}`}>
                <div className={s.sHeader}>
                  <div className={s.sTitle}>BADGES</div>
                  <div className={s.sXp}>🏅 12 / 100</div>
                </div>
                {/* 新バッジ解除演出 */}
                <div className={s.notifyBubble} style={{ background: "rgba(240,192,64,0.1)", borderLeft: "3px solid var(--gold)" }}>
                  <div className={s.notifyDot} style={{ background: "var(--gold)" }} />
                  <div className={s.notifyText} style={{ color: "var(--gold)" }}>🏅 新バッジ解除！「3日連続クリア」</div>
                </div>
                <div className={s.sSectionLabel}>最近の解除</div>
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
                <div className={s.sSectionLabel}>進捗</div>
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
          <div className={`${s.phoneWrap} ${s.fadeIn}`}>
            <div className={s.phoneLabel}>🐉 子ども — モンスター育成</div>
            <div className={`${s.phone} ${s.phoneLarge}`}>
              <div className={`${s.screen} ${s.screenLarge}`}>
                <div className={s.sHeader}>
                  <div className={s.sTitle}>MONSTER</div>
                  <div className={s.sXp}>Total 15pt</div>
                </div>
                <div className={s.sMonsterArea} style={{ padding: "20px 0" }}>
                  <MonsterImg
                    src="/monsters/dark/STUDY_STUDY_ライブラ.webp"
                    alt="ライブラ"
                    fallback="📚"
                    style={{ width: 100, height: 100, objectFit: "contain", animation: "float 3s ease-in-out infinite", filter: "drop-shadow(0 4px 20px rgba(167,139,250,0.3))" }}
                  />
                  <div className={s.sMonsterName} style={{ fontSize: 15 }}>ライブラ</div>
                  <div style={{ fontSize: 10, color: "var(--dim)" }}>stage 2 / 学力系</div>
                  <div style={{ width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--dim)", marginBottom: 4 }}>
                      <span>進化まで</span><span style={{ color: "var(--gold)" }}>8/30 pt</span>
                    </div>
                    <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                      <div className={s.fillEvolve} style={{ width: "27%", height: "100%", borderRadius: 4 }} />
                    </div>
                  </div>
                </div>
                <div className={s.pEvoBar}>
                  {[
                    { label: "📚学力", cls: s.fillStudy, w: "80%", val: 12 },
                    { label: "💪体力", cls: s.fillStamina, w: "20%", val: 3 },
                    { label: "🌿生活", cls: s.fillLife, w: "40%", val: 6 },
                  ].map((b) => (
                    <div key={b.label} className={s.pEvoBarRow}>
                      <div className={s.pEvoLabel}>{b.label}</div>
                      <div className={s.pEvoBg}><div className={`${s.pEvoFill} ${b.cls}`} style={{ width: b.w }} /></div>
                      <div className={s.pEvoVal}>{b.val}</div>
                    </div>
                  ))}
                </div>
                <div className={s.sStreak}>
                  <div className={s.sStreakIcon}>🔥</div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div className={s.sStreakNum}>7</div>
                    <div className={s.sStreakLabel}>日連続クリア中</div>
                  </div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "var(--gold)" }}>ベスト 12日</div>
                    <div style={{ fontSize: 9, color: "var(--dim)" }}>今月 18/30日</div>
                  </div>
                </div>
                <div className={s.sSectionLabel}>コレクション</div>
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

          {/* 子ども: 図鑑 */}
          <div className={`${s.phoneWrap} ${s.fadeIn}`}>
            <div className={s.phoneLabel}>📖 子ども — 図鑑</div>
            <div className={`${s.phone} ${s.phoneLarge}`}>
              <div className={`${s.screen} ${s.screenLarge}`}>
                <div className={s.sHeader}>
                  <div className={s.sTitle}>ZUKAN</div>
                  <div className={s.sXp}>🐣 7 / 79</div>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {[
                    { tag: "学力系", color: "var(--study)" },
                    { tag: "体力系", color: "var(--stamina)" },
                    { tag: "生活系", color: "var(--life)" },
                  ].map((t) => (
                    <span key={t.tag} style={{ fontSize: 9, color: t.color, border: `1px solid ${t.color}`, borderRadius: 12, padding: "2px 8px", opacity: 0.85 }}>{t.tag}</span>
                  ))}
                </div>
                <div className={s.sSectionLabel}>進化ライン（学力系）</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "6px 0" }}>
                  {[
                    { src: "/monsters/dark/STUDY_ラーン.webp", name: "ラーン", got: true, fallback: "📚" },
                    { src: "/monsters/dark/STUDY_STUDY_ライブラ.webp", name: "ライブラ", got: true, fallback: "📖" },
                    { src: undefined, name: "?", got: false, fallback: "?" },
                  ].map((m, i, arr) => (
                    <div key={i} style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        {m.src ? (
                          <MonsterImg src={m.src} alt={m.name} fallback={m.fallback} style={{ width: 50, height: 50, objectFit: "contain", filter: m.got ? "none" : "grayscale(1) brightness(0.5)" }} />
                        ) : (
                          <div style={{ width: 50, height: 50, background: "var(--border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4 }}><span style={{ fontSize: 22 }}>?</span></div>
                        )}
                        <div style={{ fontSize: 8, color: m.got ? "var(--gold)" : "var(--dim)" }}>{m.got ? m.name : "？？？"}</div>
                      </div>
                      {i < arr.length - 1 && <span style={{ color: "var(--dim)", fontSize: 12 }}>›</span>}
                    </div>
                  ))}
                </div>
                <div className={s.sSectionLabel}>コレクション</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                  {[
                    { src: "/monsters/dark/STUDY_ラーン.webp", got: true, fb: "📚" },
                    { src: "/monsters/dark/STAMINA_ガル.webp", got: true, fb: "💪" },
                    { src: "/monsters/dark/LIFE_リフィ.webp", got: true, fb: "🌿" },
                    { src: "/monsters/dark/STUDY_STUDY_ライブラ.webp", got: true, fb: "📖" },
                    { src: undefined, got: false, fb: "?" },
                    { src: undefined, got: false, fb: "?" },
                    { src: undefined, got: false, fb: "?" },
                    { src: undefined, got: false, fb: "?" },
                  ].map((m, i) => (
                    <div key={i} style={{ background: m.got ? "var(--card2)" : "var(--border)", border: `1px solid ${m.got ? "rgba(240,192,64,0.2)" : "var(--border)"}`, borderRadius: 8, padding: 4, aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", opacity: m.got ? 1 : 0.35 }}>
                      {m.got && m.src ? (
                        <MonsterImg src={m.src} alt="" fallback={m.fb} style={{ width: 32, height: 32, objectFit: "contain" }} />
                      ) : (
                        <span style={{ fontSize: 14 }}>{m.fb}</span>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: "var(--dim)", textAlign: "center", marginTop: 4 }}>転生してもっと集めよう</div>
              </div>
            </div>
          </div>

          {/* 子ども: ひろば掲示板 */}
          <div className={`${s.phoneWrap} ${s.fadeIn}`}>
            <div className={s.phoneLabel}>📣 子ども — ひろば掲示板</div>
            <div className={`${s.phone} ${s.phoneLarge}`}>
              <div className={`${s.screen} ${s.screenLarge}`}>
                <div className={s.sHeader}>
                  <div className={s.sTitle}>HIROBA</div>
                  <div className={s.sXp}>🌳 公園 12人</div>
                </div>
                <div style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 10, padding: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🤝</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: "var(--dim)" }}>あいことば</div>
                    <div style={{ fontSize: 11, color: "var(--gold)", letterSpacing: 1 }}>サクラ</div>
                  </div>
                  <button type="button" style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", color: "var(--evolve)", fontSize: 9, padding: "5px 10px", borderRadius: 8 }}>📣 エール</button>
                </div>
                <div className={s.sSectionLabel}>5/7（木）の掲示板 ・きょう</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { emo: "🎉", text: "ライブラは今日のクエストをすべてやりとげた！", time: "今" },
                    { emo: "📣", text: "ラーンがみんなにエールを送ったよ！", time: "5分前" },
                    { emo: "🏅", text: "ガル は新しいバッジ「3日連続」を手に入れた！", time: "10分前" },
                    { emo: "💪", text: "リフィは夢中でクエストをこなしている！", time: "30分前" },
                    { emo: "🌟", text: "ラーンのモンスターがライブラに進化した！", time: "1時間前" },
                  ].map((e, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 10 }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{e.emo}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: "var(--text)", lineHeight: 1.3 }}>{e.text}</div>
                        <div style={{ fontSize: 8, color: "var(--dim)", marginTop: 1 }}>{e.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: "var(--dim)", textAlign: "center", marginTop: 4 }}>5/6（水）の掲示板 ▾</div>
              </div>
            </div>
          </div>

          {/* 親: タスク管理 */}
          <div className={`${s.phoneWrap} ${s.fadeIn}`}>
            <div className={s.phoneLabel}>📋 親 — タスク管理</div>
            <div className={`${s.phone} ${s.phoneLarge}`}>
              <div className={`${s.screen} ${s.screenLarge}`}>
                <div className={s.sHeader}>
                  <div className={s.sTitle}>TASKS</div>
                  <div className={s.sXp}>👧 もも</div>
                </div>
                <button type="button" style={{ background: "rgba(240,192,64,0.1)", border: "1px dashed rgba(240,192,64,0.4)", color: "var(--gold)", fontSize: 10, padding: 8, borderRadius: 10, cursor: "pointer" }}>＋ 新しいタスクを追加</button>
                <div className={s.sSectionLabel}>くりかえしタスク</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {[
                    { icon: "🌿", iconCls: s.iconLife, name: "歯磨きをする", days: "毎日", photo: false },
                    { icon: "📚", iconCls: s.iconStudy, name: "宿題をする", days: "月火水木金", photo: true },
                    { icon: "💪", iconCls: s.iconStamina, name: "なわとび", days: "火木土", photo: false },
                    { icon: "🌿", iconCls: s.iconLife, name: "おてつだい", days: "毎日", photo: false },
                  ].map((t, i) => (
                    <div key={i} style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 10, padding: 8, display: "flex", alignItems: "center", gap: 8 }}>
                      <div className={`${s.sQuestIcon} ${t.iconCls}`}>{t.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "var(--text)" }}>{t.name}</div>
                        <div style={{ fontSize: 8, color: "var(--dim)" }}>{t.days}{t.photo && " ・写真ボーナス📸"}</div>
                      </div>
                      <button type="button" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--dim)", fontSize: 9, padding: "3px 6px", borderRadius: 6 }}>編集</button>
                    </div>
                  ))}
                </div>
                <div className={s.sSectionLabel}>子からの申請（1）</div>
                <div style={{ background: "rgba(240,192,64,0.08)", border: "1px solid rgba(240,192,64,0.3)", borderRadius: 10, padding: 8 }}>
                  <div style={{ fontSize: 10, color: "var(--gold)" }}>📚 図書館で本を読む</div>
                  <div style={{ fontSize: 8, color: "var(--dim)", marginTop: 2 }}>もも が追加 ・承認待ち</div>
                </div>
              </div>
            </div>
          </div>

          {/* 子ども: ストリーク履歴 */}
          <div className={`${s.phoneWrap} ${s.fadeIn}`}>
            <div className={s.phoneLabel}>🔥 子ども — ストリーク履歴</div>
            <div className={`${s.phone} ${s.phoneLarge}`}>
              <div className={`${s.screen} ${s.screenLarge}`}>
                <div className={s.sHeader}>
                  <div className={s.sTitle}>STREAK</div>
                  <div className={s.sXp}>👑 一週間の戦士</div>
                </div>
                <div className={s.sStreak}>
                  <div className={s.sStreakIcon}>🔥</div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div className={s.sStreakNum}>7</div>
                    <div className={s.sStreakLabel}>日連続クリア中</div>
                  </div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "var(--gold)" }}>ベスト 14日</div>
                    <div style={{ fontSize: 9, color: "var(--dim)" }}>今月 22/30日</div>
                  </div>
                </div>
                <div className={s.sSectionLabel}>達成カレンダー（5月）</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                  {["月","火","水","木","金","土","日"].map((d) => (
                    <div key={d} style={{ fontSize: 8, color: "var(--dim)", textAlign: "center" }}>{d}</div>
                  ))}
                  {Array.from({ length: 30 }).map((_, i) => {
                    const v = [1, 1, 0.6, 1, 1, 0.3, 1, 1, 1, 1, 0.6, 0, 1, 1, 1, 1, 1, 0.3, 1, 1, 1, 1, 1, 1, 1, 1, 0.6, 1, 1, 1][i] ?? 0;
                    const bg = v === 1 ? "var(--gold)" : v >= 0.6 ? "rgba(240,192,64,0.5)" : v >= 0.3 ? "rgba(240,192,64,0.2)" : "var(--card2)";
                    return (
                      <div key={i} style={{ aspectRatio: "1", background: bg, borderRadius: 3, border: "1px solid var(--border)" }} />
                    );
                  })}
                </div>
                <div className={s.sSectionLabel}>マイルストーン</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    { t: "3日連続", got: true },
                    { t: "7日連続 🎉一週間の戦士", got: true },
                    { t: "14日連続", got: false, near: true },
                    { t: "30日連続", got: false, near: false },
                  ].map((m) => (
                    <div key={m.t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: m.got ? "var(--gold)" : m.near ? "var(--text)" : "var(--dim)" }}>
                      <span>{m.got ? "✓" : "○"}</span>
                      <span>{m.t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 親: メンバー管理 */}
          <div className={`${s.phoneWrap} ${s.fadeIn}`}>
            <div className={s.phoneLabel}>👨‍👩‍👧‍👦 親 — メンバー管理</div>
            <div className={`${s.phone} ${s.phoneLarge}`}>
              <div className={`${s.screen} ${s.screenLarge}`}>
                <div className={s.sHeader}>
                  <div className={s.sTitle}>FAMILY</div>
                  <div className={s.sXp}>👨‍👩‍👧‍👦 4名</div>
                </div>
                <div style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 9, color: "var(--dim)" }}>ファミリーコード</div>
                  <div style={{ fontSize: 16, color: "var(--gold)", letterSpacing: 4, fontFamily: "var(--font-cinzel), serif", textAlign: "center", padding: "4px 0" }}>QX7-8H4</div>
                  <button type="button" style={{ width: "100%", background: "rgba(240,192,64,0.1)", border: "1px solid rgba(240,192,64,0.3)", color: "var(--gold)", fontSize: 9, padding: 5, borderRadius: 6 }}>📋 コピーして共有</button>
                </div>
                <div className={s.sSectionLabel}>子ども（2名）</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { avatar: "👧", name: "もも", age: 8, deadline: "20:00", monster: "ライブラ", src: "/monsters/dark/STUDY_STUDY_ライブラ.webp", fb: "📖" },
                    { avatar: "👦", name: "はる", age: 10, deadline: "21:00", monster: "ガル", src: "/monsters/dark/STAMINA_ガル.webp", fb: "💪" },
                  ].map((c) => (
                    <div key={c.name} style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 10, padding: 8, display: "flex", alignItems: "center", gap: 8 }}>
                      <MonsterImg src={c.src} alt={c.monster} fallback={c.fb} style={{ width: 36, height: 36, objectFit: "contain" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "var(--text)" }}>{c.name} <span style={{ fontSize: 9, color: "var(--dim)" }}>({c.age}歳)</span></div>
                        <div style={{ fontSize: 8, color: "var(--dim)" }}>報告期限 {c.deadline} ・{c.monster}</div>
                      </div>
                      <button type="button" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--dim)", fontSize: 9, padding: "3px 6px", borderRadius: 6 }}>設定</button>
                    </div>
                  ))}
                </div>
                <div className={s.sSectionLabel}>親（2名）</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[{ a: "👩", n: "ママ" }, { a: "👨", n: "パパ" }].map((p) => (
                    <div key={p.n} style={{ flex: 1, background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 10, padding: 6, textAlign: "center" }}>
                      <div style={{ fontSize: 18 }}>{p.a}</div>
                      <div style={{ fontSize: 9, color: "var(--dim)" }}>{p.n}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 進化カットイン */}
          <div className={`${s.phoneWrap} ${s.fadeIn}`}>
            <div className={s.phoneLabel}>🌟 進化カットイン</div>
            <div className={`${s.phone} ${s.phoneLarge}`}>
              <div className={`${s.screen} ${s.screenLarge}`} style={{ background: "radial-gradient(circle at 50% 40%, rgba(240,192,64,0.25), rgba(0,0,0,0.95) 70%)", justifyContent: "center", alignItems: "center", overflow: "hidden", position: "relative" }}>
                {/* 放射状のキラキラ */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                    <div key={deg} style={{ position: "absolute", top: "50%", left: "50%", width: 2, height: 120, background: "linear-gradient(to bottom, rgba(240,192,64,0.6), transparent)", transformOrigin: "top center", transform: `translate(-50%, -10px) rotate(${deg}deg)` }} />
                  ))}
                </div>
                <div style={{ fontFamily: "var(--font-cinzel), serif", fontSize: 14, color: "var(--gold)", letterSpacing: 4, marginBottom: 10, textShadow: "0 0 20px rgba(240,192,64,0.8)" }}>EVOLUTION</div>
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle, rgba(240,192,64,0.4), transparent 70%)", filter: "blur(20px)" }} />
                  <MonsterImg
                    src="/monsters/dark/STUDY_STUDY_ライブラ.webp"
                    alt="ライブラ"
                    fallback="📖"
                    style={{ width: 130, height: 130, objectFit: "contain", animation: "float 3s ease-in-out infinite", filter: "drop-shadow(0 0 30px rgba(240,192,64,0.9))", position: "relative", zIndex: 1 }}
                  />
                </div>
                <div style={{ fontSize: 22, color: "var(--gold)", fontWeight: 700, textShadow: "0 0 14px rgba(240,192,64,0.7)", margin: "10px 0 4px" }}>進化した！</div>
                <div style={{ fontSize: 14, color: "var(--text)", letterSpacing: 1 }}>ラーン → <span style={{ color: "var(--gold)" }}>ライブラ</span></div>
                <div style={{ fontSize: 9, color: "var(--dim)", marginTop: 6 }}>stage 2 / 学力系</div>
                <button type="button" style={{ marginTop: 16, background: "rgba(240,192,64,0.15)", border: "1px solid rgba(240,192,64,0.5)", color: "var(--gold)", fontSize: 10, padding: "6px 18px", borderRadius: 20, letterSpacing: 1 }}>つづける</button>
              </div>
            </div>
          </div>

          {/* ログイン画面 */}
          <div className={`${s.phoneWrap} ${s.fadeIn}`}>
            <div className={s.phoneLabel}>🔐 ログイン画面</div>
            <div className={`${s.phone} ${s.phoneLarge}`}>
              <div className={`${s.screen} ${s.screenLarge}`} style={{ justifyContent: "center", alignItems: "center", gap: 14 }}>
                <div style={{ fontFamily: "var(--font-cinzel), serif", fontSize: 18, color: "var(--gold)", letterSpacing: 4, textAlign: "center" }}>QUEST<br />BOARD</div>
                <div style={{ fontSize: 9, color: "var(--dim)", letterSpacing: 2, textAlign: "center", marginTop: -8 }}>～ クエストでひびを冒険に ～</div>
                <div style={{ width: "100%", padding: "12px 0" }}>
                  <div style={{ fontSize: 10, color: "var(--dim)", textAlign: "center", marginBottom: 10 }}>あなたの役割を選んでね</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button type="button" style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.2), rgba(167,139,250,0.05))", border: "1px solid rgba(167,139,250,0.5)", color: "var(--evolve)", fontSize: 12, padding: 12, borderRadius: 12, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                      <span style={{ fontSize: 24 }}>👧</span>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontWeight: 600 }}>子ども ログイン</div>
                        <div style={{ fontSize: 8, color: "var(--dim)", marginTop: 2 }}>クエストにいどむ！</div>
                      </div>
                      <span style={{ color: "var(--evolve)" }}>›</span>
                    </button>
                    <button type="button" style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12, padding: 12, borderRadius: 12, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                      <span style={{ fontSize: 24 }}>👨‍👩‍👧</span>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontWeight: 600 }}>親 ログイン</div>
                        <div style={{ fontSize: 8, color: "var(--dim)", marginTop: 2 }}>子のがんばりを見守る</div>
                      </div>
                      <span style={{ color: "var(--dim)" }}>›</span>
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 9, color: "var(--dim)", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: 10, width: "100%" }}>
                  親アカウント新規登録は<br />
                  <span style={{ color: "var(--gold)" }}>＋ こちら</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
