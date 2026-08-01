// 宝箱コレクションアイテムのマスターデータ。
// 仕様: docs/未実装仕様書/treasure-collection-items.md (通常 80種)
//       docs/未実装仕様書/monthly-limited-collection-items.md (月限定 60種、2026-07-21 追加)
//
// - 通常 80 種 (春/夏/秋/冬 × 20種)。各シーズン COMMON 10 / UNCOMMON 5 / RARE 5
// - 月限定 60 種 (1〜12月 × 5種)。各月 COMMON 2 / UNCOMMON 2 / RARE 1
//   月限定アイテムは `month` フィールドを持ち、id は `m{MM}-{NN}` 形式
// - DB ではなくコード管理。子供の所持実績だけ UserCollectionItem に保存する
// - 画像:
//   - 通常: public/collection-items/{season}/{filename}
//   - 月限定: public/collection-items/monthly/{MM}/{filename} (制作元 docs/キャラクター/コレクション/{N}月/ と同じ月別構成)
//   全 141 枚 (通常 80 + 月限定 60 + アレキサンドライト差し替え) 制作済み

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
  /** 月限定アイテムのみ設定 (1〜12)。通常アイテムは undefined */
  month?: number;
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
  // summer-11: 元「真珠」。6月の誕生石を「真珠」(m06-04) に割り当てるため、
  // 名称重複を避けて「アレキサンドライト」に改名 (2026-07-21)。
  // id は維持することで既存の UserCollectionItem レコードをそのまま新名称に引き継ぐ。
  { id: "summer-11", season: "summer", category: "jewel",    rarity: "UNCOMMON", name: "アレキサンドライト", description: "昼と夜で色が変わるふしぎな石",               image: img("summer", "アレキサンドライト.webp") },
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

// ─── 月限定アイテム (60種、2026-07-21 追加) ───────────────────────────
// 各月 5種 (COMMON 2 / UNCOMMON 2 / RARE 1)。「ほうせき」枠は毎月の誕生石。
// 画像は制作元 docs/キャラクター/コレクション/{N}月/*.png と同じく月ごとサブディレクトリで
// 整理する: /collection-items/monthly/{MM}/{name}.webp
// filename に null を渡せば DUMMY_IMAGE を返す (画像未制作時のフォールバック)。
function monthly(month: number, filename: string | null): string {
  if (!filename) return DUMMY_IMAGE;
  const mm = String(month).padStart(2, "0");
  return `/collection-items/monthly/${mm}/${filename}`;
}

