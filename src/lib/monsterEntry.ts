// モンスター図鑑エントリの共有型（データ定義のみ、DB非依存）。
//
// src/lib/monsters.ts と src/lib/monsterThemes/buddha.ts の双方から参照される。
// monsters.ts は buddha.ts を import しているため、型定義を monsters.ts 側に置くと
// buddha.ts → monsters.ts の型 import で相互参照になってしまう。それを避けるため
// 独立ファイルとして切り出す（Issue #139）。

/** 1体のモンスターの表示データ（画像・名前・説明。かな表記込み）。 */
export type MonsterEntry = {
  image: string;
  name: string;
  nameKana: string;
  description: string;
  descriptionKana: string;
};

/**
 * 卵ステージや getMonsterStage の戻り値など、進化に必要なポイントを併せ持つ形状。
 * 最終ステージ（Stage3）には次の進化先が無いため、`ptToEvolve` は
 * `EVOLUTION_THRESHOLDS`（@/lib/evolution）の仕様に合わせて `null` を許容する。
 */
export type MonsterStage = MonsterEntry & {
  ptToEvolve: number | null;
};
