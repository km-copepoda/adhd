// 宝箱コレクションアイテムのマスターデータ。
// 仕様: docs/未実装仕様書/treasure-collection-items.md
//
// - 全 80 種 (春/夏/秋/冬 × 20種)。各シーズン COMMON 10 / UNCOMMON 6 / RARE 4。
// - DB ではなくコード管理。子供の所持実績だけ UserCollectionItem に保存する。
// - 画像は public/collection-items/{season}/{filename} に配置。
//   春と冬は画像未制作のため dummy.png を使用 (image: DUMMY_IMAGE)。

export type CollectionSeason = "spring" | "summer" | "fall" | "winter";
export type CollectionRarity = "COMMON" | "UNCOMMON" | "RARE";
export type CollectionCategory = "creature" | "food" | "jewel" | "tool" | "nature";

export interface CollectionItem {
  id: string;
  season: CollectionSeason;
  category: CollectionCategory;
  rarity: CollectionRarity;
  name: string;
  description: string;
  image: string;
}

const DUMMY_IMAGE = "/collection-items/dummy.webp";

function img(season: CollectionSeason, filename: string | null): string {
  if (!filename) return DUMMY_IMAGE;
  return `/collection-items/${season}/${filename}`;
}

const SPRING_ITEMS: CollectionItem[] = [
  // いきもの
  { id: "spring-01", season: "spring", category: "creature", rarity: "COMMON",   name: "モンシロチョウ",   description: "花から花へひらひらと",                       image: img("spring", "モンシロチョウ.webp") },
  { id: "spring-02", season: "spring", category: "creature", rarity: "COMMON",   name: "オタマジャクシ",   description: "まだ足が生えてないちびっこ",                 image: img("spring", "オタマジャクシ.webp") },
  { id: "spring-03", season: "spring", category: "creature", rarity: "UNCOMMON", name: "ウグイス",         description: "ホーホケキョ！春をつげる声",                 image: img("spring", "ウグイス.webp") },
  { id: "spring-04", season: "spring", category: "creature", rarity: "RARE",     name: "桜龍",             description: "花びらの中から現れる春だけの龍",             image: img("spring", "桜龍.webp") },
  // たべもの
  { id: "spring-05", season: "spring", category: "food",     rarity: "COMMON",   name: "さくらもち",       description: "葉っぱごと食べる派？",                       image: img("spring", "さくらもち.webp") },
  { id: "spring-06", season: "spring", category: "food",     rarity: "COMMON",   name: "いちご",           description: "あまずっぱい春のおやつ",                     image: img("spring", "いちご.webp") },
  { id: "spring-07", season: "spring", category: "food",     rarity: "UNCOMMON", name: "三色だんご",       description: "ピンク・白・みどりのなかよし3兄弟",          image: img("spring", "三色だんご.webp") },
  { id: "spring-08", season: "spring", category: "food",     rarity: "RARE",     name: "花のはちみつ",     description: "春の花だけで作った黄金色のはちみつ",         image: img("spring", "花のはちみつ.webp") },
  // ほうせき
  { id: "spring-09", season: "spring", category: "jewel",    rarity: "COMMON",   name: "桜色の石",         description: "うすいピンクがきれいな小石",                 image: img("spring", "桜色の石.webp") },
  { id: "spring-10", season: "spring", category: "jewel",    rarity: "COMMON",   name: "つくしの化石",     description: "大むかしの春がとじこめられてる",             image: img("spring", "つくしの化石.webp") },
  { id: "spring-11", season: "spring", category: "jewel",    rarity: "UNCOMMON", name: "ローズクォーツ",   description: "やさしいピンクの愛の石",                     image: img("spring", "ローズクォーツ.webp") },
  { id: "spring-12", season: "spring", category: "jewel",    rarity: "RARE",     name: "春風のかけら",     description: "ビンに閉じこめたあたたかい風",               image: img("spring", "春風のかけら.webp") },
  // どうぐ
  { id: "spring-13", season: "spring", category: "tool",     rarity: "COMMON",   name: "花かんむり",       description: "野の花をあつめて作った",                     image: img("spring", "花かんむり.webp") },
  { id: "spring-14", season: "spring", category: "tool",     rarity: "COMMON",   name: "たんぽぽの綿毛",   description: "ふーっと息をふいてとばそう",                 image: img("spring", "たんぽぽの綿毛.webp") },
  { id: "spring-15", season: "spring", category: "tool",     rarity: "UNCOMMON", name: "春のスケッチブック", description: "開くと絵がうごきだす",                     image: img("spring", "春のスケッチブック.webp") },
  { id: "spring-16", season: "spring", category: "tool",     rarity: "RARE",     name: "妖精のふえ",       description: "吹くとまわりに花が咲く",                     image: img("spring", "妖精のふえ.webp") },
  // しぜん
  { id: "spring-17", season: "spring", category: "nature",   rarity: "COMMON",   name: "つくし",           description: "春いちばんに顔を出す",                       image: img("spring", "つくし.webp") },
  { id: "spring-18", season: "spring", category: "nature",   rarity: "COMMON",   name: "菜の花",           description: "黄色いじゅうたんみたい",                     image: img("spring", "菜の花.webp") },
  { id: "spring-19", season: "spring", category: "nature",   rarity: "UNCOMMON", name: "春がすみ",         description: "朝もやの中にかくれた風景",                   image: img("spring", "春がすみ.webp") },
  { id: "spring-20", season: "spring", category: "nature",   rarity: "RARE",     name: "千年桜の花びら",   description: "千年に一度だけ咲く桜から落ちた一枚",         image: img("spring", "千年桜の花びら.webp") },
];

