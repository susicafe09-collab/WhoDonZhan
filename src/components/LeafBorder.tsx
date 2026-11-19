import React from 'react';
import { UnifiedMode } from './MediaPipeView';

interface LeafBorderProps {
  activeMode?: UnifiedMode;
}

const BORDER_CONFIG: Record<UnifiedMode, { src: string; alt: string }> = {
  leaves: {
    src: '/plant_boarder.png',
    alt: '撥開葉子邊框 (Plant Border)',
  },
  animal: {
    src: '/animals_boarder.png',
    alt: '動物互動邊框 (Animal Border)',
  },
  landscape: {
    src: '/scene_boarder.png',
    alt: '風景手勢邊框 (Scene Border)',
  },
};

/**
 * 互動功能邊框疊加層元件：
 * - 最上層渲染 (z-52, pointer-events-none)
 * - 依當前互動模式切換專屬邊框素材：
 *   1. 撥開葉子：boarder_top.png, boarder_side_left.png, boarder_side_right.png (100% 完全不透明，微風擺盪動效)
 *   2. 動物互動：animals_boarder.png (100% 完全不透明)
 *   3. 風景手勢：scene_boarder.png (100% 完全不透明)
 * - 移除所有刷淡與透明度效果，維持 100% 完整實色 (opacity: 1)
 * - 內建平滑淡入淡出轉場動效，切換模式無延遲、不閃爍
 */
export const LeafBorder: React.FC<LeafBorderProps> = ({ activeMode = 'leaves' }) => {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none select-none z-52 overflow-hidden">
      {/* 1. 撥開葉子專屬邊框 (頂部、左側、右側獨立微風動畫，100% 全不透明渲染) */}
      <div
        className="absolute inset-0 w-full h-full pointer-events-none select-none transition-opacity duration-500 ease-in-out"
        style={{ opacity: activeMode === 'leaves' ? 1 : 0 }}
      >
        <img
          src="/boarder_top.png"
          alt="頂部樹冠邊框 (Top Border)"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none animate-breeze-top"
          style={{ opacity: 1 }}
        />
        <img
          src="/boarder_side_left.png"
          alt="左側邊緣樹木邊框 (Side Left Border)"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none animate-breeze-left"
          style={{ opacity: 1 }}
        />
        <img
          src="/boarder_side_right.png"
          alt="右側邊緣樹木邊框 (Side Right Border)"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none animate-breeze-right"
          style={{ opacity: 1 }}
        />
      </div>

      {/* 2. 動物互動模式專屬邊框 (100% 完全不透明) */}
      <img
        src="/animals_boarder.png"
        alt="動物互動邊框 (Animal Border)"
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none transition-opacity duration-500 ease-in-out"
        style={{ opacity: activeMode === 'animal' ? 1 : 0 }}
      />

      {/* 3. 風景手勢模式專屬邊框 (100% 完全不透明) */}
      <img
        src="/scene_boarder.png"
        alt="風景手勢邊框 (Scene Border)"
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none transition-opacity duration-500 ease-in-out"
        style={{ opacity: activeMode === 'landscape' ? 1 : 0 }}
      />
    </div>
  );
};

export default LeafBorder;
