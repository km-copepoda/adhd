import { MonsterImg } from "./MonsterImg";

type MonsterEntry = { src: string; name: string; fallback: string; revealed?: boolean };
type MonsterPathProps = {
  label: { text: string; colorClass: string };
  s: Record<string, string>;
  stage1: Omit<MonsterEntry, "revealed">;
  stage2: MonsterEntry[];
  stage3: MonsterEntry[];
};

export function MonsterPath({ label, s, stage1, stage2, stage3 }: MonsterPathProps) {
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
