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
  categoryLabel?: string;
  /** 貓空代表景點／微棲地 */
  muzhaSpot?: string;
  /** 生態關鍵標籤 */
  tags?: string[];
  /** 精簡介紹（顯示於資訊看板與植物誌卡片，建議 1～2 句） */
  conciseDescription?: string;
  /** 與木柵貓空的生態／文化關聯 */
  muzhaRelation?: string;
  /** 植物型態與生態功能完整說明 */
  description?: string;
  /** 趣味小知識 */
  funFact?: string;
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
  tag?: string;
  /** 主展示圖片路徑 */
  image: string;
  /** 備用／第二型態圖片路徑 */
  bannerImage?: string;
  /** 詳細簡介（資訊看板會自動分段排版） */
  description?: string;
  /** 趣味知識 */
  funFact?: string;
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
      '',
    muzhaRelation:
      '',
    description:
      '',
    funFact:
      '',
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
      '',
    muzhaRelation:
      '',
    description:
      '',
    funFact:
      '',
  },
  {
    id: 'plant-3',
    imageSrc: '/leaves_ground_6.png',
    name: '台灣山櫻',
    scientificName: 'Aglaomorpha coronans',
    category: 'side',
    group: 'C',
    categoryLabel: '',
    muzhaSpot: '',
    tags: ['👑 空中客棧', '🌧️ 聚寶盛雨', '🌿 雲霧著生'],
  },
  {
    id: 'plant-5',
    imageSrc: '/leaves_ground_5.png',
    name: '蓪草',
    scientificName: 'Ampelocissus cantoniensis',
    category: 'side',
    group: 'C',
  },
  {
    id: 'plant-6',
    imageSrc: '/leaves_ground_3.png',
    name: '綠竹',
    scientificName: 'Yushania niitakayamensis',
    category: 'bottom',
    group: 'B',
  },
  {
    id: 'plant-7',
    imageSrc: '/leaves_ground_2.png',
    name: '鐵觀音',
    scientificName: 'Nephrolepis cordifolia',
    category: 'bottom',
    group: 'A',
    categoryLabel: '地板植被・茶園坡坎',
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
  },
  {
    id: 'diploderma_polygonatum_xanthostomum',
    name: '黃口攀蜥',
    scientificName: 'Diploderma polygonatum xanthostomum',
    category: 'animal',
    tag: '爬蟲類・台灣特有亞種',
    image: '/diploderma_polygonatum_xanthostomum_type_1.png',
    bannerImage: '/diploderma_polygonatum_xanthostomum_type_2.png',
  },
  {
    id: 'graphium_sarpedon_connectens',
    name: '青帶鳳蝶',
    scientificName: 'Graphium sarpedon connectens',
    category: 'animal',
    tag: '昆蟲類・台灣特有亞種',
    image: '/graphium_sarpedon_connectens_type_1.png',
    bannerImage: '/graphium_sarpedon_connectens_type_2.png',
  },
  {
    id: 'lophura_swinhoii',
    name: '藍腹鷴',
    scientificName: 'Lophura swinhoii',
    category: 'animal',
    tag: '鳥類・台灣特有種・珍貴稀有',
    image: '/lophura_swinhoii_type_1.png',
    bannerImage: '/lophura_swinhoii_type_2.png',
  },
  {
    id: 'sylvirana_guentheri',
    name: '貢德氏赤蛙',
    scientificName: 'Sylvirana guentheri',
    category: 'animal',
    tag: '兩棲類・大型赤蛙',
    image: '/sylvirana_guentheri_type_1.png',
    bannerImage: '/sylvirana_guentheri_type_2.png',
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
    tag: '小小又多山的國家',
    image: '/Mountain_type_1.png',
    bannerImage: '/Mountain_type_1.png',
  },
  {
    id: 'Mountain_type_2',
    name: '岩壁',
    scientificName: 'Taiwan Ridge T-Pose Open View',
    category: 'landscape',
    tag: '小小又多山的國家',
    image: '/Mountain_type_2.png',
    bannerImage: '/Mountain_type_2.png',
  },
  {
    id: 'Mountain_type_3',
    name: '壺穴',
    scientificName: 'Taiwan Sacred Summit Reach',
    category: 'landscape',
    tag: '小小又多山的國家',
    image: '/Mountain_type_3.png',
    bannerImage: '/Mountain_type_3.png',
  },
];

/** 集中總表（若需一次檢視或匯出全站所有生物誌條目可直接取用） */
export const BIO_DATA = {
  plants: BIO_PLANTS,
  leavesSummary: BIO_LEAVES_SUMMARY,
  animals: BIO_ANIMALS,
  landscapes: BIO_LANDSCAPES,
} as const;