const SUMMER_ITEMS: CollectionItem[] = [
  // いきもの
  { id: "summer-01", season: "summer", category: "creature", rarity: "COMMON",   name: "カブトムシ",         description: "夏の王様。つのがかっこいい",                 image: img("summer", "カブトムシ.webp") },
  { id: "summer-02", season: "summer", category: "creature", rarity: "COMMON",   name: "セミのぬけがら",     description: "木の幹にしがみついてた",                     image: img("summer", "セミのぬけがら.webp") },
  { id: "summer-03", season: "summer", category: "creature", rarity: "UNCOMMON", name: "クラゲ",             description: "ゆらゆら光る海のランプ",                     image: img("summer", "クラゲ.webp") },
  { id: "summer-04", season: "summer", category: "creature", rarity: "RARE",     name: "リュウグウノツカイ", description: "深海からあらわれた伝説の魚",                 image: img("summer", "リュウグウノツカイ.webp") },
  // たべもの
  { id: "summer-05", season: "summer", category: "food",     rarity: "COMMON",   name: "スイカ",             description: "たたくといい音がする",                       image: img("summer", "スイカ.webp") },
  { id: "summer-06", season: "summer", category: "food",     rarity: "COMMON",   name: "かきごおり",         description: "シロップはブルーハワイ派",                   image: img("summer", "かきごおり.webp") },
  { id: "summer-07", season: "summer", category: "food",     rarity: "UNCOMMON", name: "わたあめ",           description: "ふわふわで雲みたいなやつ",                   image: img("summer", "わたあめ.webp") },
  { id: "summer-08", season: "summer", category: "food",     rarity: "RARE",     name: "流れ星ソーダ",       description: "飲むと体がキラキラ光る夜だけのジュース",     image: img("summer", "流れ星ソーダ.webp") },
  // ほうせき
  { id: "summer-09", season: "summer", category: "jewel",    rarity: "COMMON",   name: "シーグラス",         description: "波にみがかれたガラスのかけら",               image: img("summer", "シーグラス.webp") },
  { id: "summer-10", season: "summer", category: "jewel",    rarity: "COMMON",   name: "貝がら",             description: "耳にあてると海の音がする",                   image: img("summer", "貝がら.webp") },
  { id: "summer-11", season: "summer", category: "jewel",    rarity: "UNCOMMON", name: "真珠",               description: "貝の中でひっそり育った光のつぶ",             image: img("summer", "真珠.webp") },
  { id: "summer-12", season: "summer", category: "jewel",    rarity: "RARE",     name: "人魚のうろこ",       description: "太陽にかざすと七色にかがやく",               image: img("summer", "人魚のうろこ.webp") },
  // どうぐ
  { id: "summer-13", season: "summer", category: "tool",     rarity: "COMMON",   name: "むしとりあみ",       description: "夏休みの必須アイテム",                       image: img("summer", "むしとりあみ.webp") },
  { id: "summer-14", season: "summer", category: "tool",     rarity: "COMMON",   name: "ビーチサンダル",     description: "ペタペタ音がたのしい",                       image: img("summer", "ビーチサンダル.webp") },
  { id: "summer-15", season: "summer", category: "tool",     rarity: "UNCOMMON", name: "花火セット",         description: "線香花火が最後まで残ったら勝ち",             image: img("summer", "花火セット.webp") },
  { id: "summer-16", season: "summer", category: "tool",     rarity: "RARE",     name: "まぼろしの貝笛",     description: "吹くと海の生き物があつまってくる",           image: img("summer", "まぼろしの貝笛.webp") },
  // しぜん
  { id: "summer-17", season: "summer", category: "nature",   rarity: "COMMON",   name: "ひまわり",           description: "太陽にむかってまっすぐのびる",               image: img("summer", "ひまわり.webp") },
  { id: "summer-18", season: "summer", category: "nature",   rarity: "COMMON",   name: "入道雲",             description: "もくもく育つ夏のしるし",                     image: img("summer", "入道雲.webp") },
  { id: "summer-19", season: "summer", category: "nature",   rarity: "UNCOMMON", name: "にじ",               description: "夕立のあとにかかるごほうび",                 image: img("summer", "にじ.webp") },
  { id: "summer-20", season: "summer", category: "nature",   rarity: "RARE",     name: "天の川のひとしずく", description: "七夕の夜にだけ降ってくる星のしずく",         image: img("summer", "天の川のひとしずく.webp") },
];