const MONTHLY_ITEMS: CollectionItem[] = [
  // 1月 — お正月
  { id: "m01-01", month: 1,  season: "winter", category: "food",     rarity: "COMMON",   name: "鏡もち",             description: "みかんの帽子がちょこんとのってる",             image: monthly(1, "鏡もち.webp") },
  { id: "m01-02", month: 1,  season: "winter", category: "tool",     rarity: "COMMON",   name: "たこあげ",           description: "お正月の空たかくのぼれ！",                     image: monthly(1, "たこあげ.webp") },
  { id: "m01-03", month: 1,  season: "winter", category: "creature", rarity: "UNCOMMON", name: "獅子舞",             description: "あたまをかまれると一年しあわせになれる",       image: monthly(1, "獅子舞.webp") },
  { id: "m01-04", month: 1,  season: "winter", category: "jewel",    rarity: "UNCOMMON", name: "ガーネット",         description: "1月生まれの守り石。冬に燃える赤",             image: monthly(1, "ガーネット.webp") },
  { id: "m01-05", month: 1,  season: "winter", category: "nature",   rarity: "RARE",     name: "初日の出のひかり",   description: "一年でいちばん最初の太陽の光をビンにつめた",   image: monthly(1, "初日の出のひかり.webp") },
  // 2月 — 節分・バレンタイン
  { id: "m02-01", month: 2,  season: "winter", category: "food",     rarity: "COMMON",   name: "恵方巻",             description: "しゃべらずに食べきれたら願いがかなう",         image: monthly(2, "恵方巻.webp") },
  { id: "m02-02", month: 2,  season: "winter", category: "nature",   rarity: "COMMON",   name: "ふきのとう",         description: "雪の下から顔を出す春のさきがけ",               image: monthly(2, "ふきのとう.webp") },
  { id: "m02-03", month: 2,  season: "winter", category: "tool",     rarity: "UNCOMMON", name: "鬼のお面",           description: "おにはーそと！ふくはーうち！",                 image: monthly(2, "鬼のお面.webp") },
  { id: "m02-04", month: 2,  season: "winter", category: "jewel",    rarity: "UNCOMMON", name: "アメジスト",         description: "2月生まれの守り石。むらさきの夜の色",         image: monthly(2, "アメジスト.webp") },
  { id: "m02-05", month: 2,  season: "winter", category: "creature", rarity: "RARE",     name: "子オニ",             description: "節分の夜にはぐれた、心やさしいちびっこオニ",   image: monthly(2, "子オニ.webp") },
  // 3月 — ひなまつり・卒業
  { id: "m03-01", month: 3,  season: "spring", category: "food",     rarity: "COMMON",   name: "ひなあられ",         description: "ピンク・白・みどりのカラフルなおこし",         image: monthly(3, "ひなあられ.webp") },
  { id: "m03-02", month: 3,  season: "spring", category: "creature", rarity: "COMMON",   name: "メジロ",             description: "梅の花のみつが大好物なうぐいす色の小鳥",       image: monthly(3, "メジロ.webp") },
  { id: "m03-03", month: 3,  season: "spring", category: "tool",     rarity: "UNCOMMON", name: "ぼんぼり",           description: "おひなさまをやさしく照らすあかり",             image: monthly(3, "ぼんぼり.webp") },
  { id: "m03-04", month: 3,  season: "spring", category: "jewel",    rarity: "UNCOMMON", name: "アクアマリン",       description: "3月生まれの守り石。春の海の色",               image: monthly(3, "アクアマリン.webp") },
  { id: "m03-05", month: 3,  season: "spring", category: "nature",   rarity: "RARE",     name: "たびだちの花たば",   description: "卒業式の日にもらえる、ずっと枯れない花たば",   image: monthly(3, "たびだちの花たば.webp") },
  // 4月 — 入学・お花見・イースター
  { id: "m04-01", month: 4,  season: "spring", category: "creature", rarity: "COMMON",   name: "ツバメ",             description: "軒下に巣を作りに、海をこえて帰ってきた",       image: monthly(4, "ツバメ.webp") },
  { id: "m04-02", month: 4,  season: "spring", category: "nature",   rarity: "COMMON",   name: "桜吹雪",             description: "ひらひら舞う花びらのシャワー",                 image: monthly(4, "桜吹雪.webp") },
  { id: "m04-03", month: 4,  season: "spring", category: "tool",     rarity: "UNCOMMON", name: "ピカピカのランドセル", description: "新1年生のしるし。まだ革のにおいがする",       image: monthly(4, "ピカピカのランドセル.webp") },
  { id: "m04-04", month: 4,  season: "spring", category: "jewel",    rarity: "UNCOMMON", name: "ダイヤモンド",       description: "4月生まれの守り石。世界でいちばんかたい輝き", image: monthly(4, "ダイヤモンド.webp") },
  { id: "m04-05", month: 4,  season: "spring", category: "food",     rarity: "RARE",     name: "虹色イースターエッグ", description: "中から何が出てくるかはわってからのおたのしみ", image: monthly(4, "虹色イースターエッグ.webp") },
  // 5月 — こどもの日・母の日
  { id: "m05-01", month: 5,  season: "spring", category: "food",     rarity: "COMMON",   name: "かしわもち",         description: "葉っぱのおふとんにくるまったおもち",           image: monthly(5, "かしわもち.webp") },
  { id: "m05-02", month: 5,  season: "spring", category: "creature", rarity: "COMMON",   name: "テントウムシ",       description: "手にとまったら幸運のしるし",                   image: monthly(5, "テントウムシ.webp") },
  { id: "m05-03", month: 5,  season: "spring", category: "tool",     rarity: "UNCOMMON", name: "こいのぼり",         description: "屋根より高く、風をのんでおよぐ",               image: monthly(5, "こいのぼり.webp") },
  { id: "m05-04", month: 5,  season: "spring", category: "jewel",    rarity: "UNCOMMON", name: "エメラルド",         description: "5月生まれの守り石。新緑のみどり",             image: monthly(5, "エメラルド.webp") },
  { id: "m05-05", month: 5,  season: "spring", category: "nature",   rarity: "RARE",     name: "雲のこいのぼり",     description: "五月晴れの空にあらわれる、雲でできた巨大こいのぼり", image: monthly(5, "雲のこいのぼり.webp") },
  // 6月 — 梅雨・ホタル
  { id: "m06-01", month: 6,  season: "summer", category: "nature",   rarity: "COMMON",   name: "あじさい",           description: "雨の日がだいすきな、色変わりの花",             image: monthly(6, "あじさい.webp") },
  { id: "m06-02", month: 6,  season: "summer", category: "creature", rarity: "COMMON",   name: "カタツムリ",         description: "あじさいの葉っぱの上をのんびりおさんぽ",       image: monthly(6, "カタツムリ.webp") },
  { id: "m06-03", month: 6,  season: "summer", category: "tool",     rarity: "UNCOMMON", name: "てるてる坊主",       description: "あーした天気になあれ！",                       image: monthly(6, "てるてる坊主.webp") },
  { id: "m06-04", month: 6,  season: "summer", category: "jewel",    rarity: "UNCOMMON", name: "真珠",               description: "6月生まれの守り石。貝の中でひっそり育った光のつぶ", image: monthly(6, "真珠.webp") },
  { id: "m06-05", month: 6,  season: "summer", category: "creature", rarity: "RARE",     name: "ホタル",             description: "夜の川辺にうかぶ小さな光。見つけたらラッキー", image: monthly(6, "ホタル.webp") },
  // 7月 — 七夕・海びらき
  { id: "m07-01", month: 7,  season: "summer", category: "food",     rarity: "COMMON",   name: "ラムネ",             description: "ビー玉がカラカラ鳴る夏の音",                   image: monthly(7, "ラムネ.webp") },
  { id: "m07-02", month: 7,  season: "summer", category: "creature", rarity: "COMMON",   name: "すなはまのカニ",     description: "横歩きの名人。あなを掘るのも速い",             image: monthly(7, "すなはまのカニ.webp") },
  { id: "m07-03", month: 7,  season: "summer", category: "tool",     rarity: "UNCOMMON", name: "たんざく",           description: "ねがいごとを書いて笹にむすぼう",               image: monthly(7, "たんざく.webp") },
  { id: "m07-04", month: 7,  season: "summer", category: "jewel",    rarity: "UNCOMMON", name: "ルビー",             description: "7月生まれの守り石。真夏の太陽の赤",           image: monthly(7, "ルビー.webp") },
  { id: "m07-05", month: 7,  season: "summer", category: "jewel",    rarity: "RARE",     name: "織姫のはたおり糸",   description: "七夕の夜、天の川をわたるためのきらめく糸",     image: monthly(7, "織姫のはたおり糸.webp") },
  // 8月 — 夏まつり・花火大会
  { id: "m08-01", month: 8,  season: "summer", category: "food",     rarity: "COMMON",   name: "りんごあめ",         description: "つやつや真っ赤なお祭りの宝石",                 image: monthly(8, "りんごあめ.webp") },
  { id: "m08-02", month: 8,  season: "summer", category: "creature", rarity: "COMMON",   name: "ヒグラシ",           description: "カナカナカナ…夕ぐれの合図",                   image: monthly(8, "ヒグラシ.webp") },
  { id: "m08-03", month: 8,  season: "summer", category: "tool",     rarity: "UNCOMMON", name: "お祭りのお面",       description: "キツネ？ヒーロー？今日はどれにする？",         image: monthly(8, "お祭りのお面.webp") },
  { id: "m08-04", month: 8,  season: "summer", category: "jewel",    rarity: "UNCOMMON", name: "ペリドット",         description: "8月生まれの守り石。太陽が生んだ石",           image: monthly(8, "ペリドット.webp") },
  { id: "m08-05", month: 8,  season: "summer", category: "nature",   rarity: "RARE",     name: "打ち上げ花火のたね", description: "植えると夜空に大輪の花がさく…かもしれない",   image: monthly(8, "打ち上げ花火のたね.webp") },
  // 9月 — 運動会・実りの秋
  { id: "m09-01", month: 9,  season: "fall",   category: "food",     rarity: "COMMON",   name: "ぶどう",             description: "つぶつぶむらさきの宝石ふさ",                   image: monthly(9, "ぶどう.webp") },
  { id: "m09-02", month: 9,  season: "fall",   category: "nature",   rarity: "COMMON",   name: "コスモス",           description: "秋風にゆれるピンクのじゅうたん",               image: monthly(9, "コスモス.webp") },
  { id: "m09-03", month: 9,  season: "fall",   category: "creature", rarity: "UNCOMMON", name: "カマキリ",           description: "かまをかまえた秋の草むらのハンター",           image: monthly(9, "カマキリ.webp") },
  { id: "m09-04", month: 9,  season: "fall",   category: "jewel",    rarity: "UNCOMMON", name: "サファイア",         description: "9月生まれの守り石。夜空の青",                 image: monthly(9, "サファイア.webp") },
  { id: "m09-05", month: 9,  season: "fall",   category: "tool",     rarity: "RARE",     name: "かけっこの魔法ぐつ", description: "はくと風みたいに速く走れる運動会のひみつどうぐ", image: monthly(9, "かけっこの魔法ぐつ.webp") },
  // 10月 — ハロウィン
  { id: "m10-01", month: 10, season: "fall",   category: "food",     rarity: "COMMON",   name: "ハロウィンキャンディ", description: "トリック・オア・トリート！の戦利品",         image: monthly(10, "ハロウィンキャンディ.webp") },
  { id: "m10-02", month: 10, season: "fall",   category: "creature", rarity: "COMMON",   name: "黒ネコ",             description: "ハロウィンの夜の魔女の相棒",                   image: monthly(10, "黒ネコ.webp") },
  { id: "m10-03", month: 10, season: "fall",   category: "nature",   rarity: "UNCOMMON", name: "おばけかぼちゃ",     description: "畑でいちばん大きく育った顔つきかぼちゃ",       image: monthly(10, "おばけかぼちゃ.webp") },
  { id: "m10-04", month: 10, season: "fall",   category: "jewel",    rarity: "UNCOMMON", name: "オパール",           description: "10月生まれの守り石。虹をとじこめた石",       image: monthly(10, "オパール.webp") },
  { id: "m10-05", month: 10, season: "fall",   category: "tool",     rarity: "RARE",     name: "まじょのほうき",     description: "またがるとほんの少しだけ体がうく",             image: monthly(10, "まじょのほうき.webp") },
  // 11月 — 七五三・読書の秋
  { id: "m11-01", month: 11, season: "fall",   category: "creature", rarity: "COMMON",   name: "みのむし",           description: "落ち葉のコートでぬくぬく冬じたく",             image: monthly(11, "みのむし.webp") },
  { id: "m11-02", month: 11, season: "fall",   category: "nature",   rarity: "COMMON",   name: "イチョウのじゅうたん", description: "並木道が黄色一面にそまった",                 image: monthly(11, "イチョウのじゅうたん.webp") },
  { id: "m11-03", month: 11, season: "fall",   category: "food",     rarity: "UNCOMMON", name: "千歳あめ",           description: "ながーいあめ。ながーく元気でいられますように", image: monthly(11, "千歳あめ.webp") },
  { id: "m11-04", month: 11, season: "fall",   category: "jewel",    rarity: "UNCOMMON", name: "トパーズ",           description: "11月生まれの守り石。夕やけ色のきらめき",     image: monthly(11, "トパーズ.webp") },
  { id: "m11-05", month: 11, season: "fall",   category: "tool",     rarity: "RARE",     name: "まほうの本",         description: "読むたびにお話が変わるふしぎな本",             image: monthly(11, "まほうの本.webp") },
  // 12月 — クリスマス・大晦日
  { id: "m12-01", month: 12, season: "winter", category: "food",     rarity: "COMMON",   name: "年越しそば",         description: "ズルズル…ながーく元気にすごせますように",     image: monthly(12, "年越しそば.webp") },
  { id: "m12-02", month: 12, season: "winter", category: "nature",   rarity: "COMMON",   name: "ゆず湯のゆず",       description: "お風呂にぷかぷか。体はぽっかぽか",             image: monthly(12, "ゆず湯のゆず.webp") },
  { id: "m12-03", month: 12, season: "winter", category: "creature", rarity: "UNCOMMON", name: "トナカイ",           description: "サンタのそりを引くはやての相棒",               image: monthly(12, "トナカイ.webp") },
  { id: "m12-04", month: 12, season: "winter", category: "jewel",    rarity: "UNCOMMON", name: "ターコイズ",         description: "12月生まれの守り石。冬の晴れ空の色",         image: monthly(12, "ターコイズ.webp") },
  { id: "m12-05", month: 12, season: "winter", category: "tool",     rarity: "RARE",     name: "金のすず",           description: "本物のサンタのそりから落ちてきた鈴。ふると雪がまう", image: monthly(12, "金のすず.webp") },
];

