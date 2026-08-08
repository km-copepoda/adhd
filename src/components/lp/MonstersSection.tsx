"use client";

import { useState } from "react";
import MonsterImageModal from "@/components/MonsterImageModal";
import { MONSTER_TABLE, MONSTER_TABLE_LIGHT } from "@/lib/monsters";
import { MonsterPath } from "./MonsterPath";

type MonsterStyle = "dark" | "light";

type SelectedMonster = { monsterKey: string; style: MonsterStyle };

function stageLabelFor(key: string): string {
  const parts = key.split("_");
  const stage = parts.length;
  const base = { STUDY: "学力系", STAMINA: "体力系", LIFE: "生活系" }[parts[0]] ?? "";
  return `Stage ${stage} · ${base}`;
}

export function MonstersSection({ s }: { s: Record<string, string> }) {
  const [monsterStyle, setMonsterStyle] = useState<MonsterStyle>("dark");
  const [selected, setSelected] = useState<SelectedMonster | null>(null);

  const openModal = (monsterKey: string) => {
    setSelected({ monsterKey, style: monsterStyle });
  };

  const selectedEntry = selected
    ? (selected.style === "dark" ? MONSTER_TABLE : MONSTER_TABLE_LIGHT)[selected.monsterKey]
    : null;

  return (
    <section id="monsters" className={`${s.section} ${s.monsterSection}`}>
      <div className={`${s.orb} ${s.monsterOrbM1}`} />
      <div className={`${s.orb} ${s.monsterOrbM2}`} />
      <div className={s.container} style={{ position: "relative", zIndex: 1 }}>
        <h2 className={`${s.sectionHeading} ${s.fadeIn}`}>MONSTER COLLECTION</h2>
        <p className={`${s.sectionSub} ${s.fadeIn}`}>3系統 × 3ステージ = 39系統 × 「カッコいい」「かわいい」の2スタイル</p>
        <div className={`${s.divider} ${s.fadeIn}`} />

        {/* スタイル切り替えトグル */}
        <div className={`${s.styleToggleWrap} ${s.fadeIn}`}>
          <button
            type="button"
            className={`${s.styleToggleBtn} ${monsterStyle === "dark" ? s.activeDark : ""}`}
            onClick={() => setMonsterStyle("dark")}
          >
            ⚡ カッコいい系（ヒーロー）
          </button>
          <button
            type="button"
            className={`${s.styleToggleBtn} ${monsterStyle === "light" ? s.activeLight : ""}`}
            onClick={() => setMonsterStyle("light")}
          >
            🐾 かわいい系（どうぶつ）
          </button>
        </div>

        {/* カッコいい系（DARK） */}
        {monsterStyle === "dark" && (
          <div className={s.monsterPaths}>
            {/* STUDY系 */}
            <MonsterPath
              label={{ text: "📚 学力系", colorClass: s.pathLabelStudy }}
              s={s}
              onSelect={openModal}
              stage1={{ src: "/monsters/dark/STUDY_ラーン.webp", name: "ラーン", fallback: "📚", monsterKey: "STUDY" }}
              stage2={[
                { src: "/monsters/dark/STUDY_STUDY_ライブラ.webp", name: "ライブラ", fallback: "📚", revealed: true, monsterKey: "STUDY_STUDY" },
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
              label={{ text: "💪 体力系", colorClass: s.pathLabelStamina }}
              s={s}
              onSelect={openModal}
              stage1={{ src: "/monsters/dark/STAMINA_ストーン.webp", name: "ストーン", fallback: "💪", monsterKey: "STAMINA" }}
              stage2={[
                { src: "/monsters/dark/STAMINA_STAMINA_ブロック.webp", name: "ブロック", fallback: "🪨", revealed: true, monsterKey: "STAMINA_STAMINA" },
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
              label={{ text: "🌿 生活力系", colorClass: s.pathLabelLife }}
              s={s}
              onSelect={openModal}
              stage1={{ src: "/monsters/dark/LIFE_ヘルプ.webp", name: "ヘルプ", fallback: "🌿", monsterKey: "LIFE" }}
              stage2={[
                { src: "/monsters/dark/LIFE_LIFE_マザー.webp", name: "マザー", fallback: "🌿", revealed: true, monsterKey: "LIFE_LIFE" },
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
          <div className={s.monsterPaths}>
            {/* STUDY系 */}
            <MonsterPath
              label={{ text: "📚 学力系", colorClass: s.pathLabelStudy }}
              s={s}
              onSelect={openModal}
              stage1={{ src: "/monsters/light/STUDY_ルミナ.webp", name: "ルミナ", fallback: "📚", monsterKey: "STUDY" }}
              stage2={[
                { src: "/monsters/light/STUDY_STUDY_インテリキャット.webp", name: "インテリキャット", fallback: "🐱", revealed: true, monsterKey: "STUDY_STUDY" },
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
              label={{ text: "💪 体力系", colorClass: s.pathLabelStamina }}
              s={s}
              onSelect={openModal}
              stage1={{ src: "/monsters/light/STAMINA_アクティ.webp", name: "アクティ", fallback: "💪", monsterKey: "STAMINA" }}
              stage2={[
                { src: "/monsters/light/STAMINA_STAMINA_ブレイブレオ.webp", name: "ブレイブレオ", fallback: "🦁", revealed: true, monsterKey: "STAMINA_STAMINA" },
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
              label={{ text: "🌿 生活力系", colorClass: s.pathLabelLife }}
              s={s}
              onSelect={openModal}
              stage1={{ src: "/monsters/light/LIFE_メルル.webp", name: "メルル", fallback: "🌿", monsterKey: "LIFE" }}
              stage2={[
                { src: "/monsters/light/LIFE_LIFE_コットンラム.webp", name: "コットンラム", fallback: "🐑", revealed: true, monsterKey: "LIFE_LIFE" },
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
          <div className={`${s.monsterCountBadge} ${s.fadeIn}`}>
            <span>🥚</span>
            <span>たまご + stage1 <strong>3</strong> + stage2 <strong>9</strong> + stage3 <strong>27</strong> = <strong>40</strong>系統 × 2スタイル</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--dim)", marginTop: 12 }}>
            ※ 見えているモンスターをタップすると詳細が見られます
          </p>
        </div>

        {selected && selectedEntry && (
          <MonsterImageModal
            image={selectedEntry.image}
            monsterName={selectedEntry.name}
            stageLabel={stageLabelFor(selected.monsterKey)}
            description={selectedEntry.description}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </section>
  );
}
