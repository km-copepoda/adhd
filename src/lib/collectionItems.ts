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
  nameKana: string;
  description: string;
  descriptionKana: string;
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
  { id: "spring-01", season: "spring", category: "creature", rarity: "COMMON",   name: "モンシロチョウ", nameKana: "モンシロチョウ",   description: "花から花へひらひらと", descriptionKana: "はなからはなへひらひらと",                       image: img("spring", "モンシロチョウ.webp") },
  { id: "spring-02", season: "spring", category: "creature", rarity: "COMMON",   name: "オタマジャクシ", nameKana: "オタマジャクシ",   description: "まだ足が生えてないちびっこ", descriptionKana: "まだあしがはえてないちびっこ",                 image: img("spring", "オタマジャクシ.webp") },
  { id: "spring-03", season: "spring", category: "creature", rarity: "UNCOMMON", name: "ウグイス", nameKana: "ウグイス",         description: "ホーホケキョ！春をつげる声", descriptionKana: "ホーホケキョ！はるをつげるこえ",                 image: img("spring", "ウグイス.webp") },
  { id: "spring-04", season: "spring", category: "creature", rarity: "RARE",     name: "桜龍", nameKana: "さくらりゅう",             description: "花びらの中から現れる春だけの龍", descriptionKana: "はなびらのなかからあらわれるはるだけのりゅう",             image: img("spring", "桜龍.webp") },
  // たべもの
  { id: "spring-05", season: "spring", category: "food",     rarity: "COMMON",   name: "さくらもち", nameKana: "さくらもち",       description: "葉っぱごと食べる派？", descriptionKana: "はっぱごとたべるは？",                       image: img("spring", "さくらもち.webp") },
  { id: "spring-06", season: "spring", category: "food",     rarity: "COMMON",   name: "いちご", nameKana: "いちご",           description: "あまずっぱい春のおやつ", descriptionKana: "あまずっぱいはるのおやつ",                     image: img("spring", "いちご.webp") },
  { id: "spring-07", season: "spring", category: "food",     rarity: "UNCOMMON", name: "三色だんご", nameKana: "さんしょくだんご",       description: "ピンク・白・みどりのなかよし3兄弟", descriptionKana: "ピンク・しろ・みどりのなかよし3きょうだい",          image: img("spring", "三色だんご.webp") },
  { id: "spring-08", season: "spring", category: "food",     rarity: "RARE",     name: "花のはちみつ", nameKana: "はなのはちみつ",     description: "春の花だけで作った黄金色のはちみつ", descriptionKana: "はるのはなだけでつくったこがねいろのはちみつ",         image: img("spring", "花のはちみつ.webp") },
  // ほうせき
  { id: "spring-09", season: "spring", category: "jewel",    rarity: "COMMON",   name: "桜色の石", nameKana: "さくらいろのいし",         description: "うすいピンクがきれいな小石", descriptionKana: "うすいピンクがきれいなこいし",                 image: img("spring", "桜色の石.webp") },
  { id: "spring-10", season: "spring", category: "jewel",    rarity: "COMMON",   name: "つくしの化石", nameKana: "つくしのかせき",     description: "大むかしの春がとじこめられてる", descriptionKana: "おおむかしのはるがとじこめられてる",             image: img("spring", "つくしの化石.webp") },
  { id: "spring-11", season: "spring", category: "jewel",    rarity: "UNCOMMON", name: "ローズクォーツ", nameKana: "ローズクォーツ",   description: "やさしいピンクの愛の石", descriptionKana: "やさしいピンクのあいのいし",                     image: img("spring", "ローズクォーツ.webp") },
  { id: "spring-12", season: "spring", category: "jewel",    rarity: "RARE",     name: "春風のかけら", nameKana: "はるかぜのかけら",     description: "ビンに閉じこめたあたたかい風", descriptionKana: "ビンにとじこめたあたたかいかぜ",               image: img("spring", "春風のかけら.webp") },
  // どうぐ
  { id: "spring-13", season: "spring", category: "tool",     rarity: "COMMON",   name: "花かんむり", nameKana: "はなかんむり",       description: "野の花をあつめて作った", descriptionKana: "ののはなをあつめてつくった",                     image: img("spring", "花かんむり.webp") },
  { id: "spring-14", season: "spring", category: "tool",     rarity: "COMMON",   name: "たんぽぽの綿毛", nameKana: "たんぽぽのわたげ",   description: "ふーっと息をふいてとばそう", descriptionKana: "ふーっといきをふいてとばそう",                 image: img("spring", "たんぽぽの綿毛.webp") },
  { id: "spring-15", season: "spring", category: "tool",     rarity: "UNCOMMON", name: "春のスケッチブック", nameKana: "はるのスケッチブック", description: "開くと絵がうごきだす", descriptionKana: "ひらくとえがうごきだす",                     image: img("spring", "春のスケッチブック.webp") },
  { id: "spring-16", season: "spring", category: "tool",     rarity: "RARE",     name: "妖精のふえ", nameKana: "ようせいのふえ",       description: "吹くとまわりに花が咲く", descriptionKana: "ふくとまわりにはながさく",                     image: img("spring", "妖精のふえ.webp") },
  // しぜん
  { id: "spring-17", season: "spring", category: "nature",   rarity: "COMMON",   name: "つくし", nameKana: "つくし",           description: "春いちばんに顔を出す", descriptionKana: "はるいちばんにかおをだす",                       image: img("spring", "つくし.webp") },
  { id: "spring-18", season: "spring", category: "nature",   rarity: "COMMON",   name: "菜の花", nameKana: "なのはな",           description: "黄色いじゅうたんみたい", descriptionKana: "きいろいじゅうたんみたい",                     image: img("spring", "菜の花.webp") },
  { id: "spring-19", season: "spring", category: "nature",   rarity: "UNCOMMON", name: "春がすみ", nameKana: "はるがすみ",         description: "朝もやの中にかくれた風景", descriptionKana: "あさもやのなかにかくれたふうけい",                   image: img("spring", "春がすみ.webp") },
  { id: "spring-20", season: "spring", category: "nature",   rarity: "RARE",     name: "千年桜の花びら", nameKana: "せんねんざくらのはなびら",   description: "千年に一度だけ咲く桜から落ちた一枚", descriptionKana: "せんねんにいちどだけさくさくらからおちたいちまい",         image: img("spring", "千年桜の花びら.webp") },
];