export const ALL_COLLECTION_ITEMS: CollectionItem[] = [
  ...SPRING_ITEMS,
  ...SUMMER_ITEMS,
  ...FALL_ITEMS,
  ...WINTER_ITEMS,
  ...MONTHLY_ITEMS,
];

const BY_ID = new Map<string, CollectionItem>(ALL_COLLECTION_ITEMS.map((i) => [i.id, i]));

/**
 * シーズン UI 表示用: 通常アイテム 20 + そのシーズンに属する月限定 15 = 35 件を返す。
 */
export function getItemsBySeason(season: CollectionSeason): CollectionItem[] {
  return ALL_COLLECTION_ITEMS.filter((i) => i.season === season);
}

/**
 * バッジ判定用 (通常アイテムのみ): そのシーズンの通常 20 件を返す。
 * 月限定アイテムを混ぜないので `season_complete` / `hasAllCollectionItems` の
 * 母数が固定 (各20 / 全80) に保たれる。
 */
export function getRegularItemsBySeason(season: CollectionSeason): CollectionItem[] {
  return ALL_COLLECTION_ITEMS.filter((i) => i.season === season && i.month === undefined);
}

/**
 * 指定月 (1〜12) の月限定アイテム 5 件を返す。
 */
export function getMonthlyItems(month: number): CollectionItem[] {
  if (month < 1 || month > 12) throw new RangeError(`month out of range: ${month}`);
  return ALL_COLLECTION_ITEMS.filter((i) => i.month === month);
}

