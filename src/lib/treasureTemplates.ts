// 宝箱（ごほうび）プールのサンプルテンプレート。
// 親が「おすすめセットで始める」ときに一括投入される。
// 設計: docs/reword-system-design.md セクション 11

import type { TreasureRarity } from "@/lib/treasure";

export interface TreasureTemplate {
  title: string;
  rarity: TreasureRarity;
}

export const TREASURE_TEMPLATES: TreasureTemplate[] = [
  // よく出る (COMMON)
  { title: "おやつをひとつ選べる", rarity: "COMMON" },
  { title: "デザートを選べる", rarity: "COMMON" },
  { title: "今日のごはんリクエスト権", rarity: "COMMON" },
  { title: "YouTube あと15分OK", rarity: "COMMON" },
  { title: "寝る時間15分延長", rarity: "COMMON" },
  { title: "入浴剤を選べる", rarity: "COMMON" },
  { title: "宿題の順番を自分で決められる", rarity: "COMMON" },

  // ときどき (UNCOMMON)
  { title: "好きなアイスを買える", rarity: "UNCOMMON" },
  { title: "お手伝い1回パス券", rarity: "UNCOMMON" },
  { title: "映画をひとつ選んで家族で観る", rarity: "UNCOMMON" },
  { title: "ゲーム +30分延長", rarity: "UNCOMMON" },
  { title: "夕飯メニュー決定権", rarity: "UNCOMMON" },
  { title: "週末の行き先リクエスト権", rarity: "UNCOMMON" },
  { title: "好きなジュースを買える", rarity: "UNCOMMON" },

  // たまに (RARE)
  { title: "好きな本・マンガ1冊", rarity: "RARE" },
  { title: "友達とお出かけ（親が送迎）", rarity: "RARE" },
  { title: "好きな文房具を買える", rarity: "RARE" },
  { title: "家族ゲーム大会の種目決定権", rarity: "RARE" },
  { title: "1日だけ夜ふかしOK券", rarity: "RARE" },
  { title: "週末に行きたいところに連れていってもらえる", rarity: "RARE" },
];