const FALL_ITEMS: CollectionItem[] = [
  // いきもの
  { id: "fall-01",   season: "fall",   category: "creature", rarity: "COMMON",   name: "アキアカネ",         description: "夕やけの中をとぶ赤とんぼ",                   image: img("fall", "アキアカネ.webp") },
  { id: "fall-02",   season: "fall",   category: "creature", rarity: "COMMON",   name: "スズムシ",           description: "リーンリーンと秋を歌う",                     image: img("fall", "スズムシ.webp") },
  { id: "fall-03",   season: "fall",   category: "creature", rarity: "UNCOMMON", name: "フクロウ（秋羽）",   description: "紅葉色の羽をまとった森の番人",               image: img("fall", "フクロウ（秋羽）.webp") },
  { id: "fall-04",   season: "fall",   category: "creature", rarity: "RARE",     name: "月うさぎ",           description: "満月の夜だけ現れるふしぎなうさぎ",           image: img("fall", "月うさぎ.webp") },
  // たべもの
  { id: "fall-05",   season: "fall",   category: "food",     rarity: "COMMON",   name: "やきいも",           description: "ホクホクあつあつ。ほっぺが落ちる",           image: img("fall", "やきいも.webp") },
  { id: "fall-06",   season: "fall",   category: "food",     rarity: "COMMON",   name: "くり",               description: "トゲトゲの中身はあまい",                     image: img("fall", "くり.webp") },
  { id: "fall-07",   season: "fall",   category: "food",     rarity: "UNCOMMON", name: "月見だんご",         description: "お月さまにおそなえするまんまるだんご",       image: img("fall", "月見だんご.webp") },
  { id: "fall-08",   season: "fall",   category: "food",     rarity: "RARE",     name: "黄金のまつたけ",     description: "見つけたら一生ラッキーな伝説のきのこ",       image: img("fall", "黄金のまつたけ.webp") },
  // ほうせき
  { id: "fall-09",   season: "fall",   category: "jewel",    rarity: "COMMON",   name: "琥珀",               description: "虫が閉じこめられた太古のたからもの",         image: img("fall", "琥珀.webp") },
  { id: "fall-10",   season: "fall",   category: "jewel",    rarity: "COMMON",   name: "もみじの化石",       description: "何万年も前の秋がのこってる",                 image: img("fall", "もみじの化石.webp") },
  { id: "fall-11",   season: "fall",   category: "jewel",    rarity: "UNCOMMON", name: "タイガーアイ",       description: "トラの目みたいにギラッと光る",               image: img("fall", "タイガーアイ.webp") },
  { id: "fall-12",   season: "fall",   category: "jewel",    rarity: "RARE",     name: "月光石",             description: "月の光をあつめて固めた石",                   image: img("fall", "月光石.webp") },
  // どうぐ
  { id: "fall-13",   season: "fall",   category: "tool",     rarity: "COMMON",   name: "落ち葉",             description: "カサカサいい音がする",                       image: img("fall", "落ち葉.webp") },
  { id: "fall-14",   season: "fall",   category: "tool",     rarity: "COMMON",   name: "どんぐりごま",       description: "指でくるくるまわせる",                       image: img("fall", "どんぐりごま.webp") },
  { id: "fall-15",   season: "fall",   category: "tool",     rarity: "UNCOMMON", name: "秋の絵はがき",       description: "紅葉の山が描かれたふしぎなカード",           image: img("fall", "秋の絵はがき.webp") },
  { id: "fall-16",   season: "fall",   category: "tool",     rarity: "RARE",     name: "星月夜のランタン",   description: "火をつけると星空がうかびあがる",             image: img("fall", "星月夜のランタン.webp") },
  // しぜん
  { id: "fall-17",   season: "fall",   category: "nature",   rarity: "COMMON",   name: "紅葉",               description: "赤と黄色のグラデーション",                   image: img("fall", "紅葉.webp") },
  { id: "fall-18",   season: "fall",   category: "nature",   rarity: "COMMON",   name: "すすき",             description: "風にゆれる秋のシンボル",                     image: img("fall", "すすき.webp") },
  { id: "fall-19",   season: "fall",   category: "nature",   rarity: "UNCOMMON", name: "きんもくせいの香り", description: "ビンを開けると秋の匂いがふわっと",           image: img("fall", "きんもくせいの香り.webp") },
  { id: "fall-20",   season: "fall",   category: "nature",   rarity: "RARE",     name: "十五夜の月のかけら", description: "一年でいちばんきれいな月のひとかけ",         image: img("fall", "十五夜の月のかけら.webp") },
];

