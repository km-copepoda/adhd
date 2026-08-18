import { EVOLUTION_THRESHOLDS } from "@/lib/evolution";
import { MONSTER_TABLE as BUDDHA_TABLE, EGG_STAGE as BUDDHA_EGG_STAGE } from "@/lib/monsterThemes/buddha";

// ─── たまご ───────────────────────────────────────────
export const EGG_STAGE = { image: "/monsters/dark/egg.webp", name: "たまご", ptToEvolve: 1, description: "これから何が生まれるかな？ワクワクするね！"};
export const EGG_STAGE_LIGHT = { image: "/monsters/light/egg.webp", name: "たまご", ptToEvolve: 1, description: "これから何が生まれるかな？ワクワクするね！" };

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
  "STUDY":   { image: "/monsters/light/STUDY_ルミナ.webp",   name: "ルミナ",   description: "星の光みたいにふわっと輝く小さな妖精。丸くてキラキラした目が可愛い。本を読むと魔法の光文字が体を包む。「ふふっ、わかったよ！」が口グセ。" },
  "STAMINA": { image: "/monsters/light/STAMINA_アクティ.webp", name: "アクティ", description: "ぽよぽよした体でいつも元気いっぱい！どんな坂道も全力ダッシュ。「やるきまんまん！」が口グセで、しっぽをふりふりしながら走り回っている。" },
  "LIFE":    { image: "/monsters/light/LIFE_メルル.webp",    name: "メルル",   description: "ふわふわの羽根をもつちいさな精霊。お家の中の小さな「ハッピー」を見つけるのが得意。靴をそろえたりお手伝いが大好きで、そっといい香りを運んでくれる。" },
  // Stage 2
  "STUDY_STUDY":     { image: "/monsters/light/STUDY_STUDY_インテリキャット.webp",       name: "インテリキャット",         description: "ルミナが本と友だちになって、ふわふわ猫に進化！頭に小さな眼鏡をかけ、しっぽで本のページをめくる。勉強中はとっても集中するけど、なでなでされるとゴロゴロいう。" },
  "STUDY_STAMINA":   { image: "/monsters/light/STUDY_STAMINA_クリスタルバード.webp",     name: "クリスタルバード",         description: "知識と体力を両方鍛えた、翼がクリスタルで輝く鳥。空を飛びながらメモをとり、どんな高い木にも登って調べものをする。羽ばたくと知恵のきらめきが広がる。" },
  "STUDY_LIFE":      { image: "/monsters/light/STUDY_LIFE_インクペンギン.webp",          name: "インクペンギン",           description: "ルミナが「くらしをもっとたのしく」と考えて進化。ぽてぽてしたペンギンの体にインク瓶をいつも持っている。毎日のできごとを絵日記にかわいくまとめるのが大好き。" },
  "STAMINA_STUDY":   { image: "/monsters/light/STAMINA_STUDY_スカウトフォックス.webp",   name: "スカウトフォックス",       description: "アクティが賢くなって、山や森で道を探すのが得意なキツネに進化。くるんとした尻尾のおかげでバランス感覚も抜群。地図を読みながら颯爽と走る。" },
  "STAMINA_STAMINA": { image: "/monsters/light/STAMINA_STAMINA_ブレイブレオ.webp",       name: "ブレイブレオ",             description: "体力をさらに鍛えた勇敢なライオン。ふわふわのたてがみがかわいく、でんと構えた姿はとっても頼もしい。「ぜったいまけないよ！」が口グセ。" },
  "STAMINA_LIFE":    { image: "/monsters/light/STAMINA_LIFE_レスキューパピー.webp",      name: "レスキューパピー",         description: "体力をみんなのために使う元気な子犬。ふわふわの耳で遠くの声を聞き、小さな救急バッグを背負っていつでも助けに行く。笑顔と尻尾ふりが最高の応援。" },
  "LIFE_STUDY":      { image: "/monsters/light/LIFE_STUDY_ミントアライグマ.webp",        name: "ミントアライグマ",         description: "メルルが時間の大切さに気づいて進化。ミントグリーンの縞模様がキュート。几帳面に手を洗い、生活リズムをノートに書き留めるのが得意。" },
  "LIFE_STAMINA":    { image: "/monsters/light/LIFE_STAMINA_ポポパンダ.webp",            name: "ポポパンダ",               description: "メルルが力持ちになった丸々としたパンダ。ゆっくりのんびりだけど、いざとなるとびっくりするほど力持ち。笑顔でタケノコを渡してくれる姿が最高にかわいい。" },
  "LIFE_LIFE":       { image: "/monsters/light/LIFE_LIFE_コットンラム.webp",             name: "コットンラム",             description: "生活力がさらに上がってふわふわの羊に進化。体がコットンみたいにもこもこ。お洗濯とお料理が得意で、家にいるだけでほんわかした気持ちになれる。" },
  // Stage 3
  "STUDY_STUDY_STUDY":     { image: "/monsters/light/STUDY_STUDY_STUDY_大魔導士プラチナキャット.webp",       name: "大魔導士プラチナキャット",     description: "白銀の毛並みに魔法陣が浮かぶ大魔導士猫。星の輝きを纏い、無数の本が周りをくるくる飛んでいる。微笑みながらキラキラの魔法をかけてくれる知恵の女王。" },
  "STUDY_STUDY_STAMINA":   { image: "/monsters/light/STUDY_STUDY_STAMINA_チェスナイト・スノーレオ.webp",     name: "チェスナイト・スノーレオ",     description: "チェスの戦略を極めた雪白のライオン。たてがみが雪の結晶みたいにキラキラ輝く。一手で相手の気持ちを読んで最高の答えを導く。でもお昼寝が何より大好き。" },
  "STUDY_STUDY_LIFE":      { image: "/monsters/light/STUDY_STUDY_LIFE_古書堂のミケネコ.webp",                name: "古書堂のミケネコ",             description: "三毛猫が古い本屋さんに棲みついた姿。たくさんの本の香りに包まれ、訪れた人に必要な本をそっと教えてくれる。その眼差しは優しく、すべてを見通しているみたい。" },
  "STUDY_STAMINA_STUDY":   { image: "/monsters/light/STUDY_STAMINA_STUDY_極光のペガサス.webp",               name: "極光のペガサス",               description: "知性と体力を究めた白馬に翼が生えた姿。オーロラのような光のたてがみをなびかせて空を駆ける。その蹄が触れた地には知恵の花が咲くという。" },
  "STUDY_STAMINA_STAMINA": { image: "/monsters/light/STUDY_STAMINA_STAMINA_空の覇者グリフォン.webp",         name: "空の覇者グリフォン",           description: "鷹の知恵とライオンの体力を持つ誇り高き生き物。空の一番高いところから世界を見守り、大切なものを守り抜く。その翼の風に当たると勇気が湧いてくる。" },
  "STUDY_STAMINA_LIFE":    { image: "/monsters/light/STUDY_STAMINA_LIFE_幸運の青い鳥.webp",                  name: "幸運の青い鳥",                 description: "幸せを運ぶと言われる小さな青い鳥。頭がよくて飛ぶのも得意で、困っている人を見つけると必ずそっと助けてくれる。羽根が触れた場所には幸運の花びらが舞う。" },
  "STUDY_LIFE_STUDY":      { image: "/monsters/light/STUDY_LIFE_STUDY_時計仕掛けのラビット.webp",            name: "時計仕掛けのラビット",         description: "精密な時計の歯車で動く不思議なウサギ。耳が時計の針みたいにくるくる回る。「おじかんをたいせつに！」と言いながら、正確な生活リズムを教えてくれる。" },
  "STUDY_LIFE_STAMINA":    { image: "/monsters/light/STUDY_LIFE_STAMINA_発明家のビーバー.webp",              name: "発明家のビーバー",             description: "知識と生活力で便利なものを作り続けるビーバー。丈夫な歯と器用な手で毎日新しいお家グッズを発明している。しっぽで設計図を描くのが何より楽しみ。" },
  "STUDY_LIFE_LIFE":       { image: "/monsters/light/STUDY_LIFE_LIFE_調香師のリス.webp",                     name: "調香師のリス",                 description: "自然の香りを知り尽くしたかわいいリス。どんぐり帽子にハーブを詰め、最高のアロマを調合する。そのお部屋にいるだけでふわっと幸せな気持ちになれる。" },
  "STAMINA_STUDY_STUDY":   { image: "/monsters/light/STAMINA_STUDY_STUDY_氷上のフィギュアフォックス.webp",   name: "氷上のフィギュアフォックス",   description: "氷の上を舞う、知恵と美しさを兼ね備えたキツネ。クリスタルのスケートシューズで完璧な演技をして、見る人全員を笑顔にする。その軌跡は星の絵になる。" },
  "STAMINA_STUDY_STAMINA": { image: "/monsters/light/STAMINA_STUDY_STAMINA_蒼き炎のフェニックス.webp",       name: "蒼き炎のフェニックス",         description: "不死鳥の力と知恵を持ち、深い青の炎に包まれた鳥。どんなに大変なことがあっても必ず立ち上がり、仲間を励ます。その歌声は悲しみを溶かしてしまう。" },
  "STAMINA_STUDY_LIFE":    { image: "/monsters/light/STAMINA_STUDY_LIFE_山岳救助犬ハスキー.webp",            name: "山岳救助犬ハスキー",           description: "雪山の知識と体力を持つ青い目のハスキー。猛吹雪の中でも道を迷わず、倒れた人を温かな毛皮で包んで安全な場所へ連れ帰る。その尻尾ふりは嵐の中でも止まらない。" },
  "STAMINA_STAMINA_STUDY": { image: "/monsters/light/STAMINA_STAMINA_STUDY_真実の聖騎士・レオ.webp",         name: "真実の聖騎士・レオ",           description: "正義と知恵を極めた王者ライオン。金の甲冑がまぶしく輝き、ひとたび咆哮すれば不正が消え去るという。でもお友達の前では甘えん坊な一面も。" },
  "STAMINA_STAMINA_STAMINA": { image: "/monsters/light/STAMINA_STAMINA_STAMINA_太陽の黄金龍.webp",           name: "太陽の黄金龍",                 description: "太陽の力を宿した黄金に輝く竜。どんなに暗い夜でも温かな光で照らし、寒さや悲しみを溶かしてしまう。その声は虹を呼ぶ。" },
  "STAMINA_STAMINA_LIFE":  { image: "/monsters/light/STAMINA_STAMINA_LIFE_頼れるボクサー・カンガルー.webp",  name: "頼れるボクサー・カンガルー",   description: "体力を鍛えつくしたお母さんカンガルー。ポケットには必要なものが何でも入っていて、みんなの荷物を抱えて全力ダッシュ。笑顔が最高の応援歌になる。" },
  "STAMINA_LIFE_STUDY":    { image: "/monsters/light/STAMINA_LIFE_STUDY_森の案内人トナカイ.webp",            name: "森の案内人トナカイ",           description: "森の地理を熟知したトナカイ。ツノがコンパスみたいに光って迷子を正しい方向へ導く。思いやりがあって、迷い込んだ動物たちのお家を見つけるのが何より好き。" },
  "STAMINA_LIFE_STAMINA":  { image: "/monsters/light/STAMINA_LIFE_STAMINA_大地の王者マンモス.webp",          name: "大地の王者マンモス",           description: "大地の力を宿した大きなマンモス。その一歩一歩が地面を豊かにして、踏んだ場所に花が咲く。みんなをふかふかの背中に乗せてゆったり歩いてくれる。" },
  "STAMINA_LIFE_LIFE":     { image: "/monsters/light/STAMINA_LIFE_LIFE_忠義の守護柴犬.webp",                 name: "忠義の守護柴犬",               description: "大切な人への誠実さを極めた柴犬。いつも凛と背筋を伸ばして、大切な人を守るために走り続ける。「おかえり！」と尻尾をふる姿が家族への最高の出迎え。" },
  "LIFE_STUDY_STUDY":      { image: "/monsters/light/LIFE_STUDY_STUDY_薬剤師のシロクマ.webp",                name: "薬剤師のシロクマ",             description: "薬草の知識を極めたやさしいシロクマ。白衣を着て、自然の材料で体にいいお薬を調合する。「よしよし、すぐなおるよ」と大きな手でなでてくれる。" },
  "LIFE_STUDY_STAMINA":    { image: "/monsters/light/LIFE_STUDY_STAMINA_職人肌のモグラ.webp",                name: "職人肌のモグラ",               description: "手先が器用で力持ちなモグラ職人。分厚い手袋と道具箱で、壊れたものを何でも直してしまう。無口だけどできあがった作品はいつも本当に素晴らしい。" },
  "LIFE_STUDY_LIFE":       { image: "/monsters/light/LIFE_STUDY_LIFE_お針子のカイコさん.webp",               name: "お針子のカイコさん",           description: "上質な糸を紡ぎ美しい布を織るカイコ。小さな体に大きなハートを持つ。「着る人が笑顔になれますように」と願いながら、一針一針丁寧に縫い上げる。" },
  "LIFE_STAMINA_STUDY":    { image: "/monsters/light/LIFE_STAMINA_STUDY_海洋のナース・イルカ.webp",          name: "海洋のナース・イルカ",         description: "広い海を泳ぎながら困っている生き物を助けるイルカ。医学の知識と泳ぎの速さで、どんな遠い場所にも駆けつける。その歌声は心の痛みも癒やしてしまう。" },
  "LIFE_STAMINA_STAMINA":  { image: "/monsters/light/LIFE_STAMINA_STAMINA_不屈のアルパカ.webp",              name: "不屈のアルパカ",               description: "ふわふわの毛とたくましい体を持つアルパカ。どんな荒れた天気でも温かな毛糸を紡ぎ続ける。その毛糸で編んだセーターを着ると不思議と元気が出てくる。" },
  "LIFE_STAMINA_LIFE":     { image: "/monsters/light/LIFE_STAMINA_LIFE_陽だまりのカピバラ.webp",             name: "陽だまりのカピバラ",           description: "お風呂が大好きな世界一のんびり屋さんカピバラ。一緒にいるだけで全身の力が抜けてほっこり。みんなが幸せになるよう温泉をあちこちに作っている。" },
  "LIFE_LIFE_STUDY":       { image: "/monsters/light/LIFE_LIFE_STUDY_パティシエ・レッサーパンダ.webp",       name: "パティシエ・レッサーパンダ",   description: "スイーツの科学を極めたレッサーパンダ。まるっとした体でテキパキとケーキを焼く姿がかわいい。食べた人が笑顔になれる魔法のスイーツが得意。" },
  "LIFE_LIFE_STAMINA":     { image: "/monsters/light/LIFE_LIFE_STAMINA_大鍋のゾウさん.webp",                 name: "大鍋のゾウさん",               description: "大きな鼻でどんな食材も一気にかき混ぜる料理上手なゾウ。何百人分でも笑顔で作れる大きな鍋と大きな心の持ち主。食べた人みんながお腹いっぱい幸せになる。" },
  "LIFE_LIFE_LIFE":        { image: "/monsters/light/LIFE_LIFE_LIFE_慈愛の聖母ラム.webp",                    name: "慈愛の聖母ラム",               description: "生活力をすべて愛情に変えた白い羊。存在するだけで周りの空気がふんわり温かくなる。みんなの悲しみを柔らかな羊毛に包み込み、笑顔の花をそっと咲かせる。" },
};


