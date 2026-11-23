/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 【生物誌文本集中管理設定檔 (Bio Data)】
 * ─────────────────────────────────────────────────────────────────────────────
 * 所有「木柵貓空植物生態誌」、「台灣特有種動物」、「台灣山嶽風景手勢」的
 * 名稱、學名、精簡介紹、詳細敘述與趣味知識皆統一集中於此檔。
 *
 * 修改指南：
 * 1. 直接修改下方對應物件的文字欄位即可，無需更動任何元件或版面程式碼。
 * 2. 修改後會同步生效於主互動螢幕（貓空植物誌面板）與所有第二螢幕資訊看板 (/info)。
 * 3. 請勿隨意更改 `id` 與 `imageSrc` / `image` 路徑，以免影響圖片對應與同步代號。
 * ═════════════════════════════════════════════════════════════════════════════
 */

export interface BioPlantEntry {
  /** 唯一識別碼 */
  id: string;
  /** 對應植物圖片路徑 */
  imageSrc: string;
  /** 顯示名稱（中文） */
  name: string;
  /** 學名（斜體顯示於資訊面板） */
  scientificName: string;
  /** 擺放位置類型：'bottom' 地板植被 | 'side' 側邊懸掛植物 */
  category: 'bottom' | 'side';
  /** 互動分組代號 */
  group: 'A' | 'B' | 'C';
  /** 類型標籤 */
  categoryLabel: string;
  /** 貓空代表景點／微棲地 */
  muzhaSpot: string;
  /** 生態關鍵標籤 */
  tags: string[];
  /** 精簡介紹（顯示於資訊看板與植物誌卡片，建議 1～2 句） */
  conciseDescription: string;
  /** 與木柵貓空的生態／文化關聯 */
  muzhaRelation: string;
  /** 植物型態與生態功能完整說明 */
  description: string;
  /** 趣味小知識 */
  funFact: string;
}