/**
 * 宝箱抽選用: 現在シーズンの通常 20 + 現在月の月限定 5 = 25 件のプール。
 */
export function getDrawPoolForDate(date: Date): CollectionItem[] {
  return [
    ...getRegularItemsBySeason(getSeasonForDate(date)),
    ...getMonthlyItems(getMonthForDate(date)),
  ];
}

export function getCollectionItemById(id: string): CollectionItem | null {
  return BY_ID.get(id) ?? null;
}

/**
 * 未取得アイテム表示用のシルエット (影) 画像パスに変換する。
 *  - `/collection-items/{season}/X.webp` → `/collection-items/shadow/{season}/X.webp`
 *  - `/collection-items/monthly/X.webp`  → `/collection-items/shadow/monthly/X.webp`
 *  - DUMMY_IMAGE や既に shadow 配下のパスはそのまま返す (冪等)
 *
 * shadow ファイルは scripts/gen-collection-shadows.mjs で生成する (単色 + アルファの webp)。
 * 元画像より 1/10〜1/30 に圧縮でき、Network タブでも本物の絵が見えないためコンテンツ漏洩防止にもなる。
 */
export function getCollectionShadowPath(imagePath: string): string {
  const SHADOW_PREFIX = "/collection-items/shadow/";
  const BASE_PREFIX = "/collection-items/";
  if (imagePath.startsWith(SHADOW_PREFIX)) return imagePath;
  if (!imagePath.startsWith(BASE_PREFIX)) return imagePath;
  const rest = imagePath.slice(BASE_PREFIX.length);
  // rest = "{season}/X.webp" | "dummy.webp" | ... ダミーや直下のファイルは変換しない
  if (!rest.includes("/")) return imagePath;
  return `${SHADOW_PREFIX}${rest}`;
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
 * 任意の Date から JST 基準の月 (1〜12) を返す。境界は JST 月初 0:00。
 */
export function getMonthForDate(date: Date): number {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return jst.getUTCMonth() + 1;
}

/**
 * 現在の JST 時刻からシーズンを判定する。
 */
export function getCurrentSeason(): CollectionSeason {
  return getSeasonForDate(new Date());
}

/**
 * 現在の JST 時刻の月 (1〜12) を返す。
 */
export function getCurrentMonth(): number {
  return getMonthForDate(new Date());
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
