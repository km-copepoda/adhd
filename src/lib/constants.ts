import type { Category, MonsterPath } from "@/types";

// Category labels
export const CATEGORY_LABEL: Record<Category, { emoji: string; name: string }> = {
  STUDY: { emoji: "📚", name: "学力" },
  STAMINA: { emoji: "💪", name: "体力" },
  LIFE: { emoji: "🌿", name: "生活力" },
};

// Category colors (Tailwind classes)
export const CATEGORY_COLOR: Record<Category, string> = {
  STUDY: "#60a5fa",
  STAMINA: "#f87171",
  LIFE: "#4ade80",
};

// ─── 進化閾値 ─────────────────────────────────────────
// EVOLUTION_THRESHOLDS[evolutionStage] = そのステージから次に進化するために必要な合計pt
// null = 最終形態（進化しない。代わりにREBIRTH_THRESHOLDで転生判定）
// stage0(卵)→1: 1pt  stage1→2: 10pt  stage2→3(最終): 30pt
export const EVOLUTION_THRESHOLDS: (number | null)[] = [1, 10, 30, null];

// ─── 転生閾値 ─────────────────────────────────────────
// 最終形態（stage 3）でこのptを貯めると卵（stage 0）に転生する
export const REBIRTH_THRESHOLD = 20;

// ─── 転生後の孵化閾値 ────────────────────────────────
// 転生後の卵（collectedPaths.length > 0）はこのptで孵化する（初回の1ptより長い）
export const REBIRTH_EGG_THRESHOLD = 5;

// ─── たまご ───────────────────────────────────────────
export const EGG_STAGE = { image: "/monsters/dark/egg.webp", name: "たまご", ptToEvolve: 1 };
export const EGG_STAGE_LIGHT = { image: "/monsters/light/egg.webp", name: "たまご", ptToEvolve: 1 };

