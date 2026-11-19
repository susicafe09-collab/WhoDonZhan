export interface KnowledgeItem {
  id: string;
  name: string;
  scientificName: string;
  category: 'animal' | 'landscape' | 'leaves';
  tag: string;
  image: string;
  bannerImage?: string;
  description: string; // 整合特徵與習性後的完整流暢簡介
  funFact: string;
}

export interface MuzhaPlantDetail {
  imageSrc: string;
  name: string;
  scientificName: string;
  category: 'bottom' | 'side';
  categoryLabel: string; // '地板植物' | '側邊植物'
  muzhaSpot: string; // 貓空代表景點/微棲地
  muzhaRelation: string; // 與木柵貓空地區相關的生態與文化關係
  description: string; // 植物型態與生態功能
  funFact: string; // 趣味知識
  tags?: string[]; // 生態關鍵標籤
}

/**
 * 精簡景點介紹（1至2句，保留最有辨識度的特殊地形、自然景觀與主要看點）
 */
export const CONCISE_PLANT_DESCRIPTIONS: Record<string, string> = {
  '/leaves_ground_4.png':
    '生長於老泉里背風坡地，疏鬆富含腐植質的土壤孕育出肉質細嫩如梨的綠竹筍，為木柵最具代表性的名產。',
  '/leaves.png':
    '樟樹步道沿線遺存的百年老樟樹群，高聳樹冠宛如天然綠傘，為坡地茶園提供柔和漫射日光與清芬香氣。',
  '/leaves_ground_6.png':
    '高懸於指南山老樹樹幹上的大型著生蕨，如翡翠皇冠般盛接雨水與落葉，展現高濕度茶山獨特的林相景觀。',
  '/leaves_ground_1.png':
    '常年生長於銀河洞瀑布水氣瀰漫的峭壁岩縫間，青翠革質葉片是貓空溪谷純淨泉水與高濕度的自然指標。',
  '/leaves_ground_5.png':
    '攀附於壺穴步道岩壁與茶園石籬間，垂懸形成宛若綠色水簾的步道景致，深秋結出的漿果更是山林鳥獸的覓食焦點。',
  '/leaves_ground_3.png':
    '茂密生長於待老坑山稜線，緻密的竹林根系牢固抓附邊坡土石，長年守護挑茶古道的安全行走步徑。',
  '/leaves_ground_2.png':
    '生長於梯田茶園石坎邊坡，如鳥羽般叢生的翠綠葉片緊扣泥土防止崩塌，維持茶樹土壤恆溫濕潤。',
};

/**
 * 木柵貓空地區植物資料庫（共 7 款項目，精確對應展場畫面上隨機抽換之植物）
 * 涵蓋木柵鐵觀音茶園微氣候、樟樹步道、銀河洞瀑布、老泉里綠竹筍與壺穴林緣的真實生態連結
 */