const SUMMER_ITEMS: CollectionItem[] = [
  // いきもの
  { id: "summer-01", season: "summer", category: "creature", rarity: "COMMON",   name: "カブトムシ", nameKana: "カブトムシ",         description: "夏の王様。つのがかっこいい", descriptionKana: "なつのおうさま。つのがかっこいい",                 image: img("summer", "カブトムシ.webp") },
  { id: "summer-02", season: "summer", category: "creature", rarity: "COMMON",   name: "セミのぬけがら", nameKana: "セミのぬけがら",     description: "木の幹にしがみついてた", descriptionKana: "きのみきにしがみついてた",                     image: img("summer", "セミのぬけがら.webp") },
  { id: "summer-03", season: "summer", category: "creature", rarity: "UNCOMMON", name: "クラゲ", nameKana: "クラゲ",             description: "ゆらゆら光る海のランプ", descriptionKana: "ゆらゆらひかるうみのランプ",                     image: img("summer", "クラゲ.webp") },
  { id: "summer-04", season: "summer", category: "creature", rarity: "RARE",     name: "リュウグウノツカイ", nameKana: "リュウグウノツカイ", description: "深海からあらわれた伝説の魚", descriptionKana: "しんかいからあらわれたでんせつのさかな",                 image: img("summer", "リュウグウノツカイ.webp") },
  // たべもの
  { id: "summer-05", season: "summer", category: "food",     rarity: "COMMON",   name: "スイカ", nameKana: "スイカ",             description: "たたくといい音がする", descriptionKana: "たたくといいおとがする",                       image: img("summer", "スイカ.webp") },
  { id: "summer-06", season: "summer", category: "food",     rarity: "COMMON",   name: "かきごおり", nameKana: "かきごおり",         description: "シロップはブルーハワイ派", descriptionKana: "シロップはブルーハワイは",                   image: img("summer", "かきごおり.webp") },
  { id: "summer-07", season: "summer", category: "food",     rarity: "UNCOMMON", name: "わたあめ", nameKana: "わたあめ",           description: "ふわふわで雲みたいなやつ", descriptionKana: "ふわふわでくもみたいなやつ",                   image: img("summer", "わたあめ.webp") },
  { id: "summer-08", season: "summer", category: "food",     rarity: "RARE",     name: "流れ星ソーダ", nameKana: "ながれぼしソーダ",       description: "飲むと体がキラキラ光る夜だけのジュース", descriptionKana: "のむとからだがキラキラひかるよるだけのジュース",     image: img("summer", "流れ星ソーダ.webp") },
  // ほうせき
  { id: "summer-09", season: "summer", category: "jewel",    rarity: "COMMON",   name: "シーグラス", nameKana: "シーグラス",         description: "波にみがかれたガラスのかけら", descriptionKana: "なみにみがかれたガラスのかけら",               image: img("summer", "シーグラス.webp") },
  { id: "summer-10", season: "summer", category: "jewel",    rarity: "COMMON",   name: "貝がら", nameKana: "かいがら",             description: "耳にあてると海の音がする", descriptionKana: "みみにあてるとうみのおとがする",                   image: img("summer", "貝がら.webp") },
  // summer-11: 元「真珠」。6月の誕生石を「真珠」(m06-04) に割り当てるため、
  // 名称重複を避けて「アレキサンドライト」に改名 (2026-07-21)。
  // id は維持することで既存の UserCollectionItem レコードをそのまま新名称に引き継ぐ。
  { id: "summer-11", season: "summer", category: "jewel",    rarity: "UNCOMMON", name: "アレキサンドライト", nameKana: "アレキサンドライト", description: "昼と夜で色が変わるふしぎな石", descriptionKana: "ひるとよるでいろがかわるふしぎないし",               image: img("summer", "アレキサンドライト.webp") },
  { id: "summer-12", season: "summer", category: "jewel",    rarity: "RARE",     name: "人魚のうろこ", nameKana: "にんぎょのうろこ",       description: "太陽にかざすと七色にかがやく", descriptionKana: "たいようにかざすとなないろにかがやく",               image: img("summer", "人魚のうろこ.webp") },
  // どうぐ
  { id: "summer-13", season: "summer", category: "tool",     rarity: "COMMON",   name: "むしとりあみ", nameKana: "むしとりあみ",       description: "夏休みの必須アイテム", descriptionKana: "なつやすみのひっすアイテム",                       image: img("summer", "むしとりあみ.webp") },
  { id: "summer-14", season: "summer", category: "tool",     rarity: "COMMON",   name: "ビーチサンダル", nameKana: "ビーチサンダル",     description: "ペタペタ音がたのしい", descriptionKana: "ペタペタおとがたのしい",                       image: img("summer", "ビーチサンダル.webp") },
  { id: "summer-15", season: "summer", category: "tool",     rarity: "UNCOMMON", name: "花火セット", nameKana: "はなびセット",         description: "線香花火が最後まで残ったら勝ち", descriptionKana: "せんこうはなびがさいごまでのこったらかち",             image: img("summer", "花火セット.webp") },
  { id: "summer-16", season: "summer", category: "tool",     rarity: "RARE",     name: "まぼろしの貝笛", nameKana: "まぼろしのかいぶえ",     description: "吹くと海の生き物があつまってくる", descriptionKana: "ふくとうみのいきものがあつまってくる",           image: img("summer", "まぼろしの貝笛.webp") },
  // しぜん
  { id: "summer-17", season: "summer", category: "nature",   rarity: "COMMON",   name: "ひまわり", nameKana: "ひまわり",           description: "太陽にむかってまっすぐのびる", descriptionKana: "たいようにむかってまっすぐのびる",               image: img("summer", "ひまわり.webp") },
  { id: "summer-18", season: "summer", category: "nature",   rarity: "COMMON",   name: "入道雲", nameKana: "にゅうどうぐも",             description: "もくもく育つ夏のしるし", descriptionKana: "もくもくそだつなつのしるし",                     image: img("summer", "入道雲.webp") },
  { id: "summer-19", season: "summer", category: "nature",   rarity: "UNCOMMON", name: "にじ", nameKana: "にじ",               description: "夕立のあとにかかるごほうび", descriptionKana: "ゆうだちのあとにかかるごほうび",                 image: img("summer", "にじ.webp") },
  { id: "summer-20", season: "summer", category: "nature",   rarity: "RARE",     name: "天の川のひとしずく", nameKana: "あまのがわのひとしずく", description: "七夕の夜にだけ降ってくる星のしずく", descriptionKana: "たなばたのよるにだけふってくるほしのしずく",         image: img("summer", "天の川のひとしずく.webp") },
];