// ─── モンスターテーブル ───────────────────────────────
// キー = 進化パス履歴（"STUDY" = stage1、"STUDY_LIFE" = stage2、等）
// ひよこ（共通stage1）は廃止。孵化直後に3系統に分岐する。
// 39体: stage1 x3, stage2 x9, stage3 x27
export const MONSTER_TABLE: Record<string, { image: string; name: string; description: string }> = {
  // Stage 1: 3体（孵化直後に分岐）
  "STUDY":   { image: "/monsters/dark/STUDY_ラーン.webp",   name: "ラーン",   description: "大きな眼鏡をかけ、常に分厚い本を抱えた小さな浮遊霊。言葉は「ホウ？」「ナルホド」と理屈っぽい。まだ魔力は弱く、ペンを1本浮かせるのが精一杯。" },
  "STAMINA": { image: "/monsters/dark/STAMINA_ストーン.webp", name: "ストーン", description: "岩に手足が生えたような、どっしりしたモンスター。動きはゆっくりだが、我慢強い。いつも「フンヌッ！」と気合を入れている。" },
  "LIFE":    { image: "/monsters/dark/LIFE_ヘルプ.webp",    name: "ヘルプ",   description: "いつもニコニコ、元気に二足歩行する小さな妖精。手先が器用で、靴を揃えたり挨拶をするのが得意。世話焼きで、困っている人を放っておけない。" },

  // Stage 2: 9体
  "STUDY_STUDY":     { image: "/monsters/dark/STUDY_STUDY_ライブラ.webp",       name: "ライブラ",     description: "ラーンが本と合体し、背中に本棚を背負った姿に。浮遊する本の数が増え、高速でページをめくりながら知識を吸収する。少し気難しく、静寂を好む。" },
  "STUDY_STAMINA":   { image: "/monsters/dark/STUDY_STAMINA_アーマード.webp",   name: "アーマード",   description: "勉系の知能を持ちつつ、体力をつけてガッチリした金属の体を得た。魔力を動力源とするゴーレム。冷静な判断力で、重い魔導書を盾のように扱う。" },
  "STUDY_LIFE":      { image: "/monsters/dark/STUDY_LIFE_クリン.webp",          name: "クリン",       description: "ラーンの「生活を便利にしたい」という気づきから進化。浮遊するハタキや雑巾を魔力で操る。効率的な掃除ルートを計算するのが大好き。" },
  "STAMINA_STUDY":   { image: "/monsters/dark/STAMINA_STUDY_グラビド.webp",     name: "グラビド",     description: "ストーンが知識に目覚めた。自分の体の重さを不思議に思い、重力を操る術を少しだけ覚えた。体の周囲に小さな岩が浮いている。" },
  "STAMINA_STAMINA": { image: "/monsters/dark/STAMINA_STAMINA_ブロック.webp",   name: "ブロック",     description: "ストーンが体力をさらに鍛え、より大きく硬い岩石の体になった。動くことは少ないが、そこにいるだけで安心感を与える、頼り甲斐のある背中。" },
  "STAMINA_LIFE":    { image: "/monsters/dark/STAMINA_LIFE_わっしょい.webp",    name: "わっしょい",   description: "体力を、みんなを楽しませるために使う。笑顔がトレードマーク。腰にハッピを巻き、重いものを担ぐのが大好きで、自然と周囲に人が集まる。" },
  "LIFE_STUDY":      { image: "/monsters/dark/LIFE_STUDY_チックタック.webp",    name: "チックタック", description: "ヘルプが知識に目覚め、時間を守ることの大切さを知った姿。眼鏡をかけ、多くの手で時計を修理・管理する。生活リズムにうるさいアドバイザー。" },
  "LIFE_STAMINA":    { image: "/monsters/dark/LIFE_STAMINA_キャリア.webp",      name: "キャリア",     description: "ヘルプが体力をつけ、重い荷物を運べるようになった。丈夫な足腰と器用な手を持ち、文句を言わず笑顔で荷物を運ぶ働き者。" },
  "LIFE_LIFE":       { image: "/monsters/dark/LIFE_LIFE_マザー.webp",           name: "マザー",       description: "ヘルプが生活力をさらに高め、家事のプロになった。エプロン姿で、たくさんの「手」で同時に料理・洗濯・掃除をこなす。温かい笑顔でみんなを包み込む。" },

  // Stage 3: 27体（最終形態）
  "STUDY_STUDY_STUDY":     { image: "/monsters/dark/STUDY_STUDY_STUDY_ウィズダム.webp",           name: "ウィズダム",     description: "巨大な魔導書の上に座し、無数の魔法のペンが周囲を公転する。世界の真理を解き明かした賢者。常に目を閉じ、数式をブツブツと呟いている。" },
  "STUDY_STUDY_STAMINA":   { image: "/monsters/dark/STUDY_STUDY_STAMINA_タクティクス.webp",       name: "タクティクス",   description: "知識を戦闘に特化させた。クリスタルの体に戦術図が浮かび上がる。敵の動きを完全に予知し、最小限の動きで最大効率の攻撃を繰り出す。" },
  "STUDY_STUDY_LIFE":      { image: "/monsters/dark/STUDY_STUDY_LIFE_エジソン.webp",              name: "エジソン",       description: "「全自動生活」を夢見る、全身ガジェットだらけのロボット。子供の宿題を手伝う全自動お助けメカを作り、理屈っぽいお喋りは相変わらず。" },
  "STUDY_STAMINA_STUDY":   { image: "/monsters/dark/STUDY_STAMINA_STUDY_フォート.webp",           name: "フォート",       description: "魔導鉄兵がさらに知識を深め、自身の重さを魔力で制御し巨大な浮遊要塞となった。完璧な計算に基づいた防御障壁を張る。" },
  "STUDY_STAMINA_STAMINA": { image: "/monsters/dark/STUDY_STAMINA_STAMINA_イージス.webp",         name: "イージス",       description: "アーマードが体力を極め、超重量級の合金ボディとなった。知能は高いが、言葉より先に「守る」行動に出る、無口で頼れる巨大ロボ。" },
  "STUDY_STAMINA_LIFE":    { image: "/monsters/dark/STUDY_STAMINA_LIFE_レスキュー.webp",          name: "レスキュー",     description: "知識と体力を、人助けに使うことを決意。怪我人を運ぶストレッチャーや治療器具を内蔵した、頼もしいカラクリ馬車となる。" },
  "STUDY_LIFE_STUDY":      { image: "/monsters/dark/STUDY_LIFE_STUDY_マイスター.webp",            name: "マイスター",     description: "クリンがさらに効率を追求。無数の小型ドローンを配下に持ち、部屋全体のホコリを一瞬で計算・除去する。汚れを見つけると少しヒステリックになる。" },
  "STUDY_LIFE_STAMINA":    { image: "/monsters/dark/STUDY_LIFE_STAMINA_スリープ.webp",            name: "スリープ",       description: "生活を支える体力を得て、究極の「安らぎ」を提供する。羊のような姿で、魔力で編んだフカフカの布団と適度な重みで安眠を誘う。" },
  "STUDY_LIFE_LIFE":       { image: "/monsters/dark/STUDY_LIFE_LIFE_セバス.webp",                 name: "セバス",         description: "生活力を極めた黄金の執事ロボ。洗練されたお辞儀と完璧な手際ですべての家事をこなす。主人の健康状態を常に計算し、最適な食事を提供する。" },
  "STAMINA_STUDY_STUDY":   { image: "/monsters/dark/STAMINA_STUDY_STUDY_クリスタル.webp",         name: "クリスタル",     description: "重力の研究を極め、岩石の体が透明なクリスタルへと変化した竜。理屈っぽく、美しい幾何学模様を愛する。浮遊するクリスタルで攻撃・防御を行う。" },
  "STAMINA_STUDY_STAMINA": { image: "/monsters/dark/STAMINA_STUDY_STAMINA_マギグラビ.webp",       name: "マギグラビ",     description: "知識を体力へ還元。巨大な岩石の体そのものを重力魔法で自在に浮遊させ、超重量の体当たりを食らわせる重力の魔術師。" },
  "STAMINA_STUDY_LIFE":    { image: "/monsters/dark/STAMINA_STUDY_LIFE_クロック.webp",            name: "クロック",       description: "重力制御の知識を、正確な時を刻む生活力へ応用。体が巨大な時計塔となり、村のシンボルとして時間を守り、重力で天気を予測する。" },
  "STAMINA_STAMINA_STUDY": { image: "/monsters/dark/STAMINA_STAMINA_STUDY_ガイア.webp",           name: "ガイア",         description: "動かざる岩が、大地の鼓動を聞く知識を得た。山のように巨大で、地面に耳を当てて地震や天災を予知する、寡黙な予言者。" },
  "STAMINA_STAMINA_STAMINA": { image: "/monsters/dark/STAMINA_STAMINA_STAMINA_ゴッドストーン.webp", name: "ゴッドストーン", description: "体力を究極まで極めた。山そのものが意思を持ったような姿。絶対に動かないことへの自信に溢れ、あらゆる攻撃を弾き返す、不屈の象徴。" },
  "STAMINA_STAMINA_LIFE":  { image: "/monsters/dark/STAMINA_STAMINA_LIFE_ガーディアン.webp",      name: "ガーディアン",   description: "鍛えた体で家事を手伝い、みんなを守る。巨大なクマのような姿でエプロンをしている。世話焼きで、子供を背中に乗せて遊ぶのが大好き。" },
  "STAMINA_LIFE_STUDY":    { image: "/monsters/dark/STAMINA_LIFE_STUDY_エール.webp",              name: "エール",         description: "笑顔とパワーに加え、どうすれば人を効率よく元気づけられるかを理解した。巨大な声と正確なリズムの応援で、みんなのやる気を最大化する。" },
  "STAMINA_LIFE_STAMINA":  { image: "/monsters/dark/STAMINA_LIFE_STAMINA_グロウ.webp",            name: "グロウ",         description: "笑顔とパワーを、作物を育てることに注いだ。頑丈な足腰で荒れ地を耕し、どんな日照りにも負けず、豊かな実りをもたらす大きな優しいクマ。" },
  "STAMINA_LIFE_LIFE":     { image: "/monsters/dark/STAMINA_LIFE_LIFE_ミコシ.webp",               name: "ミコシ",         description: "生活力を極めた。自身が黄金の神輿となり、みんなに担がれることで、その土地に健康と繁栄をもたらす、笑顔と幸福のエネルギーの塊。" },
  "LIFE_STUDY_STUDY":      { image: "/monsters/dark/LIFE_STUDY_STUDY_カレンダー.webp",            name: "カレンダー",     description: "時間管理を極めた。全身がカレンダーと時計で構成されている。1秒のズレも許さず、主人の予定を完璧に管理し、効率的な生活を徹底させる。" },
  "LIFE_STUDY_STAMINA":    { image: "/monsters/dark/LIFE_STUDY_STAMINA_マイスター.webp",          name: "マイスター",     description: "時計の知識と、それを形にするタフな手を得た。生活を便利にするカラクリ家具や道具を次々と作り出す、笑顔の頑固職人。" },
  "LIFE_STUDY_LIFE":       { image: "/monsters/dark/LIFE_STUDY_LIFE_カロリー.webp",               name: "カロリー",       description: "時間管理を健康管理へ応用。食材の栄養素を瞬時に計算し、最高のタイミングで完璧なバランスの食事を提供する、白衣を着た料理人。" },
  "LIFE_STAMINA_STUDY":    { image: "/monsters/dark/LIFE_STAMINA_STUDY_マーチャント.webp",        name: "マーチャント",   description: "荷運びの中で世の中のニーズを学んだ。巨大なリュックには生活必需品が詰まっており、笑顔と巧みな話術で必要な人に必要なものを届ける。" },
  "LIFE_STAMINA_STAMINA":  { image: "/monsters/dark/LIFE_STAMINA_STAMINA_ムービング.webp",        name: "ムービング",     description: "体力を極め、家一軒をそのまま持ち上げられるほどのパワーを得た。器用な手で家具を傷つけず、笑顔で迅速に引っ越しをこなす、頼り甲斐のある巨人。" },
  "LIFE_STAMINA_LIFE":     { image: "/monsters/dark/LIFE_STAMINA_LIFE_ナース.webp",               name: "ナース",         description: "パワーを優しさのために使う。大きな体で子供を優しく抱き上げ、どんなに泣き喚く子も笑顔で寝かしつける、太陽のような包容力を持つ。" },
  "LIFE_LIFE_STUDY":       { image: "/monsters/dark/LIFE_LIFE_STUDY_シェフ.webp",                 name: "シェフ",         description: "家事の中でも料理の知識を極めた。無数の手で異なる料理を同時に作り、味・栄養・彩り、すべてが完璧な至高のフルコースを提供する。" },
  "LIFE_LIFE_STAMINA":     { image: "/monsters/dark/LIFE_LIFE_STAMINA_サンシャイン.webp",         name: "サンシャイン",   description: "洗濯に体力を注いだ。どんな頑固な汚れも強靭な腕で真っ白に洗い上げ、太陽のような熱気で一瞬で乾かす。抱きつくとお日様の匂いがする。" },
  "LIFE_LIFE_LIFE":        { image: "/monsters/dark/LIFE_LIFE_LIFE_ゴッドセバス.webp",            name: "ゴッドセバス",   description: "生活力を極めた究極の奉仕者。存在自体がその場所を「完璧な快適空間」に変える。常に最高の笑顔で、主人の望みを先読みして叶える。" },
};

