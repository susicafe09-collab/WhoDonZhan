import React, { useEffect, useRef } from 'react';
import {
  useAnimalTracking,
  EndemicAnimalType,
  AnimalAppearanceType,
} from '../hooks/useAnimalTracking';
import {
  VideoCoverProjection,
  IDENTITY_VIDEO_PROJECTION,
  projectVideoPointToStage,
  projectVideoWidthToStage,
} from '../utils/videoProjection';

interface AnimalModeProps {
  faces: any[];
  poses: any[];
  projection?: VideoCoverProjection;
  onActiveAnimalChange?: (activeAnimal: string | null) => void;
}

// 5 種台灣特有種動物、各 2 種型態的完整圖片路徑對照表
const ANIMAL_IMAGE_MAP: Record<EndemicAnimalType, Record<AnimalAppearanceType, string>> = {
  macaca_cyclopis: {
    type_1: '/macaca_cyclopis_type_1.png',
    type_2: '/macaca_cyclopis_type_2.png',
  },
  diploderma_polygonatum_xanthostomum: {
    type_1: '/diploderma_polygonatum_xanthostomum_type_1.png',
    type_2: '/diploderma_polygonatum_xanthostomum_type_2.png',
  },
  graphium_sarpedon_connectens: {
    type_1: '/graphium_sarpedon_connectens_type_1.png',
    type_2: '/graphium_sarpedon_connectens_type_2.png',
  },
  lophura_swinhoii: {
    type_1: '/lophura_swinhoii_type_1.png',
    type_2: '/lophura_swinhoii_type_2.png',
  },
  sylvirana_guentheri: {
    type_1: '/sylvirana_guentheri_type_1.png',
    type_2: '/sylvirana_guentheri_type_2.png',
  },
};

// 取得對應動物種類與外觀型態的素材圖片 URL
const getImageSrc = (type: EndemicAnimalType, appearance: AnimalAppearanceType = 'type_1'): string => {
  const animalEntry = ANIMAL_IMAGE_MAP[type];
  if (animalEntry) {
    return animalEntry[appearance] || animalEntry.type_1;
  }
  return '';
};

// 完整 10 張圖片清單，供初始強制預載防閃爍
const PRELOAD_IMAGES: { src: string; alt: string }[] = [
  // 台灣獼猴
  { src: '/macaca_cyclopis_type_1.png', alt: 'preload 台灣獼猴 Type 1' },
  { src: '/macaca_cyclopis_type_2.png', alt: 'preload 台灣獼猴 Type 2' },
  // 黃口攀蜥
  { src: '/diploderma_polygonatum_xanthostomum_type_1.png', alt: 'preload 黃口攀蜥 Type 1' },
  { src: '/diploderma_polygonatum_xanthostomum_type_2.png', alt: 'preload 黃口攀蜥 Type 2' },
  // 青帶鳳蝶
  { src: '/graphium_sarpedon_connectens_type_1.png', alt: 'preload 青帶鳳蝶 Type 1' },
  { src: '/graphium_sarpedon_connectens_type_2.png', alt: 'preload 青帶鳳蝶 Type 2' },
  // 藍腹鷴
  { src: '/lophura_swinhoii_type_1.png', alt: 'preload 藍腹鷴 Type 1' },
  { src: '/lophura_swinhoii_type_2.png', alt: 'preload 藍腹鷴 Type 2' },
  // 貢德氏赤蛙
  { src: '/sylvirana_guentheri_type_1.png', alt: 'preload 貢德氏赤蛙 Type 1' },
  { src: '/sylvirana_guentheri_type_2.png', alt: 'preload 貢德氏赤蛙 Type 2' },
];

const AnimalMode: React.FC<AnimalModeProps> = ({
  faces,
  poses,
  projection = IDENTITY_VIDEO_PROJECTION,
  onActiveAnimalChange,
}) => {
  const trackers = useAnimalTracking(faces, poses);
  const lastEmittedRef = useRef<string | null>(null);
  const onActiveAnimalChangeRef = useRef(onActiveAnimalChange);
  onActiveAnimalChangeRef.current = onActiveAnimalChange;

  // 當畫面上出現活躍且透明度高的動物時，向外同步當前動物
  useEffect(() => {
    const activeTracker = trackers.find((t) => t.opacity > 0.3 && t.isActive);
    const target = activeTracker ? activeTracker.type : null;

    if (lastEmittedRef.current !== target) {
      lastEmittedRef.current = target;
      onActiveAnimalChangeRef.current?.(target);
    }
  }, [trackers]);

  return (
    <>
      {/* 圖片預載防閃爍：確保 10 張特有種動物圖片在初始載入時就完整快取 */}
      <div style={{ display: 'none' }} aria-hidden="true">
        {PRELOAD_IMAGES.map((img) => (
          <img key={img.src} src={img.src} alt={img.alt} />
        ))}
      </div>

      {/* 追蹤頭部並渲染動物頭飾（依目前直式／橫式 object-fit: cover 精準對齊座標與寬度） */}
      {trackers.map((t) => {
        const projected = projectVideoPointToStage(t.x, t.y, projection, true);
        const projectedWidth = Math.min(
          0.72,
          Math.max(0.12, projectVideoWidthToStage(t.width, projection))
        );

        return (
          <img
            key={t.id}
            src={getImageSrc(t.type, t.appearance)}
            alt={`${t.type}_${t.appearance}`}
            className="absolute object-contain pointer-events-none"
            style={{
              left: `${projected.x * 100}%`,
              top: `${projected.y * 100}%`,
              width: `${projectedWidth * 100}%`,
              opacity: t.opacity,
              transform: 'translate(-50%, -50%)',
              transition: `opacity ${t.transitionDuration}s ease-in-out`,
              willChange: 'opacity, left, top, width',
            }}
          />
        );
      })}
    </>
  );
};

export default AnimalMode;