const FALL_ITEMS: CollectionItem[] = [
  // いきもの
  { id: "fall-01",   season: "fall",   category: "creature", rarity: "COMMON",   name: "アキアカネ", nameKana: "アキアカネ",         description: "夕やけの中をとぶ赤とんぼ", descriptionKana: "ゆうやけのなかをとぶあかとんぼ",                   image: img("fall", "アキアカネ.webp") },
  { id: "fall-02",   season: "fall",   category: "creature", rarity: "COMMON",   name: "スズムシ", nameKana: "スズムシ",           description: "リーンリーンと秋を歌う", descriptionKana: "リーンリーンとあきをうたう",                     image: img("fall", "スズムシ.webp") },
  { id: "fall-03",   season: "fall",   category: "creature", rarity: "UNCOMMON", name: "フクロウ（秋羽）", nameKana: "フクロウ（あきばね）",   description: "紅葉色の羽をまとった森の番人", descriptionKana: "もみじいろのはねをまとったもりのばんにん",               image: img("fall", "フクロウ（秋羽）.webp") },
  { id: "fall-04",   season: "fall",   category: "creature", rarity: "RARE",     name: "月うさぎ", nameKana: "つきうさぎ",           description: "満月の夜だけ現れるふしぎなうさぎ", descriptionKana: "まんげつのよるだけあらわれるふしぎなうさぎ",           image: img("fall", "月うさぎ.webp") },
  // たべもの
  { id: "fall-05",   season: "fall",   category: "food",     rarity: "COMMON",   name: "やきいも", nameKana: "やきいも",           description: "ホクホクあつあつ。ほっぺが落ちる", descriptionKana: "ホクホクあつあつ。ほっぺがおちる",           image: img("fall", "やきいも.webp") },
  { id: "fall-06",   season: "fall",   category: "food",     rarity: "COMMON",   name: "くり", nameKana: "くり",               description: "トゲトゲの中身はあまい", descriptionKana: "トゲトゲのなかみはあまい",                     image: img("fall", "くり.webp") },
  { id: "fall-07",   season: "fall",   category: "food",     rarity: "UNCOMMON", name: "月見だんご", nameKana: "つきみだんご",         description: "お月さまにおそなえするまんまるだんご", descriptionKana: "おつきさまにおそなえするまんまるだんご",       image: img("fall", "月見だんご.webp") },
  { id: "fall-08",   season: "fall",   category: "food",     rarity: "RARE",     name: "黄金のまつたけ", nameKana: "おうごんのまつたけ",     description: "見つけたら一生ラッキーな伝説のきのこ", descriptionKana: "みつけたらいっしょうラッキーなでんせつのきのこ",       image: img("fall", "黄金のまつたけ.webp") },
  // ほうせき
  { id: "fall-09",   season: "fall",   category: "jewel",    rarity: "COMMON",   name: "琥珀", nameKana: "こはく",               description: "虫が閉じこめられた太古のたからもの", descriptionKana: "むしがとじこめられたたいこのたからもの",         image: img("fall", "琥珀.webp") },
  { id: "fall-10",   season: "fall",   category: "jewel",    rarity: "COMMON",   name: "もみじの化石", nameKana: "もみじのかせき",       description: "何万年も前の秋がのこってる", descriptionKana: "なんまんねんもまえのあきがのこってる",                 image: img("fall", "もみじの化石.webp") },
  { id: "fall-11",   season: "fall",   category: "jewel",    rarity: "UNCOMMON", name: "タイガーアイ", nameKana: "タイガーアイ",       description: "トラの目みたいにギラッと光る", descriptionKana: "トラのめみたいにギラッとひかる",               image: img("fall", "タイガーアイ.webp") },
  { id: "fall-12",   season: "fall",   category: "jewel",    rarity: "RARE",     name: "月光石", nameKana: "げっこうせき",             description: "月の光をあつめて固めた石", descriptionKana: "つきのひかりをあつめてかためたいし",                   image: img("fall", "月光石.webp") },
  // どうぐ
  { id: "fall-13",   season: "fall",   category: "tool",     rarity: "COMMON",   name: "落ち葉", nameKana: "おちば",             description: "カサカサいい音がする", descriptionKana: "カサカサいいおとがする",                       image: img("fall", "落ち葉.webp") },
  { id: "fall-14",   season: "fall",   category: "tool",     rarity: "COMMON",   name: "どんぐりごま", nameKana: "どんぐりごま",       description: "指でくるくるまわせる", descriptionKana: "ゆびでくるくるまわせる",                       image: img("fall", "どんぐりごま.webp") },
  { id: "fall-15",   season: "fall",   category: "tool",     rarity: "UNCOMMON", name: "秋の絵はがき", nameKana: "あきのえはがき",       description: "紅葉の山が描かれたふしぎなカード", descriptionKana: "もみじのやまがえがかれたふしぎなカード",           image: img("fall", "秋の絵はがき.webp") },
  { id: "fall-16",   season: "fall",   category: "tool",     rarity: "RARE",     name: "星月夜のランタン", nameKana: "ほしづきよのランタン",   description: "火をつけると星空がうかびあがる", descriptionKana: "ひをつけるとほしぞらがうかびあがる",             image: img("fall", "星月夜のランタン.webp") },
  // しぜん
  { id: "fall-17",   season: "fall",   category: "nature",   rarity: "COMMON",   name: "紅葉", nameKana: "もみじ",               description: "赤と黄色のグラデーション", descriptionKana: "あかときいろのグラデーション",                   image: img("fall", "紅葉.webp") },
  { id: "fall-18",   season: "fall",   category: "nature",   rarity: "COMMON",   name: "すすき", nameKana: "すすき",             description: "風にゆれる秋のシンボル", descriptionKana: "かぜにゆれるあきのシンボル",                     image: img("fall", "すすき.webp") },
  { id: "fall-19",   season: "fall",   category: "nature",   rarity: "UNCOMMON", name: "きんもくせいの香り", nameKana: "きんもくせいのかおり", description: "ビンを開けると秋の匂いがふわっと", descriptionKana: "ビンをあけるとあきのにおいがふわっと",           image: img("fall", "きんもくせいの香り.webp") },
  { id: "fall-20",   season: "fall",   category: "nature",   rarity: "RARE",     name: "十五夜の月のかけら", nameKana: "じゅうごやのつきのかけら", description: "一年でいちばんきれいな月のひとかけ", descriptionKana: "いちねんでいちばんきれいなつきのひとかけ",         image: img("fall", "十五夜の月のかけら.webp") },
];