// LIGHT（女の子）用テーブル。public/monsters/light/ の webp を使用。
export const MONSTER_TABLE_LIGHT: typeof MONSTER_TABLE = {
  // Stage 1
  "STUDY":   { image: "/monsters/light/STUDY_ルミナ.webp",   name: "ルミナ",   description: MONSTER_TABLE["STUDY"].description },
  "STAMINA": { image: "/monsters/light/STAMINA_アクティ.webp", name: "アクティ", description: MONSTER_TABLE["STAMINA"].description },
  "LIFE":    { image: "/monsters/light/LIFE_メルル.webp",    name: "メルル",   description: MONSTER_TABLE["LIFE"].description },
  // Stage 2
  "STUDY_STUDY":     { image: "/monsters/light/STUDY_STUDY_インテリキャット.webp",       name: "インテリキャット",         description: MONSTER_TABLE["STUDY_STUDY"].description },
  "STUDY_STAMINA":   { image: "/monsters/light/STUDY_STAMINA_クリスタルバード.webp",     name: "クリスタルバード",         description: MONSTER_TABLE["STUDY_STAMINA"].description },
  "STUDY_LIFE":      { image: "/monsters/light/STUDY_LIFE_インクペンギン.webp",          name: "インクペンギン",           description: MONSTER_TABLE["STUDY_LIFE"].description },
  "STAMINA_STUDY":   { image: "/monsters/light/STAMINA_STUDY_スカウトフォックス.webp",   name: "スカウトフォックス",       description: MONSTER_TABLE["STAMINA_STUDY"].description },
  "STAMINA_STAMINA": { image: "/monsters/light/STAMINA_STAMINA_ブレイブレオ.webp",       name: "ブレイブレオ",             description: MONSTER_TABLE["STAMINA_STAMINA"].description },
  "STAMINA_LIFE":    { image: "/monsters/light/STAMINA_LIFE_レスキューパピー.webp",      name: "レスキューパピー",         description: MONSTER_TABLE["STAMINA_LIFE"].description },
  "LIFE_STUDY":      { image: "/monsters/light/LIFE_STUDY_ミントアライグマ.webp",        name: "ミントアライグマ",         description: MONSTER_TABLE["LIFE_STUDY"].description },
  "LIFE_STAMINA":    { image: "/monsters/light/LIFE_STAMINA_ポポパンダ.webp",            name: "ポポパンダ",               description: MONSTER_TABLE["LIFE_STAMINA"].description },
  "LIFE_LIFE":       { image: "/monsters/light/LIFE_LIFE_コットンラム.webp",             name: "コットンラム",             description: MONSTER_TABLE["LIFE_LIFE"].description },
  // Stage 3
  "STUDY_STUDY_STUDY":     { image: "/monsters/light/STUDY_STUDY_STUDY_大魔導士プラチナキャット.webp",       name: "大魔導士プラチナキャット",     description: MONSTER_TABLE["STUDY_STUDY_STUDY"].description },
  "STUDY_STUDY_STAMINA":   { image: "/monsters/light/STUDY_STUDY_STAMINA_チェスナイト・スノーレオ.webp",     name: "チェスナイト・スノーレオ",     description: MONSTER_TABLE["STUDY_STUDY_STAMINA"].description },
  "STUDY_STUDY_LIFE":      { image: "/monsters/light/STUDY_STUDY_LIFE_古書堂のミケネコ.webp",                name: "古書堂のミケネコ",             description: MONSTER_TABLE["STUDY_STUDY_LIFE"].description },
  "STUDY_STAMINA_STUDY":   { image: "/monsters/light/STUDY_STAMINA_STUDY_極光のペガサス.webp",               name: "極光のペガサス",               description: MONSTER_TABLE["STUDY_STAMINA_STUDY"].description },
  "STUDY_STAMINA_STAMINA": { image: "/monsters/light/STUDY_STAMINA_STAMINA_空の覇者グリフォン.webp",         name: "空の覇者グリフォン",           description: MONSTER_TABLE["STUDY_STAMINA_STAMINA"].description },
  "STUDY_STAMINA_LIFE":    { image: "/monsters/light/STUDY_STAMINA_LIFE_幸運の青い鳥.webp",                  name: "幸運の青い鳥",                 description: MONSTER_TABLE["STUDY_STAMINA_LIFE"].description },
  "STUDY_LIFE_STUDY":      { image: "/monsters/light/STUDY_LIFE_STUDY_時計仕掛けのラビット.webp",            name: "時計仕掛けのラビット",         description: MONSTER_TABLE["STUDY_LIFE_STUDY"].description },
  "STUDY_LIFE_STAMINA":    { image: "/monsters/light/STUDY_LIFE_STAMINA_発明家のビーバー.webp",              name: "発明家のビーバー",             description: MONSTER_TABLE["STUDY_LIFE_STAMINA"].description },
  "STUDY_LIFE_LIFE":       { image: "/monsters/light/STUDY_LIFE_LIFE_調香師のリス.webp",                     name: "調香師のリス",                 description: MONSTER_TABLE["STUDY_LIFE_LIFE"].description },
  "STAMINA_STUDY_STUDY":   { image: "/monsters/light/STAMINA_STUDY_STUDY_氷上のフィギュアフォックス.webp",   name: "氷上のフィギュアフォックス",   description: MONSTER_TABLE["STAMINA_STUDY_STUDY"].description },
  "STAMINA_STUDY_STAMINA": { image: "/monsters/light/STAMINA_STUDY_STAMINA_蒼き炎のフェニックス.webp",       name: "蒼き炎のフェニックス",         description: MONSTER_TABLE["STAMINA_STUDY_STAMINA"].description },
  "STAMINA_STUDY_LIFE":    { image: "/monsters/light/STAMINA_STUDY_LIFE_山岳救助犬ハスキー.webp",            name: "山岳救助犬ハスキー",           description: MONSTER_TABLE["STAMINA_STUDY_LIFE"].description },
  "STAMINA_STAMINA_STUDY": { image: "/monsters/light/STAMINA_STAMINA_STUDY_真実の聖騎士・レオ.webp",         name: "真実の聖騎士・レオ",           description: MONSTER_TABLE["STAMINA_STAMINA_STUDY"].description },
  "STAMINA_STAMINA_STAMINA": { image: "/monsters/light/STAMINA_STAMINA_STAMINA_太陽の黄金龍.webp",           name: "太陽の黄金龍",                 description: MONSTER_TABLE["STAMINA_STAMINA_STAMINA"].description },
  "STAMINA_STAMINA_LIFE":  { image: "/monsters/light/STAMINA_STAMINA_LIFE_頼れるボクサー・カンガルー.webp",  name: "頼れるボクサー・カンガルー",   description: MONSTER_TABLE["STAMINA_STAMINA_LIFE"].description },
  "STAMINA_LIFE_STUDY":    { image: "/monsters/light/STAMINA_LIFE_STUDY_森の案内人トナカイ.webp",            name: "森の案内人トナカイ",           description: MONSTER_TABLE["STAMINA_LIFE_STUDY"].description },
  "STAMINA_LIFE_STAMINA":  { image: "/monsters/light/STAMINA_LIFE_STAMINA_大地の王者マンモス.webp",          name: "大地の王者マンモス",           description: MONSTER_TABLE["STAMINA_LIFE_STAMINA"].description },
  "STAMINA_LIFE_LIFE":     { image: "/monsters/light/STAMINA_LIFE_LIFE_忠義の守護柴犬.webp",                 name: "忠義の守護柴犬",               description: MONSTER_TABLE["STAMINA_LIFE_LIFE"].description },
  "LIFE_STUDY_STUDY":      { image: "/monsters/light/LIFE_STUDY_STUDY_薬剤師のシロクマ.webp",                name: "薬剤師のシロクマ",             description: MONSTER_TABLE["LIFE_STUDY_STUDY"].description },
  "LIFE_STUDY_STAMINA":    { image: "/monsters/light/LIFE_STUDY_STAMINA_職人肌のモグラ.webp",                name: "職人肌のモグラ",               description: MONSTER_TABLE["LIFE_STUDY_STAMINA"].description },
  "LIFE_STUDY_LIFE":       { image: "/monsters/light/LIFE_STUDY_LIFE_お針子のカイコさん.webp",               name: "お針子のカイコさん",           description: MONSTER_TABLE["LIFE_STUDY_LIFE"].description },
  "LIFE_STAMINA_STUDY":    { image: "/monsters/light/LIFE_STAMINA_STUDY_海洋のナース・イルカ.webp",          name: "海洋のナース・イルカ",         description: MONSTER_TABLE["LIFE_STAMINA_STUDY"].description },
  "LIFE_STAMINA_STAMINA":  { image: "/monsters/light/LIFE_STAMINA_STAMINA_不屈のアルパカ.webp",              name: "不屈のアルパカ",               description: MONSTER_TABLE["LIFE_STAMINA_STAMINA"].description },
  "LIFE_STAMINA_LIFE":     { image: "/monsters/light/LIFE_STAMINA_LIFE_陽だまりのカピバラ.webp",             name: "陽だまりのカピバラ",           description: MONSTER_TABLE["LIFE_STAMINA_LIFE"].description },
  "LIFE_LIFE_STUDY":       { image: "/monsters/light/LIFE_LIFE_STUDY_パティシエ・レッサーパンダ.webp",       name: "パティシエ・レッサーパンダ",   description: MONSTER_TABLE["LIFE_LIFE_STUDY"].description },
  "LIFE_LIFE_STAMINA":     { image: "/monsters/light/LIFE_LIFE_STAMINA_大鍋のゾウさん.webp",                 name: "大鍋のゾウさん",               description: MONSTER_TABLE["LIFE_LIFE_STAMINA"].description },
  "LIFE_LIFE_LIFE":        { image: "/monsters/light/LIFE_LIFE_LIFE_慈愛の聖母ラム.webp",                    name: "慈愛の聖母ラム",               description: MONSTER_TABLE["LIFE_LIFE_LIFE"].description },
};

