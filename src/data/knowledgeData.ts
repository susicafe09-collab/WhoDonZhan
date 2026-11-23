import {
  BIO_PLANTS,
  BIO_LEAVES_SUMMARY,
  BIO_ANIMALS,
  BIO_LANDSCAPES,
} from './bioData';
import type { MuzhaPlantInfo } from '../types';

export { BIO_DATA, BIO_PLANTS, BIO_ANIMALS, BIO_LANDSCAPES, BIO_LEAVES_SUMMARY } from './bioData';

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
 * 精簡景點介紹（自動由 bioData.ts 衍生，修改文字請直接編輯 src/data/bioData.ts）
 */
export const CONCISE_PLANT_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  BIO_PLANTS.map((plant) => [plant.imageSrc, plant.conciseDescription])
);

/**
 * 木柵貓空植物資料庫索引表（自動由 bioData.ts 衍生）
 */
export const MUZHA_PLANTS_DATA: Record<string, MuzhaPlantDetail> = Object.fromEntries(
  BIO_PLANTS.map((plant) => [
    plant.imageSrc,
    {
      imageSrc: plant.imageSrc,
      name: plant.name,
      scientificName: plant.scientificName,
      category: plant.category,
      categoryLabel: plant.categoryLabel,
      muzhaSpot: plant.muzhaSpot,
      muzhaRelation: plant.muzhaRelation,
      description: plant.description,
      funFact: plant.funFact,
      tags: plant.tags,
    },
  ])
);

/**
 * 全套木柵貓空植物清單（供資訊看板與預設輪播使用，自動由 bioData.ts 衍生）
 */
export const ALL_MUZHA_PLANTS_LIST: MuzhaPlantInfo[] = BIO_PLANTS.map((plant) => ({
  id: plant.id,
  name: plant.name,
  scientificName: plant.scientificName,
  categoryLabel: plant.categoryLabel,
  imageSrc: plant.imageSrc,
  muzhaSpot: plant.muzhaSpot,
  tags: plant.tags,
  muzhaRelation: plant.muzhaRelation,
  description: plant.description,
  funFact: plant.funFact,
}));

/**
 * 側邊與地板互動植物隨機池（自動由 bioData.ts 衍生）
 */
export const SIDE_PLANT_POOLS = BIO_PLANTS.filter((p) => p.category === 'side').map((p) => ({
  imageSrc: p.imageSrc,
  name: p.name,
  group: p.group,
}));

export const BOTTOM_PLANT_POOLS = BIO_PLANTS.filter((p) => p.category === 'bottom').map((p) => ({
  imageSrc: p.imageSrc,
  name: p.name,
  group: p.group,
}));

/**
 * 展場專屬知識資料字典（自動由 bioData.ts 衍生：葉片總覽 + 5 種動物 + 3 種山景）
 */
export const KNOWLEDGE_DICTIONARY: Record<string, KnowledgeItem> = Object.fromEntries(
  [BIO_LEAVES_SUMMARY, ...BIO_ANIMALS, ...BIO_LANDSCAPES].map((entry) => [entry.id, entry])
);