const WINTER_ITEMS: CollectionItem[] = [
  // いきもの
  { id: "winter-01", season: "winter", category: "creature", rarity: "COMMON",   name: "ゆきうさぎ",         description: "雪で作ったうさぎ…と思ったら動いた！",        image: img("winter", "ゆきうさぎ.webp") },
  { id: "winter-02", season: "winter", category: "creature", rarity: "COMMON",   name: "シマエナガ",         description: "まんまるもふもふの雪の妖精",                 image: img("winter", "シマエナガ.webp") },
  { id: "winter-03", season: "winter", category: "creature", rarity: "UNCOMMON", name: "ペンギン",           description: "よちよち歩きがかわいい氷の住人",             image: img("winter", "ペンギン.webp") },
  { id: "winter-04", season: "winter", category: "creature", rarity: "RARE",     name: "氷龍",               description: "吐息で何でも凍らせる冬だけの龍",             image: img("winter", "氷龍.webp") },
  // たべもの
  { id: "winter-05", season: "winter", category: "food",     rarity: "COMMON",   name: "肉まん",             description: "ほかほかの湯気がごちそう",                   image: img("winter", "肉まん.webp") },
  { id: "winter-06", season: "winter", category: "food",     rarity: "COMMON",   name: "ココア",             description: "あったまる冬のともだち",                     image: img("winter", "ココア.webp") },
  { id: "winter-07", season: "winter", category: "food",     rarity: "UNCOMMON", name: "クリスマスケーキ",   description: "いちごとクリームのスペシャル",               image: img("winter", "クリスマスケーキ.webp") },
  { id: "winter-08", season: "winter", category: "food",     rarity: "RARE",     name: "北極星のこんぺいとう", description: "食べると体がほんのり光る冬限定のお菓子",   image: img("winter", "北極星のこんぺいとう.webp") },
  // ほうせき
  { id: "winter-09", season: "winter", category: "jewel",    rarity: "COMMON",   name: "つらら",             description: "太陽があたるとキラキラ光る",                 image: img("winter", "つらら.webp") },
  { id: "winter-10", season: "winter", category: "jewel",    rarity: "COMMON",   name: "霜の結晶",           description: "窓ガラスにできた自然のアート",               image: img("winter", "霜の結晶.webp") },
  { id: "winter-11", season: "winter", category: "jewel",    rarity: "UNCOMMON", name: "ムーンストーン",     description: "冬の月みたいに青白く光る",                   image: img("winter", "ムーンストーン.webp") },
  { id: "winter-12", season: "winter", category: "jewel",    rarity: "RARE",     name: "ダイヤモンドダスト", description: "空気中にキラキラ舞う氷の宝石",               image: img("winter", "ダイヤモンドダスト.webp") },
  // どうぐ
  { id: "winter-13", season: "winter", category: "tool",     rarity: "COMMON",   name: "毛糸の手ぶくろ",     description: "おばあちゃんが編んでくれた",                 image: img("winter", "毛糸の手ぶくろ.webp") },
  { id: "winter-14", season: "winter", category: "tool",     rarity: "COMMON",   name: "ゆきだるまの帽子",   description: "かぶると雪がふりだすらしい",                 image: img("winter", "ゆきだるまの帽子.webp") },
  { id: "winter-15", season: "winter", category: "tool",     rarity: "UNCOMMON", name: "クリスマスのくつした", description: "枕もとに置くとプレゼントが…？",           image: img("winter", "クリスマスのくつした.webp") },
  { id: "winter-16", season: "winter", category: "tool",     rarity: "RARE",     name: "サンタのそり笛",     description: "吹くとトナカイがやってくる",                 image: img("winter", "サンタのそり笛.webp") },
  // しぜん
  { id: "winter-17", season: "winter", category: "nature",   rarity: "COMMON",   name: "雪の結晶",           description: "同じ形はふたつとない",                       image: img("winter", "雪の結晶.webp") },
  { id: "winter-18", season: "winter", category: "nature",   rarity: "COMMON",   name: "冬芽",               description: "寒さの中でじっと春を待ってる",               image: img("winter", "冬芽.webp") },
  { id: "winter-19", season: "winter", category: "nature",   rarity: "UNCOMMON", name: "氷の花",             description: "水たまりにさいた冬だけの花",                 image: img("winter", "氷の花.webp") },
  { id: "winter-20", season: "winter", category: "nature",   rarity: "RARE",     name: "オーロラのカーテン", description: "北の空にゆれる光のカーテン",                 image: img("winter", "オーロラのカーテン.webp") },
];