// ─── getMonsterStage ──────────────────────────────────
// evolutionStage=0 → 卵、1+ → MONSTER_TABLE[evolutionPath]
// side="LIGHT" のときは MONSTER_TABLE_LIGHT を参照
export function getMonsterStage(evolutionStage: number, evolutionPath: string, side?: string | null) {
  if (evolutionStage <= 0) return side === "LIGHT" ? EGG_STAGE_LIGHT : EGG_STAGE;

  const stageIdx = Math.min(evolutionStage, EVOLUTION_THRESHOLDS.length - 1);
  const ptToEvolve = EVOLUTION_THRESHOLDS[stageIdx];
  const table = side === "LIGHT" ? MONSTER_TABLE_LIGHT : MONSTER_TABLE;
  const monster = table[evolutionPath] ?? { image: "", name: "???" };

  return { ...monster, ptToEvolve };
}

// ─── computeEvolutionWeights ──────────────────────────
// dominant パラメータは最大60%の確率、残り40%は2番目・3番目の比率で分配
export function computeEvolutionWeights(
  studyPt: number,
  staminaPt: number,
  lifePt: number,
): { STUDY: number; STAMINA: number; LIFE: number } {
  const total = studyPt + staminaPt + lifePt;

  if (total === 0) {
    return { STUDY: 1 / 3, STAMINA: 1 / 3, LIFE: 1 / 3 };
  }

  const entries: [MonsterPath, number][] = [
    ["STUDY", studyPt],
    ["STAMINA", staminaPt],
    ["LIFE", lifePt],
  ];
  entries.sort((a, b) => b[1] - a[1]);

  const [first, second, third] = entries;
  const firstProb = Math.min(first[1] / total, 0.6);
  const remaining = 1 - firstProb;

  const secondAndThirdTotal = second[1] + third[1];
  let secondProb: number;
  let thirdProb: number;

  if (secondAndThirdTotal === 0) {
    secondProb = remaining / 2;
    thirdProb = remaining / 2;
  } else {
    secondProb = remaining * (second[1] / secondAndThirdTotal);
    thirdProb = remaining * (third[1] / secondAndThirdTotal);
  }

  const weights = { STUDY: 0, STAMINA: 0, LIFE: 0 };
  weights[first[0]] = firstProb;
  weights[second[0]] = secondProb;
  weights[third[0]] = thirdProb;

  return weights;
}