export const MUZHA_PLANTS_DATA: Record<string, MuzhaPlantDetail> = {
  '/leaves_ground_4.png': {
    imageSrc: '/leaves_ground_4.png',
    name: '木柵特產・破土綠竹筍',
    scientificName: 'Bambusa oldhamii (Shoots)',
    category: 'bottom',
    categoryLabel: '地板植被・木柵名產',
    muzhaSpot: '老泉里・指南茶山坡地',
    tags: ['🎋 木柵三寶', '💧 坡地固水', '🌱 雨後破土'],
    muzhaRelation:
      '木柵老泉里向陽背風、土壤鬆軟富含腐植質，造就綠竹筍清甜如梨。初夏採筍與焙製鐵觀音交相輝映，是貓空茶山農耕共生的名產瑰寶。',
    description:
      '多年生常綠竹類地下嫩芽，雨後強力破土。筍籜緊密包裹，基部根系具強大抓土固水功能，守護坡地表土不被梅雨沖刷。',
    funFact:
      '茶農須在清晨破曉前「摸黑掘筍」，筍尖一旦探出照光出青便會轉苦，採筍全憑指尖摸尋！',
  },
  '/leaves_ground_3.png': {
    imageSrc: '/leaves_ground_3.png',
    name: '貓空步道・高山箭竹',
    scientificName: 'Yushania niitakayamensis',
    category: 'bottom',
    categoryLabel: '地板植被・水土護坡',
    muzhaSpot: '樟湖步道・待老坑山稜線',
    tags: ['🛡️ 護坡防線', '🌫️ 凝結晨霧', '🌿 百年古道'],
    muzhaRelation:
      '茂密生長於待老坑山脊梁，密生之竹根如立體鋼筋網牢抓邊坡。季風吹拂時為茶園聚攏水氣凝結山嵐，是挑茶古道百年不塌的護坡功臣。',
    description:
      '禾本科多年生地下走莖植物，竹稈極富韌性。緻密根系交織於地表下，是台灣山坡地防崩塌與林鳥避難的關鍵防線。',
    funFact:
      '地下竹鞭蔓延極深且韌性驚人，昔日挑茶人行走陡坡，全靠箭竹根緊繫砂石維繫安全步道。',
  },
  '/leaves_ground_1.png': {
    imageSrc: '/leaves_ground_1.png',
    name: '銀河洞溪谷・闊葉水龍骨',
    scientificName: 'Polypodiodes amoena',
    category: 'bottom',
    categoryLabel: '地板植被・潮濕溪谷',
    muzhaSpot: '銀河洞瀑布・指南溪上游岩壁',
    tags: ['💧 濕度指標', '🏞️ 懸崖著生', '🌿 翠綠革質'],
    muzhaRelation:
      '常年繁生於銀河洞瀑布水氣瀰漫的峭壁與林下石壁。貓空年降雨充沛且濕度高達 85%，青翠的水龍骨群正是茶山純淨泉水與天然濕度的環境指標。',
    description:
      '水龍骨科常綠著生蕨類，肉質根莖被覆金褐鱗片。羽狀深裂葉片青翠革質，葉背具兩列飽滿的金黃圓形孢子囊群。',
    funFact:
      '肉質根狀莖覆滿鱗片宛如青龍盤旋石壁因而得名，組織蓄水力極佳，能抵擋山區短暫乾旱。',
  },
  '/leaves_ground_2.png': {
    imageSrc: '/leaves_ground_2.png',
    name: '茶山地被・叢生腎蕨',
    scientificName: 'Nephrolepis cordifolia',
    category: 'bottom',
    categoryLabel: '地板植被・茶園坡坎',
    muzhaSpot: '樟樹步道・梯田茶園坡坎',
    tags: ['🍵 茶園護土', '🌰 蓄水鳳凰蛋', '🌿 恆溫保濕'],
    muzhaRelation:
      '貓空梯田石坎邊最常見的友善地被。茶農在整地時特意保留腎蕨叢生，利用發達根系緊抓泥土防止崩塌，維持茶樹土壤恆溫保濕。',
    description:
      '多年生常綠蕨類，一回羽狀複葉如鳥羽般叢生開展。地下匍匐莖結出圓球形多汁肉質塊莖，極具耐旱性。',
    funFact:
      '地下多汁小球莖被民間俗稱為「鳳凰蛋」或「水球」，以前採茶婦人與巡山人口渴時，常挖取洗淨咬破解渴！',
  },
  '/leaves.png': {
    imageSrc: '/leaves.png',
    name: '樟樹步道・樟楠樹冠',
    scientificName: 'Cinnamomum camphora',
    category: 'side',
    categoryLabel: '側邊植物・樹冠林蔭',
    muzhaSpot: '樟樹步道・百年老樟樹群',
    tags: ['☀️ 柔和漫射', '🍃 天然芬多精', '🌿 驅蟲清芬'],
    muzhaRelation:
      '貓空「樟湖」之地名由來。清代曾為樟腦提煉重鎮，如今巨大的綠傘樹冠為林下怕強光的鐵觀音茶樹遮擋烈日，提供溫和的漫射光與天然驅蟲香氣。',
    description:
      '樟科大型常綠喬木，葉具明顯三出脈。搓揉新鮮葉片即散發清芬提神的天然芳樟醇，清淨山林空氣。',
    funFact:
      '清晨微風吹拂樟楠樹冠釋放豐富天然樟醇與芬多精，昔日茶農深信能驅瘴醒腦，是古道最天然的防護罩。',
  },
  '/leaves_ground_5.png': {
    imageSrc: '/leaves_ground_5.png',
    name: '貓空野徑・垂懸藤葉',
    scientificName: 'Ampelocissus cantoniensis',
    category: 'side',
    categoryLabel: '側邊植物・林緣攀緣',
    muzhaSpot: '壺穴步道・溪畔次生林緣',
    tags: ['🍇 獼猴珍饈', '🌿 垂掛綠簾', '💧 朝露滋養'],
    muzhaRelation:
      '攀附於壺穴步道岩壁與茶園石籬間，垂懸形成如瀑布般的綠色水簾。深秋結出的深紫漿果，是貓空山林台灣獼猴與藍腹鷴最愛的野性珍饈。',
    description:
      '木質落葉攀援藤本，以枝梢卷鬚攀附向上蔓生。葉片心狀卵形，垂掛步道兩側形成立體林緣景致。',
    funFact:
      '木質藤莖導水能力極強，昔日老獵人與巡山人在深山缺水時，斜切新鮮藤莖便能汲取清涼天然野藤水！',
  },
  '/leaves_ground_6.png': {
    imageSrc: '/leaves_ground_6.png',
    name: '百年老樹・垂懸崖薑蕨',
    scientificName: 'Aglaomorpha coronans',
    category: 'side',
    categoryLabel: '側邊植物・空中皇冠',
    muzhaSpot: '指南宮後山・巨木相思林',
    tags: ['👑 空中客棧', '🌧️ 聚寶盛雨', '🌿 雲霧著生'],
    muzhaRelation:
      '附生於指南山老樹樹幹上的大型著生蕨類，宛如翡翠皇冠高懸林間。基部腐植葉如聚寶盆盛接雨水與落葉，在半空中形成提供小生物棲息的空中綠洲。',
    description:
      '水龍骨科大型附生蕨，根莖粗厚肉質橫生。基部腐植質葉如鳥巢般盛接落葉，上部羽狀葉長達一公尺，優雅垂墜。',
    funFact:
      '崖薑蕨是山林中的「空中客棧」，底部堆積的腐植土層常吸引樹蛙、攀蜥與昆蟲在半空中築巢微型生態圈！',
  },
};

