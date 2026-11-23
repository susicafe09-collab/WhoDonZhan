import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlantItem } from '../types';
import { RotateCcw, Hand } from 'lucide-react';

/**
 * 撥開後的倒數小圓圈：自己每 0.1 秒算剩幾秒，只重畫這個小圓圈，
 * 不再讓整個主畫面跟著倒數一直重畫。
 */
const CountdownRing: React.FC<{ pushedAt: number | null; durationSec: number }> = ({
  pushedAt,
  durationSec,
}) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);

  const remaining = pushedAt ? Math.max(0, durationSec - (now - pushedAt) / 1000) : durationSec;
  const strokeDashoffset = 88 * (1 - remaining / durationSec);

  return (
    <>
      {/* Circular progress ring */}
      <div className="relative w-4 h-4 flex items-center justify-center">
        <svg className="w-4 h-4 -rotate-90" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="none" stroke="#262626" strokeWidth="3.5" />
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
        <span className="absolute text-[8px] font-bold text-zinc-200">{Math.ceil(remaining)}</span>
      </div>

      <span className="text-[10px] text-zinc-300 tracking-tight whitespace-nowrap">
        {remaining > 0 ? `${remaining.toFixed(0)}s` : '復位中'}
      </span>
    </>
  );
};

interface PlantProps {
  plant: PlantItem;
  imageSrc?: string;
  invertMirror?: boolean;
  totalDuration: number;
  requiredWaves?: number;
  /** 倒數小圓圈只在設定模式（右鍵叫出）顯示，展示時觀眾看不到 */
  showCountdown?: boolean;
  onPush: (id: string) => void;
  onReset: (id: string) => void;
}

export const Plant: React.FC<PlantProps> = ({
  plant,
  imageSrc,
  invertMirror = false,
  totalDuration,
  requiredWaves = 1,
  showCountdown = false,
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
  // 強制錨定至畫面最外緣並套用 -5% 負邊距，確保底部與左右邊緣植物根莖緊貼螢幕邊框不浮空
  const offsetPercent = plant.horizontalOffsetPercent ?? -5;
  const rootStyle: React.CSSProperties = isBottom
    ? {
        bottom: '-5%',
        [isLeft ? 'left' : 'right']: `${offsetPercent}%`,
        width: '42%',
        height: '29%',
      }
    : {
        top: `${plant.topPercent ?? 20}%`,
        [isLeft ? 'left' : 'right']: `${offsetPercent}%`,
        width: '35%',
        height: '21%',
      };

  return (
    <div
      id={`plant-wrapper-${plant.id}`}
      className="absolute select-none pointer-events-auto z-25 overflow-visible opacity-100"
      style={rootStyle}
    >
      {/* Shared state-driven transition container - always full opacity, GPU transform transition */}
      <div
        id={`plant-motion-${plant.id}`}
        className={`relative cursor-pointer group flex flex-col ${
          isLeft ? 'items-start' : 'items-end'
        } ${
          isBottom ? 'justify-end' : 'justify-start'
        } transition-transform duration-500 ease-out will-change-transform w-full h-full`}
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
          className={`w-full h-full flex ${isBottom ? 'items-end' : 'items-start'} ${
            isLeft ? 'justify-start' : 'justify-end'
          } ${
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
          {/* Mirror flip container: 內部統一靠左對齊，經 scaleX(-1) 翻轉後右側植物亦緊貼右邊界 */}
          <div
            className={`w-full h-full flex ${isBottom ? 'items-end' : 'items-start'} justify-start`}
            style={{
              transform: isMirrored ? 'scaleX(-1)' : 'scaleX(1)',
            }}
          >
            <img
              src={resolvedImage}
              alt={plant.name || `植物素材 - ${isLeft ? '左側' : '右側'}`}
              className={`w-full h-full object-contain ${
                isBottom ? 'object-left-bottom' : 'object-left-top'
              } pointer-events-none select-none`}
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
          {showCountdown && plant.isPushed && (
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
              <CountdownRing pushedAt={plant.pushedAt} durationSec={totalDuration || 10} />

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