const WINTER_ITEMS: CollectionItem[] = [
  // いきもの
  { id: "winter-01", season: "winter", category: "creature", rarity: "COMMON",   name: "ゆきうさぎ", nameKana: "ゆきうさぎ",         description: "雪で作ったうさぎ…と思ったら動いた！", descriptionKana: "ゆきでつくったうさぎ…とおもったらうごいた！",        image: img("winter", "ゆきうさぎ.webp") },
  { id: "winter-02", season: "winter", category: "creature", rarity: "COMMON",   name: "シマエナガ", nameKana: "シマエナガ",         description: "まんまるもふもふの雪の妖精", descriptionKana: "まんまるもふもふのゆきのようせい",                 image: img("winter", "シマエナガ.webp") },
  { id: "winter-03", season: "winter", category: "creature", rarity: "UNCOMMON", name: "ペンギン", nameKana: "ペンギン",           description: "よちよち歩きがかわいい氷の住人", descriptionKana: "よちよちあるきがかわいいこおりのじゅうにん",             image: img("winter", "ペンギン.webp") },
  { id: "winter-04", season: "winter", category: "creature", rarity: "RARE",     name: "氷龍", nameKana: "ひょうりゅう",               description: "吐息で何でも凍らせる冬だけの龍", descriptionKana: "といきでなんでもこおらせるふゆだけのりゅう",             image: img("winter", "氷龍.webp") },
  // たべもの
  { id: "winter-05", season: "winter", category: "food",     rarity: "COMMON",   name: "肉まん", nameKana: "にくまん",             description: "ほかほかの湯気がごちそう", descriptionKana: "ほかほかのゆげがごちそう",                   image: img("winter", "肉まん.webp") },
  { id: "winter-06", season: "winter", category: "food",     rarity: "COMMON",   name: "ココア", nameKana: "ココア",             description: "あったまる冬のともだち", descriptionKana: "あったまるふゆのともだち",                     image: img("winter", "ココア.webp") },
  { id: "winter-07", season: "winter", category: "food",     rarity: "UNCOMMON", name: "クリスマスケーキ", nameKana: "クリスマスケーキ",   description: "いちごとクリームのスペシャル", descriptionKana: "いちごとクリームのスペシャル",               image: img("winter", "クリスマスケーキ.webp") },
  { id: "winter-08", season: "winter", category: "food",     rarity: "RARE",     name: "北極星のこんぺいとう", nameKana: "ほっきょくせいのこんぺいとう", description: "食べると体がほんのり光る冬限定のお菓子", descriptionKana: "たべるとからだがほんのりひかるふゆげんていのおかし",   image: img("winter", "北極星のこんぺいとう.webp") },
  // ほうせき
  { id: "winter-09", season: "winter", category: "jewel",    rarity: "COMMON",   name: "つらら", nameKana: "つらら",             description: "太陽があたるとキラキラ光る", descriptionKana: "たいようがあたるとキラキラひかる",                 image: img("winter", "つらら.webp") },
  { id: "winter-10", season: "winter", category: "jewel",    rarity: "COMMON",   name: "霜の結晶", nameKana: "しものけっしょう",           description: "窓ガラスにできた自然のアート", descriptionKana: "まどガラスにできたしぜんのアート",               image: img("winter", "霜の結晶.webp") },
  { id: "winter-11", season: "winter", category: "jewel",    rarity: "UNCOMMON", name: "ムーンストーン", nameKana: "ムーンストーン",     description: "冬の月みたいに青白く光る", descriptionKana: "ふゆのつきみたいにあおじろくひかる",                   image: img("winter", "ムーンストーン.webp") },
  { id: "winter-12", season: "winter", category: "jewel",    rarity: "RARE",     name: "ダイヤモンドダスト", nameKana: "ダイヤモンドダスト", description: "空気中にキラキラ舞う氷の宝石", descriptionKana: "くうきちゅうにキラキラまうこおりのほうせき",               image: img("winter", "ダイヤモンドダスト.webp") },
  // どうぐ
  { id: "winter-13", season: "winter", category: "tool",     rarity: "COMMON",   name: "毛糸の手ぶくろ", nameKana: "けいとのてぶくろ",     description: "おばあちゃんが編んでくれた", descriptionKana: "おばあちゃんがあんでくれた",                 image: img("winter", "毛糸の手ぶくろ.webp") },
  { id: "winter-14", season: "winter", category: "tool",     rarity: "COMMON",   name: "ゆきだるまの帽子", nameKana: "ゆきだるまのぼうし",   description: "かぶると雪がふりだすらしい", descriptionKana: "かぶるとゆきがふりだすらしい",                 image: img("winter", "ゆきだるまの帽子.webp") },
  { id: "winter-15", season: "winter", category: "tool",     rarity: "UNCOMMON", name: "クリスマスのくつした", nameKana: "クリスマスのくつした", description: "枕もとに置くとプレゼントが…？", descriptionKana: "まくらもとにおくとプレゼントが…？",           image: img("winter", "クリスマスのくつした.webp") },
  { id: "winter-16", season: "winter", category: "tool",     rarity: "RARE",     name: "サンタのそり笛", nameKana: "サンタのそりぶえ",     description: "吹くとトナカイがやってくる", descriptionKana: "ふくとトナカイがやってくる",                 image: img("winter", "サンタのそり笛.webp") },
  // しぜん
  { id: "winter-17", season: "winter", category: "nature",   rarity: "COMMON",   name: "雪の結晶", nameKana: "ゆきのけっしょう",           description: "同じ形はふたつとない", descriptionKana: "おなじかたちはふたつとない",                       image: img("winter", "雪の結晶.webp") },
  { id: "winter-18", season: "winter", category: "nature",   rarity: "COMMON",   name: "冬芽", nameKana: "ふゆめ",               description: "寒さの中でじっと春を待ってる", descriptionKana: "さむさのなかでじっとはるをまってる",               image: img("winter", "冬芽.webp") },
  { id: "winter-19", season: "winter", category: "nature",   rarity: "UNCOMMON", name: "氷の花", nameKana: "こおりのはな",             description: "水たまりにさいた冬だけの花", descriptionKana: "みずたまりにさいたふゆだけのはな",                 image: img("winter", "氷の花.webp") },
  { id: "winter-20", season: "winter", category: "nature",   rarity: "RARE",     name: "オーロラのカーテン", nameKana: "オーロラのカーテン", description: "北の空にゆれる光のカーテン", descriptionKana: "きたのそらにゆれるひかりのカーテン",                 image: img("winter", "オーロラのカーテン.webp") },
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
  { id: "m01-01", month: 1,  season: "winter", category: "food",     rarity: "COMMON",   name: "鏡もち", nameKana: "かがみもち",             description: "みかんの帽子がちょこんとのってる", descriptionKana: "みかんのぼうしがちょこんとのってる",             image: monthly(1, "鏡もち.webp") },
  { id: "m01-02", month: 1,  season: "winter", category: "tool",     rarity: "COMMON",   name: "たこあげ", nameKana: "たこあげ",           description: "お正月の空たかくのぼれ！", descriptionKana: "おしょうがつのそらたかくのぼれ！",                     image: monthly(1, "たこあげ.webp") },
  { id: "m01-03", month: 1,  season: "winter", category: "creature", rarity: "UNCOMMON", name: "獅子舞", nameKana: "ししまい",             description: "あたまをかまれると一年しあわせになれる", descriptionKana: "あたまをかまれるといちねんしあわせになれる",       image: monthly(1, "獅子舞.webp") },
  { id: "m01-04", month: 1,  season: "winter", category: "jewel",    rarity: "UNCOMMON", name: "ガーネット", nameKana: "ガーネット",         description: "1月生まれの守り石。冬に燃える赤", descriptionKana: "1がつうまれのまもりいし。ふゆにもえるあか",             image: monthly(1, "ガーネット.webp") },
  { id: "m01-05", month: 1,  season: "winter", category: "nature",   rarity: "RARE",     name: "初日の出のひかり", nameKana: "はつひのでのひかり",   description: "一年でいちばん最初の太陽の光をビンにつめた", descriptionKana: "いちねんでいちばんさいしょのたいようのひかりをビンにつめた",   image: monthly(1, "初日の出のひかり.webp") },
  // 2月 — 節分・バレンタイン
  { id: "m02-01", month: 2,  season: "winter", category: "food",     rarity: "COMMON",   name: "恵方巻", nameKana: "えほうまき",             description: "しゃべらずに食べきれたら願いがかなう", descriptionKana: "しゃべらずにたべきれたらねがいがかなう",         image: monthly(2, "恵方巻.webp") },
  { id: "m02-02", month: 2,  season: "winter", category: "nature",   rarity: "COMMON",   name: "ふきのとう", nameKana: "ふきのとう",         description: "雪の下から顔を出す春のさきがけ", descriptionKana: "ゆきのしたからかおをだすはるのさきがけ",               image: monthly(2, "ふきのとう.webp") },
  { id: "m02-03", month: 2,  season: "winter", category: "tool",     rarity: "UNCOMMON", name: "鬼のお面", nameKana: "おにのおめん",           description: "おにはーそと！ふくはーうち！", descriptionKana: "おにはーそと！ふくはーうち！",                 image: monthly(2, "鬼のお面.webp") },
  { id: "m02-04", month: 2,  season: "winter", category: "jewel",    rarity: "UNCOMMON", name: "アメジスト", nameKana: "アメジスト",         description: "2月生まれの守り石。むらさきの夜の色", descriptionKana: "2がつうまれのまもりいし。むらさきのよるのいろ",         image: monthly(2, "アメジスト.webp") },
  { id: "m02-05", month: 2,  season: "winter", category: "creature", rarity: "RARE",     name: "子オニ", nameKana: "こオニ",             description: "節分の夜にはぐれた、心やさしいちびっこオニ", descriptionKana: "せつぶんのよるにはぐれた、こころやさしいちびっこオニ",   image: monthly(2, "子オニ.webp") },
  // 3月 — ひなまつり・卒業
  { id: "m03-01", month: 3,  season: "spring", category: "food",     rarity: "COMMON",   name: "ひなあられ", nameKana: "ひなあられ",         description: "ピンク・白・みどりのカラフルなおこし", descriptionKana: "ピンク・しろ・みどりのカラフルなおこし",         image: monthly(3, "ひなあられ.webp") },
  { id: "m03-02", month: 3,  season: "spring", category: "creature", rarity: "COMMON",   name: "メジロ", nameKana: "メジロ",             description: "梅の花のみつが大好物なうぐいす色の小鳥", descriptionKana: "うめのはなのみつがだいこうぶつなうぐいすいろのことり",       image: monthly(3, "メジロ.webp") },
  { id: "m03-03", month: 3,  season: "spring", category: "tool",     rarity: "UNCOMMON", name: "ぼんぼり", nameKana: "ぼんぼり",           description: "おひなさまをやさしく照らすあかり", descriptionKana: "おひなさまをやさしくてらすあかり",             image: monthly(3, "ぼんぼり.webp") },
  { id: "m03-04", month: 3,  season: "spring", category: "jewel",    rarity: "UNCOMMON", name: "アクアマリン", nameKana: "アクアマリン",       description: "3月生まれの守り石。春の海の色", descriptionKana: "3がつうまれのまもりいし。はるのうみのいろ",               image: monthly(3, "アクアマリン.webp") },
  { id: "m03-05", month: 3,  season: "spring", category: "nature",   rarity: "RARE",     name: "たびだちの花たば", nameKana: "たびだちのはなたば",   description: "卒業式の日にもらえる、ずっと枯れない花たば", descriptionKana: "そつぎょうしきのひにもらえる、ずっとかれないはなたば",   image: monthly(3, "たびだちの花たば.webp") },
  // 4月 — 入学・お花見・イースター
  { id: "m04-01", month: 4,  season: "spring", category: "creature", rarity: "COMMON",   name: "ツバメ", nameKana: "ツバメ",             description: "軒下に巣を作りに、海をこえて帰ってきた", descriptionKana: "のきしたにすをつくりに、うみをこえてかえってきた",       image: monthly(4, "ツバメ.webp") },
  { id: "m04-02", month: 4,  season: "spring", category: "nature",   rarity: "COMMON",   name: "桜吹雪", nameKana: "さくらふぶき",             description: "ひらひら舞う花びらのシャワー", descriptionKana: "ひらひらまうはなびらのシャワー",                 image: monthly(4, "桜吹雪.webp") },
  { id: "m04-03", month: 4,  season: "spring", category: "tool",     rarity: "UNCOMMON", name: "ピカピカのランドセル", nameKana: "ピカピカのランドセル", description: "新1年生のしるし。まだ革のにおいがする", descriptionKana: "しん1ねんせいのしるし。まだかわのにおいがする",       image: monthly(4, "ピカピカのランドセル.webp") },
  { id: "m04-04", month: 4,  season: "spring", category: "jewel",    rarity: "UNCOMMON", name: "ダイヤモンド", nameKana: "ダイヤモンド",       description: "4月生まれの守り石。世界でいちばんかたい輝き", descriptionKana: "4がつうまれのまもりいし。せかいでいちばんかたいかがやき", image: monthly(4, "ダイヤモンド.webp") },
  { id: "m04-05", month: 4,  season: "spring", category: "food",     rarity: "RARE",     name: "虹色イースターエッグ", nameKana: "にじいろイースターエッグ", description: "中から何が出てくるかはわってからのおたのしみ", descriptionKana: "なかからなにがでてくるかはわってからのおたのしみ", image: monthly(4, "虹色イースターエッグ.webp") },
  // 5月 — こどもの日・母の日
  { id: "m05-01", month: 5,  season: "spring", category: "food",     rarity: "COMMON",   name: "かしわもち", nameKana: "かしわもち",         description: "葉っぱのおふとんにくるまったおもち", descriptionKana: "はっぱのおふとんにくるまったおもち",           image: monthly(5, "かしわもち.webp") },
  { id: "m05-02", month: 5,  season: "spring", category: "creature", rarity: "COMMON",   name: "テントウムシ", nameKana: "テントウムシ",       description: "手にとまったら幸運のしるし", descriptionKana: "てにとまったらこううんのしるし",                   image: monthly(5, "テントウムシ.webp") },
  { id: "m05-03", month: 5,  season: "spring", category: "tool",     rarity: "UNCOMMON", name: "こいのぼり", nameKana: "こいのぼり",         description: "屋根より高く、風をのんでおよぐ", descriptionKana: "やねよりたかく、かぜをのんでおよぐ",               image: monthly(5, "こいのぼり.webp") },
  { id: "m05-04", month: 5,  season: "spring", category: "jewel",    rarity: "UNCOMMON", name: "エメラルド", nameKana: "エメラルド",         description: "5月生まれの守り石。新緑のみどり", descriptionKana: "5がつうまれのまもりいし。しんりょくのみどり",             image: monthly(5, "エメラルド.webp") },
  { id: "m05-05", month: 5,  season: "spring", category: "nature",   rarity: "RARE",     name: "雲のこいのぼり", nameKana: "くものこいのぼり",     description: "五月晴れの空にあらわれる、雲でできた巨大こいのぼり", descriptionKana: "さつきばれのそらにあらわれる、くもでできたきょだいこいのぼり", image: monthly(5, "雲のこいのぼり.webp") },
  // 6月 — 梅雨・ホタル
  { id: "m06-01", month: 6,  season: "summer", category: "nature",   rarity: "COMMON",   name: "あじさい", nameKana: "あじさい",           description: "雨の日がだいすきな、色変わりの花", descriptionKana: "あめのひがだいすきな、いろがわりのはな",             image: monthly(6, "あじさい.webp") },
  { id: "m06-02", month: 6,  season: "summer", category: "creature", rarity: "COMMON",   name: "カタツムリ", nameKana: "カタツムリ",         description: "あじさいの葉っぱの上をのんびりおさんぽ", descriptionKana: "あじさいのはっぱのうえをのんびりおさんぽ",       image: monthly(6, "カタツムリ.webp") },
  { id: "m06-03", month: 6,  season: "summer", category: "tool",     rarity: "UNCOMMON", name: "てるてる坊主", nameKana: "てるてるぼうず",       description: "あーした天気になあれ！", descriptionKana: "あーしたてんきになあれ！",                       image: monthly(6, "てるてる坊主.webp") },
  { id: "m06-04", month: 6,  season: "summer", category: "jewel",    rarity: "UNCOMMON", name: "真珠", nameKana: "しんじゅ",               description: "6月生まれの守り石。貝の中でひっそり育った光のつぶ", descriptionKana: "6がつうまれのまもりいし。かいのなかでひっそりそだったひかりのつぶ", image: monthly(6, "真珠.webp") },
  { id: "m06-05", month: 6,  season: "summer", category: "creature", rarity: "RARE",     name: "ホタル", nameKana: "ホタル",             description: "夜の川辺にうかぶ小さな光。見つけたらラッキー", descriptionKana: "よるのかわべにうかぶちいさなひかり。みつけたらラッキー", image: monthly(6, "ホタル.webp") },
  // 7月 — 七夕・海びらき
  { id: "m07-01", month: 7,  season: "summer", category: "food",     rarity: "COMMON",   name: "ラムネ", nameKana: "ラムネ",             description: "ビー玉がカラカラ鳴る夏の音", descriptionKana: "ビーだまがカラカラなるなつのおと",                   image: monthly(7, "ラムネ.webp") },
  { id: "m07-02", month: 7,  season: "summer", category: "creature", rarity: "COMMON",   name: "すなはまのカニ", nameKana: "すなはまのカニ",     description: "横歩きの名人。あなを掘るのも速い", descriptionKana: "よこあるきのめいじん。あなをほるのもはやい",             image: monthly(7, "すなはまのカニ.webp") },
  { id: "m07-03", month: 7,  season: "summer", category: "tool",     rarity: "UNCOMMON", name: "たんざく", nameKana: "たんざく",           description: "ねがいごとを書いて笹にむすぼう", descriptionKana: "ねがいごとをかいてささにむすぼう",               image: monthly(7, "たんざく.webp") },
  { id: "m07-04", month: 7,  season: "summer", category: "jewel",    rarity: "UNCOMMON", name: "ルビー", nameKana: "ルビー",             description: "7月生まれの守り石。真夏の太陽の赤", descriptionKana: "7がつうまれのまもりいし。まなつのたいようのあか",           image: monthly(7, "ルビー.webp") },
  { id: "m07-05", month: 7,  season: "summer", category: "jewel",    rarity: "RARE",     name: "織姫のはたおり糸", nameKana: "おりひめのはたおりいと",   description: "七夕の夜、天の川をわたるためのきらめく糸", descriptionKana: "たなばたのよる、あまのがわをわたるためのきらめくいと",     image: monthly(7, "織姫のはたおり糸.webp") },
  // 8月 — 夏まつり・花火大会
  { id: "m08-01", month: 8,  season: "summer", category: "food",     rarity: "COMMON",   name: "りんごあめ", nameKana: "りんごあめ",         description: "つやつや真っ赤なお祭りの宝石", descriptionKana: "つやつやまっかなおまつりのほうせき",                 image: monthly(8, "りんごあめ.webp") },
  { id: "m08-02", month: 8,  season: "summer", category: "creature", rarity: "COMMON",   name: "ヒグラシ", nameKana: "ヒグラシ",           description: "カナカナカナ…夕ぐれの合図", descriptionKana: "カナカナカナ…ゆうぐれのあいず",                   image: monthly(8, "ヒグラシ.webp") },
  { id: "m08-03", month: 8,  season: "summer", category: "tool",     rarity: "UNCOMMON", name: "お祭りのお面", nameKana: "おまつりのおめん",       description: "キツネ？ヒーロー？今日はどれにする？", descriptionKana: "キツネ？ヒーロー？きょうはどれにする？",         image: monthly(8, "お祭りのお面.webp") },
  { id: "m08-04", month: 8,  season: "summer", category: "jewel",    rarity: "UNCOMMON", name: "ペリドット", nameKana: "ペリドット",         description: "8月生まれの守り石。太陽が生んだ石", descriptionKana: "8がつうまれのまもりいし。たいようがうんだいし",           image: monthly(8, "ペリドット.webp") },
  { id: "m08-05", month: 8,  season: "summer", category: "nature",   rarity: "RARE",     name: "打ち上げ花火のたね", nameKana: "うちあげはなびのたね", description: "植えると夜空に大輪の花がさく…かもしれない", descriptionKana: "うえるとよぞらにたいりんのはながさく…かもしれない",   image: monthly(8, "打ち上げ花火のたね.webp") },
  // 9月 — 運動会・実りの秋
  { id: "m09-01", month: 9,  season: "fall",   category: "food",     rarity: "COMMON",   name: "ぶどう", nameKana: "ぶどう",             description: "つぶつぶむらさきの宝石ふさ", descriptionKana: "つぶつぶむらさきのほうせきふさ",                   image: monthly(9, "ぶどう.webp") },
  { id: "m09-02", month: 9,  season: "fall",   category: "nature",   rarity: "COMMON",   name: "コスモス", nameKana: "コスモス",           description: "秋風にゆれるピンクのじゅうたん", descriptionKana: "あきかぜにゆれるピンクのじゅうたん",               image: monthly(9, "コスモス.webp") },
  { id: "m09-03", month: 9,  season: "fall",   category: "creature", rarity: "UNCOMMON", name: "カマキリ", nameKana: "カマキリ",           description: "かまをかまえた秋の草むらのハンター", descriptionKana: "かまをかまえたあきのくさむらのハンター",           image: monthly(9, "カマキリ.webp") },
  { id: "m09-04", month: 9,  season: "fall",   category: "jewel",    rarity: "UNCOMMON", name: "サファイア", nameKana: "サファイア",         description: "9月生まれの守り石。夜空の青", descriptionKana: "9がつうまれのまもりいし。よぞらのあお",                 image: monthly(9, "サファイア.webp") },
  { id: "m09-05", month: 9,  season: "fall",   category: "tool",     rarity: "RARE",     name: "かけっこの魔法ぐつ", nameKana: "かけっこのまほうぐつ", description: "はくと風みたいに速く走れる運動会のひみつどうぐ", descriptionKana: "はくとかぜみたいにはやくはしれるうんどうかいのひみつどうぐ", image: monthly(9, "かけっこの魔法ぐつ.webp") },
  // 10月 — ハロウィン
  { id: "m10-01", month: 10, season: "fall",   category: "food",     rarity: "COMMON",   name: "ハロウィンキャンディ", nameKana: "ハロウィンキャンディ", description: "トリック・オア・トリート！の戦利品", descriptionKana: "トリック・オア・トリート！のせんりひん",         image: monthly(10, "ハロウィンキャンディ.webp") },
  { id: "m10-02", month: 10, season: "fall",   category: "creature", rarity: "COMMON",   name: "黒ネコ", nameKana: "くろネコ",             description: "ハロウィンの夜の魔女の相棒", descriptionKana: "ハロウィンのよるのまじょのあいぼう",                   image: monthly(10, "黒ネコ.webp") },
  { id: "m10-03", month: 10, season: "fall",   category: "nature",   rarity: "UNCOMMON", name: "おばけかぼちゃ", nameKana: "おばけかぼちゃ",     description: "畑でいちばん大きく育った顔つきかぼちゃ", descriptionKana: "はたけでいちばんおおきくそだったかおつきかぼちゃ",       image: monthly(10, "おばけかぼちゃ.webp") },
  { id: "m10-04", month: 10, season: "fall",   category: "jewel",    rarity: "UNCOMMON", name: "オパール", nameKana: "オパール",           description: "10月生まれの守り石。虹をとじこめた石", descriptionKana: "10がつうまれのまもりいし。にじをとじこめたいし",       image: monthly(10, "オパール.webp") },
  { id: "m10-05", month: 10, season: "fall",   category: "tool",     rarity: "RARE",     name: "まじょのほうき", nameKana: "まじょのほうき",     description: "またがるとほんの少しだけ体がうく", descriptionKana: "またがるとほんのすこしだけからだがうく",             image: monthly(10, "まじょのほうき.webp") },
  // 11月 — 七五三・読書の秋
  { id: "m11-01", month: 11, season: "fall",   category: "creature", rarity: "COMMON",   name: "みのむし", nameKana: "みのむし",           description: "落ち葉のコートでぬくぬく冬じたく", descriptionKana: "おちばのコートでぬくぬくふゆじたく",             image: monthly(11, "みのむし.webp") },
  { id: "m11-02", month: 11, season: "fall",   category: "nature",   rarity: "COMMON",   name: "イチョウのじゅうたん", nameKana: "イチョウのじゅうたん", description: "並木道が黄色一面にそまった", descriptionKana: "なみきみちがきいろいちめんにそまった",                 image: monthly(11, "イチョウのじゅうたん.webp") },
  { id: "m11-03", month: 11, season: "fall",   category: "food",     rarity: "UNCOMMON", name: "千歳あめ", nameKana: "ちとせあめ",           description: "ながーいあめ。ながーく元気でいられますように", descriptionKana: "ながーいあめ。ながーくげんきでいられますように", image: monthly(11, "千歳あめ.webp") },
  { id: "m11-04", month: 11, season: "fall",   category: "jewel",    rarity: "UNCOMMON", name: "トパーズ", nameKana: "トパーズ",           description: "11月生まれの守り石。夕やけ色のきらめき", descriptionKana: "11がつうまれのまもりいし。ゆうやけいろのきらめき",     image: monthly(11, "トパーズ.webp") },
  { id: "m11-05", month: 11, season: "fall",   category: "tool",     rarity: "RARE",     name: "まほうの本", nameKana: "まほうのほん",         description: "読むたびにお話が変わるふしぎな本", descriptionKana: "よむたびにおはなしがかわるふしぎなほん",             image: monthly(11, "まほうの本.webp") },
  // 12月 — クリスマス・大晦日
  { id: "m12-01", month: 12, season: "winter", category: "food",     rarity: "COMMON",   name: "年越しそば", nameKana: "としこしそば",         description: "ズルズル…ながーく元気にすごせますように", descriptionKana: "ズルズル…ながーくげんきにすごせますように",     image: monthly(12, "年越しそば.webp") },
  { id: "m12-02", month: 12, season: "winter", category: "nature",   rarity: "COMMON",   name: "ゆず湯のゆず", nameKana: "ゆずゆのゆず",       description: "お風呂にぷかぷか。体はぽっかぽか", descriptionKana: "おふろにぷかぷか。からだはぽっかぽか",             image: monthly(12, "ゆず湯のゆず.webp") },
  { id: "m12-03", month: 12, season: "winter", category: "creature", rarity: "UNCOMMON", name: "トナカイ", nameKana: "トナカイ",           description: "サンタのそりを引くはやての相棒", descriptionKana: "サンタのそりをひくはやてのあいぼう",               image: monthly(12, "トナカイ.webp") },
  { id: "m12-04", month: 12, season: "winter", category: "jewel",    rarity: "UNCOMMON", name: "ターコイズ", nameKana: "ターコイズ",         description: "12月生まれの守り石。冬の晴れ空の色", descriptionKana: "12がつうまれのまもりいし。ふゆのはれぞらのいろ",         image: monthly(12, "ターコイズ.webp") },
  { id: "m12-05", month: 12, season: "winter", category: "tool",     rarity: "RARE",     name: "金のすず", nameKana: "きんのすず",           description: "本物のサンタのそりから落ちてきた鈴。ふると雪がまう", descriptionKana: "ほんもののサンタのそりからおちてきたすず。ふるとゆきがまう", image: monthly(12, "金のすず.webp") },
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

/**
 * プラン別の宝箱抽選プール。
 *  - PREMIUM: getDrawPoolForDate と同じ (通常 20 + 月限定 5 = 25 件)
 *  - FREE   : 月限定 5 件のみ (通常季節コレクション 80 種はロック)
 * 仕様: docs/未実装仕様書/monetization-plan.md §2.5 / §4.4
 */
export function getDrawPoolForPlan(
  date: Date,
  plan: "FREE" | "PREMIUM",
): CollectionItem[] {
  if (plan === "PREMIUM") return getDrawPoolForDate(date);
  return getMonthlyItems(getMonthForDate(date));
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