// ─── selectEvolutionPath ─────────────────────────────
// 加重乱数でパスを選択する
export function selectEvolutionPath(
  studyPt: number,
  staminaPt: number,
  lifePt: number,
): MonsterPath {
  const weights = computeEvolutionWeights(studyPt, staminaPt, lifePt);
  const r = Math.random();
  let cumulative = 0;

  for (const path of ["STUDY", "STAMINA", "LIFE"] as MonsterPath[]) {
    cumulative += weights[path];
    if (r < cumulative) return path;
  }

  return "LIFE"; // 丸め誤差フォールバック
}

// ─── checkEvolution ───────────────────────────────────
// 進化チェック。進化した場合はパラメータをリセットし新パスを返す。
// ステージ0→1（孵化）はパス選択なし（newPath = ""）
// ステージ1以降の進化でパスを加重乱数で選択し追記する。
export function checkEvolution(
  evolutionStage: number,
  evolutionPath: string,
  studyPt: number,
  staminaPt: number,
  lifePt: number,
  isReborn = false,
): {
  evolved: boolean;
  reborn: boolean;
  newStage: number;
  newPath: string;
  resetStudy: number;
  resetStamina: number;
  resetLife: number;
} {
  const stageIdx = Math.min(evolutionStage, EVOLUTION_THRESHOLDS.length - 1);
  const baseThreshold = EVOLUTION_THRESHOLDS[stageIdx];
  const threshold = evolutionStage === 0 && isReborn ? REBIRTH_EGG_THRESHOLD : baseThreshold;
  const total = studyPt + staminaPt + lifePt;

  // 最終形態（stage 3）: 転生判定
  if (threshold === null) {
    if (total >= REBIRTH_THRESHOLD) {
      return {
        evolved: false,
        reborn: true,
        newStage: 0,
        newPath: "",
        resetStudy: 0,
        resetStamina: 0,
        resetLife: 0,
      };
    }
    return {
      evolved: false,
      reborn: false,
      newStage: evolutionStage,
      newPath: evolutionPath,
      resetStudy: studyPt,
      resetStamina: staminaPt,
      resetLife: lifePt,
    };
  }

  if (total < threshold) {
    return {
      evolved: false,
      reborn: false,
      newStage: evolutionStage,
      newPath: evolutionPath,
      resetStudy: studyPt,
      resetStamina: staminaPt,
      resetLife: lifePt,
    };
  }

  // 全ステージでパスを選択（孵化時も含む）
  const selected = selectEvolutionPath(studyPt, staminaPt, lifePt);
  const newPath = evolutionPath ? `${evolutionPath}_${selected}` : selected;

  return {
    evolved: true,
    reborn: false,
    newStage: evolutionStage + 1,
    newPath,
    resetStudy: 0,
    resetStamina: 0,
    resetLife: 0,
  };
}

