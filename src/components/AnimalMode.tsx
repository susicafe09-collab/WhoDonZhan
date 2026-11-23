import React, { useEffect, useRef } from 'react';
import {
  useAnimalTracking,
  EndemicAnimalType,
  AnimalAppearanceType,
} from '../hooks/useAnimalTracking';

interface AnimalModeProps {
  faces: any[];
  poses: any[];
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

const getImageSrc = (type: EndemicAnimalType, appearance: AnimalAppearanceType = 'type_1'): string => {
  const animalEntry = ANIMAL_IMAGE_MAP[type];
  if (animalEntry) {
    return animalEntry[appearance] || animalEntry.type_1;
  }
  return '';
};

const PRELOAD_IMAGES: { src: string; alt: string }[] = [
  { src: '/macaca_cyclopis_type_1.png', alt: 'preload 台灣獼猴 Type 1' },
  { src: '/macaca_cyclopis_type_2.png', alt: 'preload 台灣獼猴 Type 2' },
  { src: '/diploderma_polygonatum_xanthostomum_type_1.png', alt: 'preload 黃口攀蜥 Type 1' },
  { src: '/diploderma_polygonatum_xanthostomum_type_2.png', alt: 'preload 黃口攀蜥 Type 2' },
  { src: '/graphium_sarpedon_connectens_type_1.png', alt: 'preload 青帶鳳蝶 Type 1' },
  { src: '/graphium_sarpedon_connectens_type_2.png', alt: 'preload 青帶鳳蝶 Type 2' },
  { src: '/lophura_swinhoii_type_1.png', alt: 'preload 藍腹鷴 Type 1' },
  { src: '/lophura_swinhoii_type_2.png', alt: 'preload 藍腹鷴 Type 2' },
  { src: '/sylvirana_guentheri_type_1.png', alt: 'preload 貢德氏赤蛙 Type 1' },
  { src: '/sylvirana_guentheri_type_2.png', alt: 'preload 貢德氏赤蛙 Type 2' },
];

const AnimalMode: React.FC<AnimalModeProps> = ({
  faces,
  poses,
  onActiveAnimalChange,
}) => {
  const trackers = useAnimalTracking(faces, poses);
  const lastEmittedRef = useRef<string | null>(null);
  const onActiveAnimalChangeRef = useRef(onActiveAnimalChange);
  onActiveAnimalChangeRef.current = onActiveAnimalChange;

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
      <div style={{ display: 'none' }} aria-hidden="true">
        {PRELOAD_IMAGES.map((img) => (
          <img key={img.src} src={img.src} alt={img.alt} />
        ))}
      </div>

      {/* 離屏迷你畫布已事先轉正並鏡像，直接使用 0.0~1.0 螢幕對齊座標渲染 */}
      {trackers.map((t) => {
        const clampedWidth = Math.min(0.72, Math.max(0.12, t.width));

        return (
          <img
            key={t.id}
            src={getImageSrc(t.type, t.appearance)}
            alt={`${t.type}_${t.appearance}`}
            className="absolute object-contain pointer-events-none"
            style={{
              left: `${t.x * 100}%`,
              top: `${t.y * 100}%`,
              width: `${clampedWidth * 100}%`,
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