/**
 * 展場專屬知識資料字典 (5 種台灣特有種動物 + 3 種台灣風景手勢 + 葉片撥開狀態)
 */
export const KNOWLEDGE_DICTIONARY: Record<string, KnowledgeItem> = {
  // ──────────────────────────── 撥開綠葉互動狀態（木柵貓空三種植物誌） ────────────────────────────
  leaf_parted: {
    id: 'leaf_parted',
    name: '木柵貓空・茶山植物生態誌',
    scientificName: 'Muzha Maokong Mountain Flora (3 Keystone Plants)',
    category: 'leaves',
    tag: '互動體驗・一次三種貓空植被',
    image: '/leaves.png',
    bannerImage: '/leaves.png',
    description:
      '當您揮動雙手撥開眼前的綠葉，眼前呈現的是木柵貓空地區最具代表性的「三種植物共生組合（地板一種 ＋ 側邊兩種）」。木柵貓空地處台北盆地南緣茶山，背風面肥沃的腐植壤土孕育出聞名全台的木柵綠竹筍與地被腎蕨；兩側高聳的樟楠樹冠與附生崖薑蕨、野葡萄藤，則為林下享譽百年的「木柵鐵觀音茶樹」阻擋強光與強風，並凝聚濕潤山嵐雲霧，交織出茶山、竹林與溪谷共榮的永續生態風貌。',
    funFact:
      '木柵貓空昔日以「樟腦煉製、鐵觀音茶、綠竹筍」並稱山林風土三大台柱，如今走在樟樹步道與銀河洞溪谷，依然能隨處看見這三種守護茶山水土的代表植物！',
  },

  // ──────────────────────────── 5 種台灣特有種動物 ────────────────────────────
  macaca_cyclopis: {
    id: 'macaca_cyclopis',
    name: '台灣獼猴',
    scientificName: 'Macaca cyclopis',
    category: 'animal',
    tag: '哺乳類・台灣特有種',
    image: '/macaca_cyclopis_type_1.png',
    bannerImage: '/macaca_cyclopis_type_2.png',
    description:
      '台灣獼猴是台灣除人類外唯一的靈長類動物，廣泛棲息於低海拔闊葉林至 3,000 公尺高山針葉林中。外觀毛色為灰褐色至黃褐色，面部裸露呈粉紅或暗紅色，並擁有長達體長三分之二的靈巧尾巴。牠們具備極高的智商與群居社會結構，食性為雜食性，以嫩芽、野果及昆蟲為主，面頰內側更特化出能暫存食物的頰囊，展現適應島嶼山林的優異生存智慧。',
    funFact: '台灣獼猴面頰具有「頰囊」，採集食物時會先大口塞滿臉頰暫存，再帶到安全樹冠上慢慢咀嚼享用！',
  },

  diploderma_polygonatum_xanthostomum: {
    id: 'diploderma_polygonatum_xanthostomum',
    name: '黃口攀蜥',
    scientificName: 'Diploderma polygonatum xanthostomum',
    category: 'animal',
    tag: '爬蟲類・台灣特有亞種',
    image: '/diploderma_polygonatum_xanthostomum_type_1.png',
    bannerImage: '/diploderma_polygonatum_xanthostomum_type_2.png',
    description:
      '黃口攀蜥是台灣北部與東北部常見的日行性樹棲型蜥蜴，體色通常為深淺交錯的褐色或綠褐色保護色斑紋。其最顯著的生態特徵在於遇敵警戒時，會張大嘴巴露出鮮豔醒目的金黃色喉腔與口腔黏膜，並伏地進行類似「伏地挺身」的示威威嚇動作。主要以林間小型昆蟲、蜘蛛與螞蟻等節肢動物為食，是森林底層不可或缺的捕食者。',
    funFact: '當黃口攀蜥受到威脅時，會張大嘴巴露出鮮黃色喉腔並上下起伏身體，藉由高反差色彩與動作嚇退天敵！',
  },

  graphium_sarpedon_connectens: {
    id: 'graphium_sarpedon_connectens',
    name: '青帶鳳蝶',
    scientificName: 'Graphium sarpedon connectens',
    category: 'animal',
    tag: '昆蟲類・台灣特有亞種',
    image: '/graphium_sarpedon_connectens_type_1.png',
    bannerImage: '/graphium_sarpedon_connectens_type_2.png',
    description:
      '青帶鳳蝶以黑色翅膀中央貫穿一列半透明水藍色至青綠色亮麗斑帶而著稱，後翅腹面點綴著細緻紅斑，飛舞時光彩奪目。牠們的飛行節奏極為敏捷迅速，穿梭在樹冠與溪谷之間宛如流星。幼蟲專以樟樹、紅楠及肉桂等樟科植物嫩葉為食，成蝶則是低中海拔森林重要的授粉媒介，雄蝶經常在晴朗午後群聚於潮濕溪畔吸水。',
    funFact: '雄性青帶鳳蝶常群聚在溪邊潮濕沙地「吸水排尿」，是為了攝取繁衍生命所必需的鈉離子與微量礦物質！',
  },

  lophura_swinhoii: {
    id: 'lophura_swinhoii',
    name: '藍腹鷴',
    scientificName: 'Lophura swinhoii',
    category: 'animal',
    tag: '鳥類・台灣特有種・珍貴稀有',
    image: '/lophura_swinhoii_type_1.png',
    bannerImage: '/lophura_swinhoii_type_2.png',
    description:
      '藍腹鷴是台灣特有的大型雉科鳥類，常漫步於中低海拔原始闊葉林及針闊葉混合林的林下灌叢中。雄鳥體羽覆蓋著深邃的金屬深藍色光澤，頭頂冠羽微翹，背部飾有一抹顯眼的純白色鞍狀斑塊與雪白長尾羽，儀態優雅沉靜；雌鳥則身披斑駁隱蔽的紅褐色羽毛，完美融入落葉層中。性格警覺沉穩，以林地果實、種子與無脊椎動物為食。',
    funFact: '藍腹鷴生性隱密沉穩，清晨與黃昏常以極具紳士風範的步伐悄悄穿梭於森林小徑落葉堆中尋覓食物！',
  },

  sylvirana_guentheri: {
    id: 'sylvirana_guentheri',
    name: '貢德氏赤蛙',
    scientificName: 'Sylvirana guentheri',
    category: 'animal',
    tag: '兩棲類・大型赤蛙',
    image: '/sylvirana_guentheri_type_1.png',
    bannerImage: '/sylvirana_guentheri_type_2.png',
    description:
      '貢德氏赤蛙是台灣體型碩大的赤蛙科成員，體色呈溫潤的淺綠褐色或黃褐色，體側生有一對寬厚鮮明的背側褶，大而圓的鼓膜外緣呈現深黑褐色。廣泛棲息於低海拔稻田、池塘、草澤與水溝環境。每逢春夏繁殖季節，雄蛙會鼓起喉部一對鳴囊，發出宛如大狗汪汪叫的宏亮求偶聲，因而在鄉土間獲得了「狗蛙」的逗趣俗稱。',
    funFact: '初次在夏夜鄉間水池聽到貢德氏赤蛙「苟、苟、苟」叫聲的人，常誤以為草叢裡躲著小狗在對著水面汪汪叫！',
  },

  // ──────────────────────────── 3 種台灣風景手勢 ────────────────────────────
  Mountain_type_1: {
    id: 'Mountain_type_1',
    name: '山嶽手勢：大圓晨曦',
    scientificName: 'Taiwan Alpine Morning Sun',
    category: 'landscape',
    tag: '風景手勢・合歡群峰',
    image: '/Mountain_type_1.png',
    bannerImage: '/Mountain_type_1.png',
    description:
      '象徵中央山脈合歡群峰清晨的第一道金色曙光。透過雙手向上高舉過頭向內圈攏的圓弧體態，呼應旭日東升與壯闊雲海翻騰的大自然意象。台灣擁有超過兩百六十座海拔三千公尺以上的高山，獨特的高山杜鵑與冷杉林相在晨光灑落時如夢似幻，展現出台灣作為高山島嶼無與倫比的垂直生態奇蹟。',
    funFact: '台灣擁有超過 268 座海拔 3,000 公尺以上的高山，是全世界高山密度最高的島嶼之一！',
  },

  Mountain_type_2: {
    id: 'Mountain_type_2',
    name: '山嶽手勢：大地開闊',
    scientificName: 'Taiwan Ridge T-Pose Open View',
    category: 'landscape',
    tag: '風景手勢・脊梁山脈',
    image: '/Mountain_type_2.png',
    bannerImage: '/Mountain_type_2.png',
    description:
      '象徵玉山主脊與雪山連峰的開闊大地意象。雙臂舒展水平側向伸直的平舉身姿，宛如展翅翱翔於崇山峻嶺之上，擁抱萬里翠綠的原始林相。貫穿全島的脊梁山脈扮演著天然水庫與綠色生態長廊的關鍵角色，山嵐雲霧在深谷間流轉繚繞，孕育出豐富的水資源與生機盎然的森林王國。',
    funFact: '台灣脊梁山脈阻擋了來自太平洋的水氣與東北季風，造就了島嶼東西兩側迥異的氣候與微生態！',
  },

  Mountain_type_3: {
    id: 'Mountain_type_3',
    name: '山嶽手勢：高峰指天',
    scientificName: 'Taiwan Sacred Summit Reach',
    category: 'landscape',
    tag: '風景手勢・聖稜天際線',
    image: '/Mountain_type_3.png',
    bannerImage: '/Mountain_type_3.png',
    description:
      '象徵雪霸聖稜線與奇萊主北峰巍峨峭壁的神聖天際線。透過單手向上高舉指天、另一手曲肘沉靜置於胸前的虔敬體態，向崇高壯麗的台灣山林致敬。暮色晚霞為連峰稜線染上一層深邃神秘的光暈，傳遞著敬畏自然、守護野生動物家園與落實無痕山林（LNT）的生態保育精神。',
    funFact: '日本登山家沼井鐵太郎曾讚嘆：「這神聖的稜線啊！誰能真正完成大霸尖山至雪山的連峰縱走，才能稱得上真正的登山者。」',
  },
};