// ─── getXpInfo ────────────────────────────────────────
export function getXpInfo(
  evolutionStage: number,
  evolutionPath: string,
  studyPt: number,
  staminaPt: number,
  lifePt: number,
  isReborn = false,
) {
  const total = studyPt + staminaPt + lifePt;
  const stageIdx = Math.min(evolutionStage, EVOLUTION_THRESHOLDS.length - 1);
  const baseXp = EVOLUTION_THRESHOLDS[stageIdx];
  const xpToEvolve = evolutionStage === 0 && isReborn ? REBIRTH_EGG_THRESHOLD : baseXp;

  return {
    totalPt: total,
    evolutionStage: stageIdx,
    xpInStage: total,
    xpToEvolve,
    ptNeeded: xpToEvolve !== null ? xpToEvolve - total : null,
    evolutionWeights:
      xpToEvolve !== null ? computeEvolutionWeights(studyPt, staminaPt, lifePt) : null,
  };
}

// ─── 一時タスク汎用テンプレート ──────────────────────
export type TaskPreset = { title: string; category: Category };

export const TEMP_TASK_TEMPLATES: TaskPreset[] = [
  { title: "宿題をやる", category: "STUDY" },
  { title: "音読をする", category: "STUDY" },
  { title: "ドリルをやる", category: "STUDY" },
  { title: "本を読む", category: "STUDY" },
  { title: "外で遊ぶ", category: "STAMINA" },
  { title: "運動する", category: "STAMINA" },
  { title: "散歩に行く", category: "STAMINA" },
  { title: "縄跳びをする", category: "STAMINA" },
  { title: "部屋を片付ける", category: "LIFE" },
  { title: "お手伝いをする", category: "LIFE" },
  { title: "歯磨きをする", category: "LIFE" },
  { title: "早く寝る", category: "LIFE" },
];