export interface BioKnowledgeEntry {
  /** 唯一識別碼（須與互動同步代號一致） */
  id: string;
  /** 顯示名稱（中文） */
  name: string;
  /** 學名或英文副標（斜體顯示於資訊面板） */
  scientificName: string;
  /** 所屬分類：'animal' 動物 | 'landscape' 風景 | 'leaves' 植物總覽 */
  category: 'animal' | 'landscape' | 'leaves';
  /** 類型標籤 */
  tag: string;
  /** 主展示圖片路徑 */
  image: string;
  /** 備用／第二型態圖片路徑 */
  bannerImage?: string;
  /** 詳細簡介（資訊看板會自動分段排版） */
  description: string;
  /** 趣味知識 */
  funFact: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 一、木柵貓空植物誌（共 6 款植物，依茶山垂直生態鏈排序）
// ─────────────────────────────────────────────────────────────────────────────
export const BIO_PLANTS: BioPlantEntry[] = [
  {
    id: 'plant-1',
    imageSrc: '/leaves_ground_4.png',
    name: '綠竹',
    scientificName: 'Bambusa oldhamii (Shoots)',
    category: 'bottom',
    group: 'B',
    categoryLabel: '地板植被・木柵名產',
    muzhaSpot: '老泉里・指南茶山坡地',
    tags: ['🎋 木柵三寶', '💧 坡地固水', '🌱 雨後破土'],
    conciseDescription:
      '生長於老泉里背風坡地，疏鬆富含腐植質的土壤孕育出肉質細嫩如梨的綠竹筍，為木柵最具代表性的名產。',
    muzhaRelation:
      '木柵老泉里向陽背風、土壤鬆軟富含腐植質，造就綠竹筍清甜如梨。初夏採筍與焙製鐵觀音交相輝映，是貓空茶山農耕共生的名產瑰寶。',
    description:
      '多年生常綠竹類地下嫩芽，雨後強力破土。筍籜緊密包裹，基部根系具強大抓土固水功能，守護坡地表土不被梅雨沖刷。',
    funFact:
      '茶農須在清晨破曉前「摸黑掘筍」，筍尖一旦探出照光出青便會轉苦，採筍全憑指尖摸尋！',
  },
  {
    id: 'plant-2',
    imageSrc: '/leaves.png',
    name: '樟樹樹葉',
    scientificName: 'Cinnamomum camphora',
    category: 'side',
    group: 'C',
    categoryLabel: '側邊植物・樹冠林蔭',
    muzhaSpot: '樟樹步道・百年老樟樹群',
    tags: ['☀️ 柔和漫射', '🍃 天然芬多精', '🌿 驅蟲清芬'],
    conciseDescription:
      '樟樹步道沿線遺存的百年老樟樹群，高聳樹冠宛如天然綠傘，為坡地茶園提供柔和漫射日光與清芬香氣。',
    muzhaRelation:
      '貓空「樟湖」之地名由來。清代曾為樟腦提煉重鎮，如今巨大的綠傘樹冠為林下怕強光的鐵觀音茶樹遮擋烈日，提供溫和的漫射光與天然驅蟲香氣。',
    description:
      '樟科大型常綠喬木，葉具明顯三出脈。搓揉新鮮葉片即散發清芬提神的天然芳樟醇，清淨山林空氣。',
    funFact:
      '清晨微風吹拂樟楠樹冠釋放豐富天然樟醇與芬多精，昔日茶農深信能驅瘴醒腦，是古道最天然的防護罩。',
  },
  {
    id: 'plant-3',
    imageSrc: '/leaves_ground_6.png',
    name: '台灣山櫻',
    scientificName: 'Aglaomorpha coronans',
    category: 'side',
    group: 'C',
    categoryLabel: '側邊植物・空中皇冠',
    muzhaSpot: '指南宮後山・巨木相思林',
    tags: ['👑 空中客棧', '🌧️ 聚寶盛雨', '🌿 雲霧著生'],
    conciseDescription:
      '高懸於指南山老樹樹幹上的大型著生蕨，如翡翠皇冠般盛接雨水與落葉，展現高濕度茶山獨特的林相景觀。',
    muzhaRelation:
      '附生於指南山老樹樹幹上的大型著生蕨類，宛如翡翠皇冠高懸林間。基部腐植葉如聚寶盆盛接雨水與落葉，在半空中形成提供小生物棲息的空中綠洲。',
    description:
      '水龍骨科大型附生蕨，根莖粗厚肉質橫生。基部腐植質葉如鳥巢般盛接落葉，上部羽狀葉長達一公尺，優雅垂墜。',
    funFact:
      '崖薑蕨是山林中的「空中客棧」，底部堆積的腐植土層常吸引樹蛙、攀蜥與昆蟲在半空中築巢微型生態圈！',
  },
  {
    id: 'plant-5',
    imageSrc: '/leaves_ground_5.png',
    name: '貓空野徑・垂懸藤葉',
    scientificName: 'Ampelocissus cantoniensis',
    category: 'side',
    group: 'C',
    categoryLabel: '側邊植物・林緣攀緣',
    muzhaSpot: '壺穴步道・溪畔次生林緣',
    tags: ['🍇 獼猴珍饈', '🌿 垂掛綠簾', '💧 朝露滋養'],
    conciseDescription:
      '攀附於壺穴步道岩壁與茶園石籬間，垂懸形成宛若綠色水簾的步道景致，深秋結出的漿果更是山林鳥獸的覓食焦點。',
    muzhaRelation:
      '攀附於壺穴步道岩壁與茶園石籬間，垂懸形成如瀑布般的綠色水簾。深秋結出的深紫漿果，是貓空山林台灣獼猴與藍腹鷴最愛的野性珍饈。',
    description:
      '木質落葉攀援藤本，以枝梢卷鬚攀附向上蔓生。葉片心狀卵形，垂掛步道兩側形成立體林緣景致。',
    funFact:
      '木質藤莖導水能力極強，昔日老獵人與巡山人在深山缺水時，斜切新鮮藤莖便能汲取清涼天然野藤水！',
  },
  {
    id: 'plant-6',
    imageSrc: '/leaves_ground_3.png',
    name: '綠竹筍',
    scientificName: 'Yushania niitakayamensis',
    category: 'bottom',
    group: 'B',
    categoryLabel: '地板植被・水土護坡',
    muzhaSpot: '樟湖步道・待老坑山稜線',
    tags: ['🛡️ 護坡防線', '🌫️ 凝結晨霧', '🌿 百年古道'],
    conciseDescription:
      '茂密生長於待老坑山稜線，緻密的竹林根系牢固抓附邊坡土石，長年守護挑茶古道的安全行走步徑。',
    muzhaRelation:
      '茂密生長於待老坑山脊梁，密生之竹根如立體鋼筋網牢抓邊坡。季風吹拂時為茶園聚攏水氣凝結山嵐，是挑茶古道百年不塌的護坡功臣。',
    description:
      '禾本科多年生地下走莖植物，竹稈極富韌性。緻密根系交織於地表下，是台灣山坡地防崩塌與林鳥避難的關鍵防線。',
    funFact:
      '地下竹鞭蔓延極深且韌性驚人，昔日挑茶人行走陡坡，全靠箭竹根緊繫砂石維繫安全步道。',
  },
  {
    id: 'plant-7',
    imageSrc: '/leaves_ground_2.png',
    name: '鐵觀音',
    scientificName: 'Nephrolepis cordifolia',
    category: 'bottom',
    group: 'A',
    categoryLabel: '地板植被・茶園坡坎',
    muzhaSpot: '樟樹步道・梯田茶園坡坎',
    tags: ['🍵 茶園護土', '🌰 蓄水鳳凰蛋', '🌿 恆溫保濕'],
    conciseDescription:
      '生長於梯田茶園石坎邊坡，如鳥羽般叢生的翠綠葉片緊扣泥土防止崩塌，維持茶樹土壤恆溫濕潤。',
    muzhaRelation:
      '貓空梯田石坎邊最常見的友善地被。茶農在整地時特意保留腎蕨叢生，利用發達根系緊抓泥土防止崩塌，維持茶樹土壤恆溫保濕。',
    description:
      '多年生常綠蕨類，一回羽狀複葉如鳥羽般叢生開展。地下匍匐莖結出圓球形多汁肉質塊莖，極具耐旱性。',
    funFact:
      '地下多汁小球莖被民間俗稱為「鳳凰蛋」或「水球」，以前採茶婦人與巡山人口渴時，常挖取洗淨咬破解渴！',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 二、撥開綠葉總覽文案（植物互動總結條目）
// ─────────────────────────────────────────────────────────────────────────────
export const BIO_LEAVES_SUMMARY: BioKnowledgeEntry = {
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
};

// ─────────────────────────────────────────────────────────────────────────────
// 三、台灣特有種動物誌（共 5 種動物）
// ─────────────────────────────────────────────────────────────────────────────
export const BIO_ANIMALS: BioKnowledgeEntry[] = [
  {
    id: 'macaca_cyclopis',
    name: '台灣獼猴',
    scientificName: 'Macaca cyclopis',
    category: 'animal',
    tag: '哺乳類・台灣特有種',
    image: '/macaca_cyclopis_type_1.png',
    bannerImage: '/macaca_cyclopis_type_2.png',
    description:
      '臺灣獼猴是臺灣唯一的原生非人類靈長類動物，廣泛分布於全島山區，活動範圍可達海拔 3,000 公尺以上。全身覆有灰褐至橄欖綠色毛髮，臉部裸露，呈淡紫至紅色，尾巴約為體長的三分之二。牠們具有群居的社會結構，食性以植物果實、嫩葉及種子為主，也會捕食昆蟲等小型動物。',
    funFact:
      '臺灣獼猴擁有特殊的「頰囊」，能將採集到的食物暫存在兩頰，等到安全的地方再慢慢取出享用！',
  },
  {
    id: 'diploderma_polygonatum_xanthostomum',
    name: '黃口攀蜥',
    scientificName: 'Diploderma polygonatum xanthostomum',
    category: 'animal',
    tag: '爬蟲類・台灣特有亞種',
    image: '/diploderma_polygonatum_xanthostomum_type_1.png',
    bannerImage: '/diploderma_polygonatum_xanthostomum_type_2.png',
    description:
      '黃口攀蜥是臺灣特有亞種，主要分布於中部以北的平地及低海拔山區，屬於日行性蜥蜴，常活動於森林邊緣及樹木上。體色以黃褐色或綠褐色為主，具有良好的保護色，最明顯的特徵是口腔內側與舌頭呈現鮮黃色。牠們以螞蟻、昆蟲及其他小型無脊椎動物為食，雄蜥具有明顯的領域性，受到干擾時會張口、擴張喉垂並做出伏地挺身的威嚇動作。',
    funFact:
      '黃口攀蜥的雄蜥遇到競爭者或受到干擾時，會張大嘴巴、展開喉垂，搭配上下起伏的伏地挺身動作，宣示領域並嚇退對手！',
  },
  {
    id: 'graphium_sarpedon_connectens',
    name: '青帶鳳蝶',
    scientificName: 'Graphium sarpedon connectens',
    category: 'animal',
    tag: '昆蟲類・台灣特有亞種',
    image: '/graphium_sarpedon_connectens_type_1.png',
    bannerImage: '/graphium_sarpedon_connectens_type_2.png',
    description:
      '青帶鳳蝶以黑色翅膀中央貫穿一列半透明水藍色至青綠色亮麗斑帶而著稱，後翅腹面點綴著細緻紅斑，飛舞時光彩奪目。牠們的飛行節奏極為敏捷迅速，穿梭在樹冠與溪谷之間宛如流星。幼蟲專以樟樹、紅楠及肉桂等樟科植物嫩葉為食，成蝶則是低中海拔森林重要的授粉媒介，雄蝶經常在晴朗午後群聚於潮濕溪畔吸水。',
    funFact:
      '雄性青帶鳳蝶常群聚在溪邊潮濕沙地「吸水排尿」，是為了攝取繁衍生命所必需的鈉離子與微量礦物質！',
  },
  {
    id: 'lophura_swinhoii',
    name: '藍腹鷴',
    scientificName: 'Lophura swinhoii',
    category: 'animal',
    tag: '鳥類・台灣特有種・珍貴稀有',
    image: '/lophura_swinhoii_type_1.png',
    bannerImage: '/lophura_swinhoii_type_2.png',
    description:
      '藍腹鷴是臺灣特有的大型雉科鳥類，主要棲息於中低海拔山區的原始林與次生林底層。雄鳥全身呈帶有金屬光澤的深藍色，頭頂具有白色冠羽，背部與中央尾羽潔白醒目，臉部裸皮及腳部則呈鮮紅色；雌鳥體型較小，全身以紅褐色為主，布滿黃褐色斑紋，具有良好的保護色。牠們生性隱密、警覺性高，主要於晨昏活動，以植物嫩葉、果實、種子及昆蟲等無脊椎動物為食。',
    funFact:
      '藍腹鷴通常在清晨與黃昏出沒，經常沿著熟悉的森林小徑漫步覓食；一旦察覺異狀，就會迅速鑽入草叢或飛往坡下！',
  },
  {
    id: 'sylvirana_guentheri',
    name: '貢德氏赤蛙',
    scientificName: 'Sylvirana guentheri',
    category: 'animal',
    tag: '兩棲類・大型赤蛙',
    image: '/sylvirana_guentheri_type_1.png',
    bannerImage: '/sylvirana_guentheri_type_2.png',
    description:
      '貢德氏赤蛙是台灣體型碩大的赤蛙科成員，體色呈溫潤的淺綠褐色或黃褐色，體側生有一對寬厚鮮明的背側褶，大而圓的鼓膜外緣呈現深黑褐色。廣泛棲息於低海拔稻田、池塘、草澤與水溝環境。每逢春夏繁殖季節，雄蛙會鼓起喉部一對鳴囊，發出宛如大狗汪汪叫的宏亮求偶聲，因而在鄉土間獲得了「狗蛙」的逗趣俗稱。',
    funFact:
      '初次在夏夜鄉間水池聽到貢德氏赤蛙「苟、苟、苟」叫聲的人，常誤以為草叢裡躲著小狗在對著水面汪汪叫！',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 四、台灣山嶽風景手勢誌（共 3 款山景）
// ─────────────────────────────────────────────────────────────────────────────
export const BIO_LANDSCAPES: BioKnowledgeEntry[] = [
  {
    id: 'Mountain_type_1',
    name: '山脈手勢',
    scientificName: 'Taiwan Alpine Morning Sun',
    category: 'landscape',
    tag: '風景手勢・合歡群峰',
    image: '/Mountain_type_1.png',
    bannerImage: '/Mountain_type_1.png',
    description:
      '象徵中央山脈合歡群峰清晨的第一道金色曙光。透過雙手向上高舉過頭向內圈攏的圓弧體態，呼應旭日東升與壯闊雲海翻騰的大自然意象。台灣擁有超過兩百六十座海拔三千公尺以上的高山，獨特的高山杜鵑與冷杉林相在晨光灑落時如夢似幻，展現出台灣作為高山島嶼無與倫比的垂直生態奇蹟。',
    funFact:
      '台灣擁有超過 268 座海拔 3,000 公尺以上的高山，是全世界高山密度最高的島嶼之一！',
  },
  {
    id: 'Mountain_type_2',
    name: '',
    scientificName: 'Taiwan Ridge T-Pose Open View',
    category: 'landscape',
    tag: '風景手勢・脊梁山脈',
    image: '/Mountain_type_2.png',
    bannerImage: '/Mountain_type_2.png',
    description:
      '象徵玉山主脊與雪山連峰的開闊大地意象。雙臂舒展水平側向伸直的平舉身姿，宛如展翅翱翔於崇山峻嶺之上，擁抱萬里翠綠的原始林相。貫穿全島的脊梁山脈扮演著天然水庫與綠色生態長廊的關鍵角色，山嵐雲霧在深谷間流轉繚繞，孕育出豐富的水資源與生機盎然的森林王國。',
    funFact:
      '台灣脊梁山脈阻擋了來自太平洋的水氣與東北季風，造就了島嶼東西兩側迥異的氣候與微生態！',
  },
  {
    id: 'Mountain_type_3',
    name: '壺穴',
    scientificName: 'Taiwan Sacred Summit Reach',
    category: 'landscape',
    tag: '風景手勢・聖稜天際線',
    image: '/Mountain_type_3.png',
    bannerImage: '/Mountain_type_3.png',
    description:
      '象徵雪霸聖稜線與奇萊主北峰巍峨峭壁的神聖天際線。透過單手向上高舉指天、另一手曲肘沉靜置於胸前的虔敬體態，向崇高壯麗的台灣山林致敬。暮色晚霞為連峰稜線染上一層深邃神秘的光暈，傳遞著敬畏自然、守護野生動物家園與落實無痕山林（LNT）的生態保育精神。',
    funFact:
      '日本登山家沼井鐵太郎曾讚嘆：「這神聖的稜線啊！誰能真正完成大霸尖山至雪山的連峰縱走，才能稱得上真正的登山者。」',
  },
];

/** 集中總表（若需一次檢視或匯出全站所有生物誌條目可直接取用） */
export const BIO_DATA = {
  plants: BIO_PLANTS,
  leavesSummary: BIO_LEAVES_SUMMARY,
  animals: BIO_ANIMALS,
  landscapes: BIO_LANDSCAPES,
} as const;
