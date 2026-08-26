// buddha テーマ（仏様シリーズ）のモンスターテーブル。
// src/lib/monsters.ts の MONSTER_TABLE と同型・同キー（39体）。
// 画像は public/monsters/buddha/ 配下の実ファイル名と完全一致させること。

export const EGG_STAGE = {
  image: "/monsters/buddha/egg-stone.webp",
  name: "たまご",
  ptToEvolve: 1,
  description: "ほのかに金色の光をまとった、とくべつなたまご。中から何が生まれるのかな？",
};

export const MONSTER_TABLE: Record<string, { image: string; name: string; description: string }> = {
  // Stage 1: 3体
  "STUDY":   { image: "/monsters/buddha/STUDY_もんじゅまる.webp",   name: "文殊丸",   description: "小さな巻物を大事そうに抱えた、まんまるな見習い童子。「なるほどなるほど」と頷きながら、知恵の種を集めている。" },
  "STAMINA": { image: "/monsters/buddha/STAMINA_こんごうまる.webp", name: "金剛丸",   description: "小さな金剛杵を握りしめた、がっしり体型の童子。まだ力は弱いが、踏ん張る姿にはすでに頼もしさがにじむ。" },
  "LIFE":    { image: "/monsters/buddha/LIFE_じぞうまる.webp",      name: "地蔵丸",   description: "赤い前掛けをつけた、にこにこ顔の童子。道端で困っている人を見つけると、そっと手を差し伸べる優しい性格。" },

  // Stage 2: 9体
  "STUDY_STUDY":     { image: "/monsters/buddha/STUDY_STUDY_こくうぞう.webp",     name: "虚空蔵",     description: "文殊丸が知恵を深め、無限に広がる空のような智慧を宿した姿。頭上に輝く宝珠が、あらゆる知識を映し出す。" },
  "STUDY_STAMINA":   { image: "/monsters/buddha/STUDY_STAMINA_いだてん.webp",     name: "韋駄天",     description: "俊足の守護者。学びに体力が加わり、風のように駆け抜けながら大切なものを守り抜く力を得た。" },
  "STUDY_LIFE":      { image: "/monsters/buddha/STUDY_LIFE_やくし.webp",          name: "薬師",       description: "文殊丸の知恵が人を癒す力に変わった姿。小さな薬壺を手に、疲れた人にそっと元気を分け与える。" },
  "STAMINA_STUDY":   { image: "/monsters/buddha/STAMINA_STUDY_びしゃもん.webp",   name: "毘沙門",     description: "金剛丸が知恵をまとい、鎧を身につけた勇ましい姿。戦略を練りながら、正しいことのために立ち向かう。" },
  "STAMINA_STAMINA": { image: "/monsters/buddha/STAMINA_STAMINA_におう.webp",     name: "仁王",       description: "金剛丸がさらに力を鍛え、山門を守るがっしりとした姿に。ひとたび睨みをきかせると、悪いものは近寄れない。" },
  "STAMINA_LIFE":    { image: "/monsters/buddha/STAMINA_LIFE_ふげん.webp",        name: "普賢",       description: "力を人助けに使うことを覚えた金剛丸の姿。白い象のような優しい足取りで、困っている仲間の元へ向かう。" },
  "LIFE_STUDY":      { image: "/monsters/buddha/LIFE_STUDY_ほてい.webp",          name: "布袋",       description: "地蔵丸が知恵をつけ、大きな袋を担いだ姿に。袋の中にはいつも誰かを笑顔にするための知恵と工夫が詰まっている。" },
  "LIFE_STAMINA":    { image: "/monsters/buddha/LIFE_STAMINA_こまいぬ.webp",      name: "狛犬",       description: "地蔵丸が体力をつけ、参道を守る頼もしい姿に進化。日々の暮らしを、じっと静かに見守り続けている。" },
  "LIFE_LIFE":       { image: "/monsters/buddha/LIFE_LIFE_かんのん.webp",         name: "観音",       description: "地蔵丸の優しさがさらに深まり、慈しみに満ちた姿に。困っている声に、誰よりも早く気づいてくれる。" },

  // Stage 3: 27体
  "STUDY_STUDY_STUDY":     { image: "/monsters/buddha/STUDY_STUDY_STUDY_だいにちにょらい.webp",     name: "大日如来",     description: "あらゆる知恵の光を一身に宿した、太陽のように輝く最高位の姿。静かな眼差しが、すべてを見通している。" },
  "STUDY_STUDY_STAMINA":   { image: "/monsters/buddha/STUDY_STUDY_STAMINA_あいぜんみょうおう.webp", name: "愛染明王",     description: "知恵と情熱を燃え上がる炎のように束ねた姿。真っ赤な体で、諦めない心の強さを教えてくれる。" },
  "STUDY_STUDY_LIFE":      { image: "/monsters/buddha/STUDY_STUDY_LIFE_こくうぞうぼさつ.webp",      name: "虚空蔵菩薩",   description: "虚空蔵の智慧が人々を包み込むほど大きく育った姿。星空のような宝珠から、尽きることのない知恵を授ける。" },
  "STUDY_STAMINA_STUDY":   { image: "/monsters/buddha/STUDY_STAMINA_STUDY_たいしゃくてん.webp",     name: "帝釈天",       description: "俊足と知略を極め、雷を操る守護神へと至った姿。困難な戦いほど、冷静に活路を見出す。" },
  "STUDY_STAMINA_STAMINA": { image: "/monsters/buddha/STUDY_STAMINA_STAMINA_ざおうごんげん.webp",   name: "蔵王権現",     description: "韋駄天の俊敏さが荒々しい力強さと合わさった姿。片足立ちのまま、山をも動かす気迫を放つ。" },
  "STUDY_STAMINA_LIFE":    { image: "/monsters/buddha/STUDY_STAMINA_LIFE_きちじょうてん.webp",      name: "吉祥天",       description: "俊足の知恵が幸運を呼び込む力へと結実した姿。舞い降りるだけで、周りにささやかな幸せが広がる。" },
  "STUDY_LIFE_STUDY":      { image: "/monsters/buddha/STUDY_LIFE_STUDY_もんじゅぼさつ.webp",        name: "文殊菩薩",     description: "文殊丸の知恵が師と呼べるほど極まった姿。獅子にまたがり、迷える者に的確な導きを与える。" },
  "STUDY_LIFE_STAMINA":    { image: "/monsters/buddha/STUDY_LIFE_STAMINA_まりしてん.webp",          name: "摩利支天",     description: "癒しの知恵に俊敏さが宿った、陽炎のように素早い守護者。姿を見せぬまま、そっと危険から遠ざけてくれる。" },
  "STUDY_LIFE_LIFE":       { image: "/monsters/buddha/STUDY_LIFE_LIFE_やくしにょらい.webp",         name: "薬師如来",     description: "薬師の癒しの力が極まり、あらゆる悩みを癒す姿へ。手にした薬壺の光は、心の痛みにもそっと寄り添う。" },
  "STAMINA_STUDY_STUDY":   { image: "/monsters/buddha/STAMINA_STUDY_STUDY_だいいとくみょうおう.webp", name: "大威徳明王",   description: "毘沙門の知略が極まり、水牛にまたがる威厳ある姿へ。六つの顔ですべての方角に目を配る。" },
  "STAMINA_STUDY_STAMINA": { image: "/monsters/buddha/STAMINA_STUDY_STAMINA_あしゅら.webp",         name: "阿修羅",       description: "戦う知恵と力を極限まで高めた、三面六臂の姿。荒々しさの奥に、譲れない信念を秘めている。" },
  "STAMINA_STUDY_LIFE":    { image: "/monsters/buddha/STAMINA_STUDY_LIFE_じこくてん.webp",          name: "持国天",       description: "毘沙門の知略が人々の暮らしを守る力に変わった姿。東の方角に立ち、静かに国と家族を見守る。" },
  "STAMINA_STAMINA_STUDY": { image: "/monsters/buddha/STAMINA_STAMINA_STUDY_こうもくてん.webp",     name: "広目天",       description: "仁王の力に鋭い眼力が加わった姿。筆を手に、見逃さぬよう世界の隅々まで見渡している。" },
  "STAMINA_STAMINA_STAMINA": { image: "/monsters/buddha/STAMINA_STAMINA_STAMINA_しゅうこんごうじん.webp", name: "執金剛神", description: "仁王の力を極限まで鍛え上げた、金剛杵を掲げる最強の守護者。その一撃であらゆる迷いを打ち払う。" },
  "STAMINA_STAMINA_LIFE":  { image: "/monsters/buddha/STAMINA_STAMINA_LIFE_ぞうちょうてん.webp",    name: "増長天",       description: "仁王の力が人を育む優しさへと結実した姿。南の方角から、成長する者たちをまっすぐ後押しする。" },
  "STAMINA_LIFE_STUDY":    { image: "/monsters/buddha/STAMINA_LIFE_STUDY_ふげんぼさつ.webp",        name: "普賢菩薩",     description: "普賢の優しさに知恵が加わり、白象に乗る菩薩へと至った姿。行いの一つひとつを、じっくり見守っている。" },
  "STAMINA_LIFE_STAMINA":  { image: "/monsters/buddha/STAMINA_LIFE_STAMINA_ふどうみょうおう.webp",  name: "不動明王",     description: "普賢の優しさに揺るがない意志が宿った姿。燃え盛る炎を背に、なにがあっても動じない強さを見せる。" },
  "STAMINA_LIFE_LIFE":     { image: "/monsters/buddha/STAMINA_LIFE_LIFE_ばとうかんのん.webp",       name: "馬頭観音",     description: "普賢の優しさが極まり、馬のような力強さを宿した観音の姿。誰よりも早く駆けつけ、そっと支えてくれる。" },
  "LIFE_STUDY_STUDY":      { image: "/monsters/buddha/LIFE_STUDY_STUDY_べんざいてん.webp",          name: "弁財天",       description: "布袋の知恵が芸事や才能を開花させる力へと変わった姿。琵琶の音色で、みんなの心を豊かにする。" },
  "LIFE_STUDY_STAMINA":    { image: "/monsters/buddha/LIFE_STUDY_STAMINA_えんまだいおう.webp",      name: "閻魔大王",     description: "布袋の知恵が、正しさをきちんと見極める力へと至った姿。優しさの奥に、揺るがない公正さを秘めている。" },
  "LIFE_STUDY_LIFE":       { image: "/monsters/buddha/LIFE_STUDY_LIFE_みろくぼさつ.webp",           name: "弥勒菩薩",     description: "布袋の優しさと知恵が極まり、遠い未来まで思いをはせる菩薩の姿へ。静かな微笑みに安心感が宿る。" },
  "LIFE_STAMINA_STUDY":    { image: "/monsters/buddha/LIFE_STAMINA_STUDY_だいこくてん.webp",        name: "大黒天",       description: "狛犬の頼もしさに知恵が加わり、大きな袋と打ち出の小槌を持つ姿へ。みんなの暮らしを豊かにしようと働く。" },
  "LIFE_STAMINA_STAMINA":  { image: "/monsters/buddha/LIFE_STAMINA_STAMINA_こんがらどうじ.webp",    name: "矜羯羅童子",   description: "狛犬の頼もしさがさらに鍛えられ、力強い護法童子の姿へ。任されたことは最後までやり通す責任感の持ち主。" },
  "LIFE_STAMINA_LIFE":     { image: "/monsters/buddha/LIFE_STAMINA_LIFE_じゅういちめんかんのん.webp", name: "十一面観音", description: "狛犬の見守る力が極まり、あらゆる方角に顔を向ける観音の姿へ。誰の悲しみも見逃さない。" },
  "LIFE_LIFE_STUDY":       { image: "/monsters/buddha/LIFE_LIFE_STUDY_じぞうぼさつ.webp",           name: "地蔵菩薩",     description: "観音の慈しみに知恵が加わり、旅人や子供たちを見守る菩薩の姿へ。道の途中で、そっと寄り添ってくれる。" },
  "LIFE_LIFE_STAMINA":     { image: "/monsters/buddha/LIFE_LIFE_STAMINA_えびすさま.webp",           name: "えびす様",     description: "観音の慈しみが、福を招く朗らかな力へと変わった姿。大きな鯛を抱え、いつもにこにこ笑っている。" },
  "LIFE_LIFE_LIFE":        { image: "/monsters/buddha/LIFE_LIFE_LIFE_せんじゅかんのん.webp",        name: "千手観音",     description: "観音の慈しみを極めた究極の姿。千本の手のすべてで、困っている人にそっと手を差し伸べ続ける。" },
};