// Day of week labels (Japanese)
export const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

// Generate 6-char family code
export function generateFamilyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─── ストリーク ──────────────────────────────────────
export const STREAK_MILESTONES = [
  { days: 3, title: "はじめの一歩", emoji: "🔥", bonusPt: 5 },
  { days: 7, title: "一週間の戦士", emoji: "⚔️", bonusPt: 10 },
  { days: 30, title: "月の修行者", emoji: "🌙", bonusPt: 20 },
  { days: 100, title: "伝説の冒険者", emoji: "👑", bonusPt: 30 },
] as const;

/** 現在のストリークに対応する称号（未達成なら null） */
export function getStreakTitle(currentStreak: number) {
  let best: (typeof STREAK_MILESTONES)[number] | null = null;
  for (const m of STREAK_MILESTONES) {
    if (currentStreak >= m.days) best = m;
  }
  return best;
}

/** oldStreak→newStreak で新たに到達したマイルストーンのボーナス合計を返す */
export function getNewMilestoneBonus(oldStreak: number, newStreak: number): number {
  let bonus = 0;
  for (const m of STREAK_MILESTONES) {
    if (oldStreak < m.days && newStreak >= m.days) bonus += m.bonusPt;
  }
  return bonus;
}

/** ボーナスptを3カテゴリ均等分配（端数は STUDY に加算） */
export function distributeBonus(bonus: number): { study: number; stamina: number; life: number } {
  const base = Math.floor(bonus / 3);
  const remainder = bonus - base * 3;
  return { study: base + remainder, stamina: base, life: base };
}

