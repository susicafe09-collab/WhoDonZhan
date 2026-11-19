import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlantItem } from '../types';
import { RotateCcw, Hand } from 'lucide-react';

interface PlantProps {
  plant: PlantItem;
  imageSrc?: string;
  invertMirror?: boolean;
  totalDuration: number;
  requiredWaves?: number;
  onPush: (id: string) => void;
  onReset: (id: string) => void;
}

export const Plant: React.FC<PlantProps> = ({
  plant,
  imageSrc,
  invertMirror = false,
  totalDuration,
  requiredWaves = 1,
  onPush,
  onReset,
}) => {
  const isLeft = plant.side === 'left';
  const resolvedImage = plant.imageSrc || imageSrc || '/leaves.png';
  const isBottom = plant.positionType === 'bottom';

  // Left side: natural; Right side: mirrored horizontally
  const isMirrored = isLeft ? invertMirror : !invertMirror;

  // Transform origins:
  // Bottom plants: anchored at bottom corner
  // Side hanging plants: anchored at border edge
  // Transform origin
  const transformOrigin = isBottom
    ? isLeft
      ? 'bottom left'
      : 'bottom right'
    : isLeft
    ? '0% 25%'
    : '100% 25%';

  // Wave excited twitch
  const waveExcited = plant.waveCount > 0 && !plant.isPushed;

  // Countdown ring calculation (預設 10 秒)
  const durationSec = totalDuration || 10;
  const progressRatio = Math.max(0, plant.remainingSeconds / durationSec);
  const strokeDashoffset = 88 * (1 - progressRatio);

  // Shared state-driven animation values
  // Consistent transition-all duration-700 ease-out prevents any teleportation or jittering
  const targetRotate = isBottom
    ? isLeft
      ? -14 + (plant.displaceAngle || 0)
      : 14 + (plant.displaceAngle || 0)
    : isLeft
    ? -28 + (plant.displaceAngle || 0)
    : 28 + (plant.displaceAngle || 0);

  const restingRotate = plant.baseRotate || 0;

  const currentRotate = plant.isPushed ? targetRotate : restingRotate;
  const currentScale = plant.isPushed ? plant.scale * 0.95 : plant.scale;
  const currentXPercent = plant.isPushed
    ? isBottom
      ? isLeft
        ? -105
        : 105
      : isLeft
      ? -115
      : 115
    : 0;
  const currentYPercent = plant.isPushed ? (isBottom ? 45 : 0) : 0;

  const transformString = `translate3d(${currentXPercent}%, ${currentYPercent}%, 0) rotate(${currentRotate}deg) scale(${currentScale})`;

  // Root wrapper styles:
  // 採用相對於 AR 畫布的百分比尺寸，確保在橫式視窗、直式平板或 9:16 直立大螢幕上皆等比精準對齊
  const offsetPercent = plant.horizontalOffsetPercent ?? 1;
  const rootStyle: React.CSSProperties = isBottom
    ? {
        bottom: 0,
        [isLeft ? 'left' : 'right']: `${offsetPercent}%`,
        width: '37%',
        height: '25%',
      }
    : {
        top: `${plant.topPercent ?? 20}%`,
        [isLeft ? 'left' : 'right']: `${offsetPercent}%`,
        width: '31%',
        height: '18.5%',
      };

  return (
    <div
      id={`plant-wrapper-${plant.id}`}
      className={`absolute select-none pointer-events-auto z-25 overflow-visible opacity-100 ${
        isBottom ? 'bottom-0' : ''
      }`}
      style={rootStyle}
    >
      {/* Shared state-driven transition container - always full opacity */}
      <div
        id={`plant-motion-${plant.id}`}
        className={`relative cursor-pointer group flex flex-col items-center ${
          isBottom ? 'justify-end' : 'justify-start'
        } transition-all duration-700 ease-out will-change-transform w-full h-full`}
        style={{
          transformOrigin,
          transform: transformString,
          opacity: 1,
        }}
        onClick={() => onPush(plant.id)}
        title={`${plant.name || '植物'} - 點擊或在畫面兩側揮手撥開`}
      >
        {/* Subtle breathing sway when resting / wave twitch when stroked */}
        <div
          className={`w-full h-full flex ${isBottom ? 'items-end' : 'items-start'} justify-center ${
            !plant.isPushed
              ? isBottom
                ? 'animate-plant-sway-bottom'
                : 'animate-plant-sway'
              : ''
          } ${waveExcited ? 'animate-wave-twitch' : ''}`}
          style={{
            transformOrigin,
          }}
        >
          {/* Mirror flip container */}
          <div
            className={`w-full h-full flex ${isBottom ? 'items-end' : 'items-start'} justify-center`}
            style={{
              transform: isMirrored ? 'scaleX(-1)' : 'scaleX(1)',
            }}
          >
            <img
              src={resolvedImage}
              alt={plant.name || `植物素材 - ${isLeft ? '左側' : '右側'}`}
              className={`w-full h-full object-contain ${
                isBottom ? 'object-bottom' : 'object-top'
              } pointer-events-none select-none transition-opacity duration-300`}
              loading="eager"
              draggable={false}
            />
          </div>
        </div>

        {/* Multi-Wave Progress Indicator Badge */}
        <AnimatePresence>
          {waveExcited && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`absolute top-2 ${
                isLeft ? 'right-1' : 'left-1'
              } z-35 flex items-center gap-1 bg-[#1A1A1A] text-zinc-200 border-none shadow-none px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-tight`}
            >
              <Hand className="w-3 h-3 animate-pulse text-[#4CA6A8]" />
              <span>揮手 {plant.waveCount}/{requiredWaves}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Countdown Ring Badge (visible when pushed aside) */}
        <AnimatePresence>
          {plant.isPushed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2 }}
              className={`absolute top-4 ${
                isLeft ? 'right-2' : 'left-2'
              } z-35 flex items-center gap-1.5 bg-[#1A1A1A] px-2.5 py-1 rounded-full border-none shadow-none text-zinc-100 text-xs font-mono`}
              onClick={(e) => {
                e.stopPropagation();
                onReset(plant.id);
              }}
            >
              {/* Circular progress ring */}
              <div className="relative w-4 h-4 flex items-center justify-center">
                <svg className="w-4 h-4 -rotate-90" viewBox="0 0 32 32">
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    fill="none"
                    stroke="#262626"
                    strokeWidth="3.5"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    fill="none"
                    stroke="#4CA6A8"
                    strokeWidth="3.5"
                    strokeDasharray="88"
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-[stroke-dashoffset] duration-100 ease-linear"
                  />
                </svg>
                <span className="absolute text-[8px] font-bold text-zinc-200">
                  {Math.ceil(plant.remainingSeconds)}
                </span>
              </div>

              <span className="text-[10px] text-zinc-300 tracking-tight whitespace-nowrap">
                {plant.remainingSeconds > 0 ? `${plant.remainingSeconds.toFixed(0)}s` : '復位中'}
              </span>

              <button
                type="button"
                className="ml-0.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="立即歸位"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