export const ALL_COLLECTION_ITEMS: CollectionItem[] = [
  ...SPRING_ITEMS,
  ...SUMMER_ITEMS,
  ...FALL_ITEMS,
  ...WINTER_ITEMS,
];

const BY_ID = new Map<string, CollectionItem>(ALL_COLLECTION_ITEMS.map((i) => [i.id, i]));

export function getItemsBySeason(season: CollectionSeason): CollectionItem[] {
  return ALL_COLLECTION_ITEMS.filter((i) => i.season === season);
}

export function getCollectionItemById(id: string): CollectionItem | null {
  return BY_ID.get(id) ?? null;
}

export function getSeasonByMonth(month: number): CollectionSeason {
  if (month < 1 || month > 12) throw new RangeError(`month out of range: ${month}`);
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 任意の Date から JST 基準のシーズンを判定する。
 * シーズンの境界は JST 月初 (3/1, 6/1, 9/1, 12/1) 0:00。
 */
export function getSeasonForDate(date: Date): CollectionSeason {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return getSeasonByMonth(jst.getUTCMonth() + 1);
}

/**
 * 現在の JST 時刻からシーズンを判定する。
 */
export function getCurrentSeason(): CollectionSeason {
  return getSeasonForDate(new Date());
}

export const SEASON_LABEL: Record<CollectionSeason, string> = {
  spring: "春",
  summer: "夏",
  fall: "秋",
  winter: "冬",
};

export const CATEGORY_LABEL: Record<CollectionCategory, string> = {
  creature: "いきもの",
  food: "たべもの",
  jewel: "ほうせき",
  tool: "どうぐ",
  nature: "しぜん",
};