// Rejection reason presets by category
export const REJECTION_REASONS: Record<Category, string[]> = {
  STUDY: [
    "宿題のページが違うよ",
    "まだ全部終わってないみたい",
    "字が読めないよ、書き直してね",
    "写真が暗くてよく見えないよ",
    "その他",
  ],
  STAMINA: [
    "時間が短すぎるよ、もう少しやってみよう",
    "まだ全部終わってないみたい",
    "写真や動画をつけてね",
    "別のことをやってたみたい",
    "その他",
  ],
  LIFE: [
    "まだ全部終わってないみたい",
    "きれいになってないところがあるよ",
    "写真が暗くてよく見えないよ",
    "もう少し丁寧にやってみよう",
    "その他",
  ],
};

// ─── 進化ツリー ───────────────────────────────────────
/** 指定パスの直接の進化先（子ノード）を返す。
 *  parentPath="" → Stage1の3体, "STUDY" → Stage2の3体, "STUDY_STAMINA" → Stage3の3体, Stage3 → []
 */
export function getEvolutionChildren(parentPath: string): string[] {
  const allKeys = Object.keys(MONSTER_TABLE);
  if (parentPath === "") {
    return allKeys.filter((k) => k.split("_").length === 1);
  }
  const depth = parentPath.split("_").length;
  return allKeys.filter(
    (k) => k.startsWith(parentPath + "_") && k.split("_").length === depth + 1
  );
}

// Generate 4-digit child code (ユーザーコード)
export function generateChildCode(): string {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}
