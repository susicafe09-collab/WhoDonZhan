export type PlantGroup = 'A' | 'B' | 'C';
export type PlantPositionType = 'bottom' | 'hanging';

export interface PlantItem {
  id: string;
  group: PlantGroup;
  imageSrc: string;
  name?: string;
  side: 'left' | 'right';
  index: number;
  positionType: PlantPositionType;
  topPercent?: number; // e.g. 20, 60 (for Group C hanging plants)
  horizontalOffsetPercent?: number; // left/right edge offset (e.g. 2% ~ 18%)
  scale: number;
  baseRotate: number;
  isPushed: boolean;
  pushedAt: number | null;
  remainingSeconds: number; // auto-return countdown
  displaceAngle: number;
  displaceX: number;
  displaceY: number;
  waveCount: number; // accumulated hand waves
  lastWaveAt: number;
  resetCount?: number; // increments on each plant reset/swap
}

export interface MuzhaPlantInfo {
  id: string;
  name: string;
  scientificName: string;
  categoryLabel: string; // '地板植物' | '側邊植物'
  imageSrc: string;
  muzhaSpot: string; // 貓空景點/棲地
  muzhaRelation: string; // 與木柵貓空地區的生態/產業淵源
  description: string; // 生態特徵與習性
  funFact?: string;
  tags?: string[]; // 生態特徵標籤 (例如：💧 坡地抓土、🍵 茶樹遮陰)
}

export interface MotionPoint {
  x: number;
  y: number;
  intensity: number;
  timestamp: number;
}

export interface AppSettings {
  autoReturnSeconds: number; // default 20
  requiredWaveCount: number; // default 3 waves to trigger, prevents walking crowds
  motionSensitivity: number; // 1 to 10, default 6
  soundEnabled: boolean;
  mirroredCamera: boolean;
  invertPlantMirror: boolean;
  showMotionDebug: boolean;
  isPhoneFrame: boolean;
}
