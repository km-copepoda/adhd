// yokai テーマのモンスターテーブル。
// src/lib/monsters.ts の MONSTER_TABLE と同型・同キー（39体）。
// 画像は public/monsters/yokai/ 配下の実ファイル名と完全一致させること。
// （このファイルは .claude/skills/theme-set-import/scripts/gen-theme-ts.mjs で生成）

import type { MonsterEntry, MonsterStage } from "@/lib/monsterEntry";

export const EGG_STAGE: MonsterStage = {
  image: "/monsters/yokai/egg.webp",
  name: "ようかいのたまご", nameKana: "ようかいのたまご",
  ptToEvolve: 1,
  description: "薄暗い光を放つ、丸い石のようなたまご。夜になると「カラカラ…」と音がする。中から何が生まれるのかな？", descriptionKana: "うすぐらいひかりをはなつ、まるいいしのようなたまご。よるになると「からから…」とおとがする。なかからなにがうまれるのかな？",
};

export const MONSTER_TABLE: Record<string, MonsterEntry> = {
  // Stage 1: 3体
  "STUDY": { image: "/monsters/yokai/STUDY_人魂.webp", name: "ひとだま", nameKana: "ひとだま", description: "青白く光る小さな火の玉。好奇心が強く、ふわふわ飛び回っては人間を観察している。", descriptionKana: "あおじろくひかるちいさなひのたま。こうきしんがつよく、ふわふわとびまわってはにんげんをかんさつしている。" },
  "STAMINA": { image: "/monsters/yokai/STAMINA_小オニ.webp", name: "こおに", nameKana: "こおに", description: "角が一本だけ生えた元気な鬼の子。金棒の代わりに木の棒を振り回して遊んでいる。", descriptionKana: "つのがいっぽんだけはえたげんきなおにのこ。かなぼうのかわりにきのぼうをふりまわしてあそんでいる。" },
  "LIFE": { image: "/monsters/yokai/LIFE_座敷童.webp", name: "ざしきわらし", nameKana: "ざしきわらし", description: "赤い着物の子供の姿。住みついた家に幸福をもたらす。いたずら好きだけど憎めない。", descriptionKana: "あかいきもののこどものすがた。すみついたいえにこうふくをもたらす。いたずらずきだけどにくめない。" },

  // Stage 2: 9体
  "STUDY_STUDY": { image: "/monsters/yokai/STUDY_STUDY_鎌鼬.webp", name: "鎌鼬", nameKana: "かまいたち", description: "つむじ風に乗って現れ、鎌のような爪で一瞬で切りつける鋭い知恵と素早さを持つ。", descriptionKana: "つむじかぜにのってあらわれ、かまのようなつめでいっしゅんできりつけるするどいちえとすばやさをもつ。" },
  "STUDY_STAMINA": { image: "/monsters/yokai/STUDY_STAMINA_烏天狗.webp", name: "烏天狗", nameKana: "からすてんぐ", description: "鳥のクチバシを持つ天狗。剣術の達人で、山中で武芸者を鍛える知謀と武力を併せ持つ。", descriptionKana: "とりのくちばしをもつてんぐ。けんじゅつのたつじんで、さんちゅうでぶげいしゃをきたえるちぼうとぶりょくをあわせもつ。" },
  "STUDY_LIFE": { image: "/monsters/yokai/STUDY_LIFE_狐.webp", name: "狐", nameKana: "きつね", description: "化ける術に長けた賢い狐。人に化けて町に紛れ情報を集める。油揚げが大好物。", descriptionKana: "ばけるじゅつにたけたかしこいきつね。ひとにばけてまちにまぎれじょうほうをあつめる。あぶらあげがだいこうぶつ。" },
  "STAMINA_STUDY": { image: "/monsters/yokai/STAMINA_STUDY_鵺.webp", name: "鵺", nameKana: "ぬえ", description: "猿の顔、狸の体、虎の手足、蛇の尾。正体不明で知恵が深く、夜に不気味な声で鳴く。", descriptionKana: "さるのかお、たぬきのからだ、とらのてあし、へびのしっぽ。しょうたいふめいでちえがふかく、よるにぶきみなこえでなく。" },
  "STAMINA_STAMINA": { image: "/monsters/yokai/STAMINA_STAMINA_牛鬼.webp", name: "牛鬼", nameKana: "うしおに", description: "牛の頭に鬼の体。海辺や山中に棲む凶暴な妖怪だが、一度認めた相手には絶対の忠義を見せる。", descriptionKana: "うしのあたまにおにのからだ。うみべやさんちゅうにすむきょうぼうなようかいだが、いちどみとめたあいてにはぜったいのちゅうぎをみせる。" },
  "STAMINA_LIFE": { image: "/monsters/yokai/STAMINA_LIFE_なまはげ.webp", name: "なまはげ", nameKana: "なまはげ", description: "「泣ぐ子はいねがー！」と怒鳴り家を回る。怖い見た目だが、子供の怠けを正す愛情の化身。", descriptionKana: "「なぐこはいねがー！」とどなりいえをまわる。こわいみためだが、こどものなまけをただすあいじょうのけしん。" },
  "LIFE_STUDY": { image: "/monsters/yokai/LIFE_STUDY_雪女.webp", name: "雪女", nameKana: "ゆきおんな", description: "白い着物の美しい女性。吹雪の中に現れ、寒さから人を守る冷たい手は傷を癒す力も持つ。", descriptionKana: "しろいきもののうつくしいじょせい。ふぶきのなかにあらわれ、さむさからひとをまもるつめたいてはきずをいやすちからももつ。" },
  "LIFE_STAMINA": { image: "/monsters/yokai/LIFE_STAMINA_河童.webp", name: "河童", nameKana: "かっぱ", description: "頭の皿に水を蓄えた河の住人。相撲が得意で力は強いが、礼儀正しくお辞儀されると皿の水がこぼれる。", descriptionKana: "あたまのさらにみずをたくわえたかわのじゅうにん。すもうがとくいでちからはつよいが、れいぎただしくおじぎされるとさらのみずがこぼれる。" },
  "LIFE_LIFE": { image: "/monsters/yokai/LIFE_LIFE_猫又.webp", name: "猫又", nameKana: "ねこまた", description: "尻尾が二股に分かれた老猫。長年人と暮らした愛情が妖力に変わった。家と家族を静かに守る。", descriptionKana: "しっぽがふたまたにわかれたろうびょう。ながねんひとといっしょにくらしたあいじょうがようりょくにかわった。いえとかぞくをしずかにまもる。" },

  // Stage 3: 27体
  "STUDY_STUDY_STUDY": { image: "/monsters/yokai/STUDY_STUDY_STUDY_ぬらりひょん.webp", name: "ぬらりひょん", nameKana: "ぬらりひょん", description: "妖怪の総大将。知らぬ間に家に上がり込み茶を飲む。圧倒的な知恵と策略で全妖怪を束ねる頂点。", descriptionKana: "ようかいのそうだいしょう。しらぬまにいえにあがりこみちゃをのむ。あっとうてきなちえとさくりゃくでぜんようかいをたばねるちょうてん。" },
  "STUDY_STUDY_STAMINA": { image: "/monsters/yokai/STUDY_STUDY_STAMINA_大天狗.webp", name: "大天狗", nameKana: "おおてんぐ", description: "赤い顔に長い鼻、巨大な翼。山の支配者にして武芸の神。源義経に剣術と兵法を教えた凄腕。", descriptionKana: "あかいかおにながいはな、きょだいなつばさ。やまのしはいしゃにしてぶげいのかみ。みなもとのよしつねにけんじゅつとへいほうをおしえたすごうで。" },
  "STUDY_STUDY_LIFE": { image: "/monsters/yokai/STUDY_STUDY_LIFE_青行燈.webp", name: "青行燈", nameKana: "あおあんどん", description: "百物語の最後に現れる妖怪。百の怪談の知識を全て持ち、物語の力で現実を操る怪異の語り部。", descriptionKana: "ひゃくものがたりのさいごにあらわれるようかい。ひゃくのかいだんのちしきをすべてもち、ものがたりのちからでげんじつをあやつるかいいのかたりべ。" },
  "STUDY_STAMINA_STUDY": { image: "/monsters/yokai/STUDY_STAMINA_STUDY_絡新婦.webp", name: "絡新婦", nameKana: "じょろうぐも", description: "美女に化ける蜘蛛の妖怪。糸で巧みな罠を張り、知恵と素早さで獲物を捕らえる策略の天才。", descriptionKana: "びじょにばけるくものようかい。いとでたくみなわなをはり、ちえとすばやさでえものをとらえるさくりゃくのてんさい。" },
  "STUDY_STAMINA_STAMINA": { image: "/monsters/yokai/STUDY_STAMINA_STAMINA_大百足.webp", name: "大百足", nameKana: "おおむかで", description: "三上山を七巻半する巨大ムカデ。硬い体と無数の脚で攻守万能。俵藤太の伝説で有名な武闘派。", descriptionKana: "みかみやまをななまきはんするきょだいなむかで。かたいからだとむすうのあしでこうしゅばんのう。たわらのとうたのでんせつでゆうめいなぶとうは。" },
  "STUDY_STAMINA_LIFE": { image: "/monsters/yokai/STUDY_STAMINA_LIFE_山姥.webp", name: "山姥", nameKana: "やまうば", description: "山奥に棲む老婆。恐ろしい姿だが迷い込んだ子供を育て、薬草の知識を授ける山の慈母。", descriptionKana: "やまおくにすむろうば。おそろしいすがただがまよいこんだこどもをそだて、やくそうのちしきをさずけるやまのじぼ。" },
  "STUDY_LIFE_STUDY": { image: "/monsters/yokai/STUDY_LIFE_STUDY_アマビエ.webp", name: "アマビエ", nameKana: "あまびえ", description: "三本足の人魚の姿。疫病の到来を予言し「自分の姿を描いて広めよ」と人々に救済の絵を残した。", descriptionKana: "さんぼんあしのにんぎょのすがた。えきびょうのとうらいをよげんし「じぶんのすがたをえがいてひろめよ」とひとびとにきゅうさいのえをのこした。" },
  "STUDY_LIFE_STAMINA": { image: "/monsters/yokai/STUDY_LIFE_STAMINA_一反木綿.webp", name: "一反木綿", nameKana: "いったんもめん", description: "空飛ぶ白い布。気まぐれだが、味方と認めた者を背に乗せて空を飛ぶ頼もしい空の相棒。", descriptionKana: "そらとぶしろいぬの。きまぐれだが、みかたとみとめたものをせにのせてそらをとぶたのもしいそらのあいぼう。" },
  "STUDY_LIFE_LIFE": { image: "/monsters/yokai/STUDY_LIFE_LIFE_玉藻前.webp", name: "玉藻前", nameKana: "たまものまえ", description: "絶世の美女にして九尾の狐の化身。圧倒的な妖術と美しさで国を揺るがした伝説の妖狐。", descriptionKana: "ぜっせいのびじょにしてきゅうびのきつねのけしん。あっとうてきなようじゅつとうつくしさでくにをゆるがしたでんせつのようこ。" },
  "STAMINA_STUDY_STUDY": { image: "/monsters/yokai/STAMINA_STUDY_STUDY_土蜘蛛.webp", name: "土蜘蛛", nameKana: "つちぐも", description: "地中に巨大な巣を張る古代の巨大蜘蛛。武術と知略で源頼光ら豪傑と渡り合った魔神。", descriptionKana: "ちちゅうにきょだいなすをはるこだいのきょだいぐも。ぶじゅつとちりゃくでみなもとのらいこうらごうけつとわたりあったまじん。" },
  "STAMINA_STUDY_STAMINA": { image: "/monsters/yokai/STAMINA_STUDY_STAMINA_酒呑童子.webp", name: "酒呑童子", nameKana: "しゅてんどうじ", description: "大江山に棲む鬼の大将。圧倒的な怪力と将器を持ち、屈強な鬼の軍団を率いた日本三大妖怪。", descriptionKana: "おおえやまにすむおにのたいしょう。あっとうてきなかいりきとしょうきをもち、くっきょうなおにのぐんだんをひきいたにほんさんだいようかい。" },
  "STAMINA_STUDY_LIFE": { image: "/monsters/yokai/STAMINA_STUDY_LIFE_火車.webp", name: "火車", nameKana: "かしゃ", description: "燃える車輪で空を駆ける猫の妖怪。悪人の魂を引き取り裁く、恐怖と厳格な正義の使者。", descriptionKana: "もえるしゃりんでそらをかけるねこのようかい。あくにんのたましいをひきとりさばく、きょうふとげんかくなせいぎのししゃ。" },
  "STAMINA_STAMINA_STUDY": { image: "/monsters/yokai/STAMINA_STAMINA_STUDY_大嶽丸.webp", name: "大嶽丸", nameKana: "おおたけまる", description: "鈴鹿山の鬼神。日本三大妖怪の一。雷と暴風を操る圧倒的な威風で死闘を繰り広げた。", descriptionKana: "すずかやまのきじん。にほんさんだいようかいのひとつ。かみなりとぼうふうをあやつるあっとうてきないふうでしとうをくりひろげた。" },
  "STAMINA_STAMINA_STAMINA": { image: "/monsters/yokai/STAMINA_STAMINA_STAMINA_ダイダラボッチ.webp", name: "ダイダラボッチ", nameKana: "だいだらぼっち", description: "山を持ち上げ湖を作った超巨大妖怪。富士山を一晩で作ったとも言われる力の極致。", descriptionKana: "やまをもちあげみずうみをつくったちょうきょだいようかい。ふじさんをひとばんでつくったともいわれるちからのきょくち。" },
  "STAMINA_STAMINA_LIFE": { image: "/monsters/yokai/STAMINA_STAMINA_LIFE_塗壁.webp", name: "塗壁", nameKana: "ぬりかべ", description: "夜道に突然現れる巨大な壁。絶対に壊れない圧倒的な耐久力で立ち塞がり、仲間を守る。", descriptionKana: "よみちにとつぜんあらわれるきょだいなかべ。ぜったいにこわれないあっとうてきなたいきゅうりょくでたちふさがり、なかまをまもる。" },
  "STAMINA_LIFE_STUDY": { image: "/monsters/yokai/STAMINA_LIFE_STUDY_海坊主.webp", name: "海坊主", nameKana: "うみぼうず", description: "海面から現れる巨大な黒い影。船を沈める荒々しさを持つが、礼を尽くす船乗りには豊漁を授ける。", descriptionKana: "かいめんからあらわれるきょだいなくろいかげ。ふねをしずめるあらあらしさをもつが、れいをつくすふなのりにはほうりょうをさずける。" },
  "STAMINA_LIFE_STAMINA": { image: "/monsters/yokai/STAMINA_LIFE_STAMINA_茨木童子.webp", name: "茨木童子", nameKana: "いばらきどうじ", description: "酒呑童子の右腕。豪快な腕力を持ち、切られた腕を取り返しに来るほどの強靭な意志と義理を持つ。", descriptionKana: "しゅてんどうじのみぎうで。ごうかいなわんりょくをもち、きられたうでをとりかえしにくるほどのきょうじんないしとぎりをもつ。" },
  "STAMINA_LIFE_LIFE": { image: "/monsters/yokai/STAMINA_LIFE_LIFE_犬神.webp", name: "犬神", nameKana: "いぬがみ", description: "強大な霊力と忠誠心を持つ犬の怪異。本来は恐ろしい憑き物とされるが、心を許した主や里に対しては仇なす者を排除し、守護神として立ち塞がる。", descriptionKana: "きょうだいなれいりょくとちゅうせいしんをもついぬのかいい。ほんらいはおそろしいつきものとされるが、こころをゆるしたあるじやさとにたいしてはあだなすものをはいじょし、しゅごしんとしてたちふさがる。" },
  "LIFE_STUDY_STUDY": { image: "/monsters/yokai/LIFE_STUDY_STUDY_コックリさん.webp", name: "コックリさん", nameKana: "こっくりさん", description: "狐・狗・狸の三霊が合わさった知恵の霊。親しみやすくも的確に質問に答え、真実を見抜く。", descriptionKana: "きつね・いぬ・たぬきのさんれいがあわさったちえのれい。したしみやすくもてきかくにしつもんにこたえ、しんじつをみぬく。" },
  "LIFE_STUDY_STAMINA": { image: "/monsters/yokai/LIFE_STUDY_STAMINA_件.webp", name: "件", nameKana: "くだん", description: "人面牛身の予言獣。生まれながらに真実の予言を告げ、人々に災厄を避ける知恵を与える。", descriptionKana: "じんめんぎゅうしんのよげんじゅう。うまれながらにしんじつのよげんをつげ、ひとびとにさいやくをさけるちえをあたえる。" },
  "LIFE_STUDY_LIFE": { image: "/monsters/yokai/LIFE_STUDY_LIFE_子育て幽霊.webp", name: "子育て幽霊", nameKana: "こそだてゆうれい", description: "死してなお墓の中で赤子を育てる母の霊。毎夜飴を買い与え続けた、究極の親愛の化身。", descriptionKana: "ししてなおはかのなかであかごをそだてるははのれい。まいよあめをかいあたえつづけた、きゅうきょくのしんあいのけしん。" },
  "LIFE_STAMINA_STUDY": { image: "/monsters/yokai/LIFE_STAMINA_STUDY_小豆洗い.webp", name: "小豆洗い", nameKana: "あずきあらい", description: "川辺で小豆を洗う音が聞こえる妖怪。几帳面で丁寧な仕事ぶり。地味だが確実にやり遂げる職人気質。", descriptionKana: "かわべであずきをあらうおとがきこえるようかい。きちょうめんでていねいなしごとぶり。じみだがかくじつにやりとげるしょくにんかたぎ。" },
  "LIFE_STAMINA_STAMINA": { image: "/monsters/yokai/LIFE_STAMINA_STAMINA_船幽霊.webp", name: "船幽霊", nameKana: "ふなゆうれい", description: "海上で「柄杓をくれ」と叫ぶ霊。底の抜けた柄杓を渡せば大人しく引き下がる、海の掟を試す門番。", descriptionKana: "かいじょうで「ひしゃくをくれ」とさけぶれい。そこのぬけたひしゃくをわたせばおとなしくひきさがる、うみのおきてをためすもんばん。" },
  "LIFE_STAMINA_LIFE": { image: "/monsters/yokai/LIFE_STAMINA_LIFE_産女.webp", name: "産女", nameKana: "うぶめ", description: "赤子を抱いた女の霊。通りすがりの親切な人に赤子を託し、無償の怪力を授けて命をつなぐ。", descriptionKana: "あかごをだいたおんなのれい。とおりすがりのしんせつなひとにあかごをたくし、むしょうのかいりきをさずけていのちをつなぐ。" },
  "LIFE_LIFE_STUDY": { image: "/monsters/yokai/LIFE_LIFE_STUDY_砂かけ婆.webp", name: "砂かけ婆", nameKana: "すなかけばばあ", description: "陰から砂をかけてくる老婆。いたずら好きだが、砂を使って仲間を隠し敵から守る人情派。", descriptionKana: "かげからすなをかけてくるろうば。いたずらずきだが、すなをつかってなかまをかくしててきからまもるにんじょうは。" },
  "LIFE_LIFE_STAMINA": { image: "/monsters/yokai/LIFE_LIFE_STAMINA_子泣き爺.webp", name: "子泣き爺", nameKana: "こなきじじい", description: "赤ん坊の泣き声で人を寄せる老人。抱き上げると石のように重くなるが、寂しがり屋で人間が好き。", descriptionKana: "あかんぼうのなきごえでひとをよせるろうじん。だきあげるといしのようにおもくなるが、さみしがりやでにんげんがすき。" },
  "LIFE_LIFE_LIFE": { image: "/monsters/yokai/LIFE_LIFE_LIFE_九尾の狐.webp", name: "九尾の狐", nameKana: "きゅうびのきつね", description: "九本の尾を持つ最強の霊獣。千年の時を経て深まった愛と慈悲で、人間と妖怪を優しく見守る。", descriptionKana: "きゅうほんのおをもつさいきょうのれいじゅう。せんねんのときをへてふかまったあいとじひで、にんげんとようかいをやさしくみまもる。" },
};
