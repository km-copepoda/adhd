// モンスターテーマセットのレジストリ（データ定義層）。
// dark/light は既定の無料テーマ、buddha は有料テーマ（Issue #73 モンスターテーマセット Stage1）。
//
// NOTE: `src/lib/monsterThemes.ts`（DB操作層）とは別ファイル。
// Node/TS のモジュール解決では拡張子付きファイルがディレクトリの index より優先されるため、
// `@/lib/monsterThemes` は DB操作層に解決される。このレジストリを参照する場合は
// `@/lib/monsterThemes/index` を明示的にインポートすること。

import { MONSTER_TABLE, MONSTER_TABLE_LIGHT, EGG_STAGE, EGG_STAGE_LIGHT } from "@/lib/monsters";
import { MONSTER_TABLE as BUDDHA_TABLE, EGG_STAGE as BUDDHA_EGG_STAGE } from "@/lib/monsterThemes/buddha";

export type MonsterThemeDefinition = {
  id: string;
  label: string;
  description: string;
  thumbnail: string;
  eggImage: string;
  table: Record<string, { image: string; name: string; description: string }>;
  isFree: boolean;
  /** 転生卵選択ボーナス（STUDY/STAMINA/LIFE）の画像。
   *  未定義のテーマは既定の egg-study/egg-stamina/egg-life 画像にフォールバックする
   *  （@/lib/monsterThemes/eggs の getRebirthEggImage 参照）。 */
  rebirthEggImages?: Record<"STUDY" | "STAMINA" | "LIFE", string>;
};

export const MONSTER_THEMES: Record<string, MonsterThemeDefinition> = {
  dark: {
    id: "dark",
    label: "ダーク",
    description: "かっこいい系のモンスターセット。",
    thumbnail: MONSTER_TABLE["STUDY"].image,
    eggImage: EGG_STAGE.image,
    table: MONSTER_TABLE,
    isFree: true,
  },
  light: {
    id: "light",
    label: "ライト",
    description: "かわいい系のモンスターセット。",
    thumbnail: MONSTER_TABLE_LIGHT["STUDY"].image,
    eggImage: EGG_STAGE_LIGHT.image,
    table: MONSTER_TABLE_LIGHT,
    isFree: true,
  },
  buddha: {
    id: "buddha",
    label: "仏様",
    description: "仏様・神様モチーフのモンスターセット。",
    thumbnail: BUDDHA_TABLE["STUDY"].image,
    eggImage: BUDDHA_EGG_STAGE.image,
    table: BUDDHA_TABLE,
    isFree: false,
    rebirthEggImages: {
      STUDY: "/monsters/buddha/egg-stone.webp",
      STAMINA: "/monsters/buddha/egg-stone.webp",
      LIFE: "/monsters/buddha/egg-stone.webp",
    },
  },
};