// ─── テーマ別テーブル参照（getMonsterStage 用の内部マッピング）──────────
// NOTE: @/lib/monsterThemes/index（テーマレジストリ）は本ファイルの MONSTER_TABLE 等を
// 参照するため、そちらを import すると循環参照になる。getMonsterStage が必要とする
// 「テーブル + 卵」だけをここで直接組み立てる。テーマの追加・削除は
// @/lib/monsterThemes/index の MONSTER_THEMES と両方に反映すること。
const THEME_ENTRIES: Record<string, { table: typeof MONSTER_TABLE; egg: typeof EGG_STAGE }> = {
  dark: { table: MONSTER_TABLE, egg: EGG_STAGE },
  light: { table: MONSTER_TABLE_LIGHT, egg: EGG_STAGE_LIGHT },
  buddha: { table: BUDDHA_TABLE, egg: BUDDHA_EGG_STAGE },
};

// ─── getMonsterStage ──────────────────────────────────
// evolutionStage=0 → 卵、1+ → テーマの table[evolutionPath]
// themeId は @/lib/monsterThemes/index の MONSTER_THEMES のキー（"dark" / "light" / "buddha" 等）。
// 未指定・存在しない themeId は既定の dark にフォールバックする（後方互換）。
export function getMonsterStage(evolutionStage: number, evolutionPath: string, themeId?: string | null) {
  const entry = (themeId && THEME_ENTRIES[themeId]) || THEME_ENTRIES.dark;

  if (evolutionStage <= 0) return entry.egg;

  const stageIdx = Math.min(evolutionStage, EVOLUTION_THRESHOLDS.length - 1);
  const ptToEvolve = EVOLUTION_THRESHOLDS[stageIdx];
  const monster = entry.table[evolutionPath] ?? { image: "", name: "???" };

  return { ...monster, ptToEvolve };
}

/**
 * User.side（"DARK" | "LIGHT" | null、旧仕様）を getMonsterStage 用の themeId に変換する。
 * monsterSetId をまだ受け取っていない画面・API から呼ぶ暫定の互換ヘルパー。
 * 新規実装では side ではなく themeId（User.monsterSetId）を直接使うこと。
 */
export function themeIdFromSide(side?: string | null): string {
  return side === "LIGHT" ? "light" : "dark";
}

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
