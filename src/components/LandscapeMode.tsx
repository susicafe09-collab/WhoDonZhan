import React, { useEffect, useRef } from 'react';
import { useLandscapeTracking } from '../hooks/useLandscapeTracking';
import { UserCheck, Eye } from 'lucide-react';

interface LandscapeModeProps {
  poses: any[];
  onActiveLandscapeChange?: (activeLandscape: string | null) => void;
}

// 網址加 &debug 時，畫面左上角即時列出三個手勢每個條件有沒有過（現場調門檻用）
const SHOW_DEBUG = new URLSearchParams(window.location.search).has('debug');

// 預載 3 張風景大圖以防淡入時閃爍
const PRELOAD_LANDSCAPE_IMAGES = [
  '/Mountain_type_1.png',
  '/Mountain_type_2.png',
  '/Mountain_type_3.png',
];

const LandscapeMode: React.FC<LandscapeModeProps> = ({ poses, onActiveLandscapeChange }) => {
  const {
    activePose,
    pose1Opacity,
    pose2Opacity,
    pose3Opacity,
    userDistanceWarning,
    outOfFrameWarning,
    debug,
  } = useLandscapeTracking(poses, SHOW_DEBUG);

  const hasAnyPoseActive = activePose !== null;
  const lastEmittedRef = useRef<string | null>(null);
  const onActiveLandscapeChangeRef = useRef(onActiveLandscapeChange);
  onActiveLandscapeChangeRef.current = onActiveLandscapeChange;

  useEffect(() => {
    let targetLandscape: string | null = null;
    if (activePose === 'pose_1') {
      targetLandscape = 'Mountain_type_1';
    } else if (activePose === 'pose_2') {
      targetLandscape = 'Mountain_type_2';
    } else if (activePose === 'pose_3') {
      targetLandscape = 'Mountain_type_3';
    }

    if (lastEmittedRef.current !== targetLandscape) {
      lastEmittedRef.current = targetLandscape;
      onActiveLandscapeChangeRef.current?.(targetLandscape);
    }
  }, [activePose]);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden z-50">
      {/* 隱藏式預載機制 */}
      <div style={{ display: 'none' }} aria-hidden="true">
        {PRELOAD_LANDSCAPE_IMAGES.map((src) => (
          <img key={src} src={src} alt="preload landscape" />
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 3 張山脈疊加層（0.7s 平滑淡入淡出，單一顯示）                         */}
      {/* 縮小至約 78% 並錨定於畫面中下半部 (bottom: 15%)，保留上方人像與手勢空間 */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* 風景圖 1 (對應 Pose 1: 胸前三角形手勢 ▲) */}
      <div
        className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-700 ease-in-out z-50"
        style={{
          opacity: pose1Opacity,
          willChange: 'opacity',
        }}
      >
        <img
          src="/Mountain_type_1.png"
          alt="Mountain Landscape 1"
          className="absolute left-1/2 -translate-x-1/2 object-contain object-bottom pointer-events-none"
          style={{
            bottom: '15%',
            width: '78%',
            maxWidth: '78vw',
            maxHeight: '55%',
          }}
        />
      </div>

      {/* 風景圖 2 (對應 Pose 2: 下巴前水平一直線手勢 —) */}
      <div
        className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-700 ease-in-out z-50"
        style={{
          opacity: pose2Opacity,
          willChange: 'opacity',
        }}
      >
        <img
          src="/Mountain_type_2.png"
          alt="Mountain Landscape 2"
          className="absolute left-1/2 -translate-x-1/2 object-contain object-bottom pointer-events-none"
          style={{
            bottom: '15%',
            width: '78%',
            maxWidth: '78vw',
            maxHeight: '55%',
          }}
        />
      </div>

      {/* 風景圖 3 (對應 Pose 3: 單手高舉、單手平放的高低錯位手勢) */}
      <div
        className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-700 ease-in-out z-50"
        style={{
          opacity: pose3Opacity,
          willChange: 'opacity',
        }}
      >
        <img
          src="/Mountain_type_3.png"
          alt="Mountain Landscape 3"
          className="absolute left-1/2 -translate-x-1/2 object-contain object-bottom pointer-events-none"
          style={{
            bottom: '15%',
            width: '78%',
            maxWidth: '78vw',
            maxHeight: '55%',
          }}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 「請靠近一點 / 請完整入鏡」防呆距離動態提示                        */}
      {/* 僅在未成功觸發風景手勢時顯示，協助使用者調整站位                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {!hasAnyPoseActive && (userDistanceWarning || outOfFrameWarning) && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-45 flex items-center justify-center pointer-events-none px-4 py-2 rounded-full bg-[#1A1A1A] border-none shadow-none animate-bounce max-w-[90%]"
          style={{ top: 'max(4.5rem, calc(var(--safe-top, 0px) + 4.25rem))' }}
        >
          {userDistanceWarning ? (
            <div className="flex items-center gap-2 text-[#4CA6A8] text-xs sm:text-sm font-semibold tracking-wide whitespace-nowrap">
              <Eye className="w-4 h-4 text-[#4CA6A8] animate-pulse shrink-0" />
              <span>請再靠近一點</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[#D99B43] text-xs sm:text-sm font-semibold tracking-wide whitespace-nowrap">
              <UserCheck className="w-4 h-4 text-[#D99B43] animate-pulse shrink-0" />
              <span>請將上半身與雙手完整入鏡</span>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 高對比放大版風景手勢引導圖示（胸前三角形 / 下巴前水平線 / 雙手一高一低） */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div
        className={`absolute inset-0 z-40 flex items-center justify-center p-4 sm:p-6 pointer-events-none transition-all duration-500 ease-in-out ${
          hasAnyPoseActive ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-95 scale-100'
        }`}
      >
        <div className="grid grid-cols-3 gap-3 sm:gap-5 max-w-[min(94vw,660px)] w-full">
          {/* Pose 1 圖示卡片：胸前三角形 ▲ */}
          <div className="flex flex-col items-center justify-center gap-2 p-3 sm:p-5 rounded-3xl bg-[rgba(10,16,15,0.88)] border-2 border-[#4CA6A8]/85 shadow-[0_8px_24px_rgba(0,0,0,0.65)]">
            <svg
              viewBox="0 0 100 100"
              className="w-20 h-24 sm:w-28 sm:h-32 md:w-32 md:h-36 fill-none"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* 頭部與雙肩輪廓 */}
              <circle cx="50" cy="24" r="10.5" className="stroke-white/85" strokeWidth="4.5" />
              <path d="M 22 52 Q 50 40 78 52" className="stroke-white/55" strokeWidth="4.5" />
              {/* 胸前雙手合攏成倒 V 三角形 ▲（指尖向上相觸、雙腕微開在下） */}
              <path d="M 24 56 L 34 78 L 50 49 L 66 78 L 76 56" className="stroke-[#7BE0DC]" strokeWidth="6" />
              <circle cx="50" cy="49" r="3" className="fill-[#7BE0DC] stroke-none" />
            </svg>
            <span className="text-xs sm:text-sm md:text-base font-bold tracking-wide text-white text-center whitespace-nowrap">
              胸前三角形
            </span>
          </div>

          {/* Pose 2 圖示卡片：下巴前水平線 — */}
          <div className="flex flex-col items-center justify-center gap-2 p-3 sm:p-5 rounded-3xl bg-[rgba(10,16,15,0.88)] border-2 border-[#4CA6A8]/85 shadow-[0_8px_24px_rgba(0,0,0,0.65)]">
            <svg
              viewBox="0 0 100 100"
              className="w-20 h-24 sm:w-28 sm:h-32 md:w-32 md:h-36 fill-none"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* 頭部與雙肩輪廓 */}
              <circle cx="50" cy="24" r="10.5" className="stroke-white/85" strokeWidth="4.5" />
              <path d="M 22 64 Q 50 52 78 64" className="stroke-white/55" strokeWidth="4.5" />
              {/* 下巴正前方雙掌水平連成一直線 —（指尖相觸） */}
              <path d="M 16 46 L 47 46" className="stroke-[#7BE0DC]" strokeWidth="6.5" />
              <path d="M 53 46 L 84 46" className="stroke-[#7BE0DC]" strokeWidth="6.5" />
              <circle cx="50" cy="46" r="3.5" className="fill-[#7BE0DC] stroke-none" />
            </svg>
            <span className="text-xs sm:text-sm md:text-base font-bold tracking-wide text-white text-center whitespace-nowrap">
              下巴前水平線
            </span>
          </div>

          {/* Pose 3 圖示卡片：雙手一高一低 */}
          <div className="flex flex-col items-center justify-center gap-2 p-3 sm:p-5 rounded-3xl bg-[rgba(10,16,15,0.88)] border-2 border-[#4CA6A8]/85 shadow-[0_8px_24px_rgba(0,0,0,0.65)]">
            <svg
              viewBox="0 0 100 100"
              className="w-20 h-24 sm:w-28 sm:h-32 md:w-32 md:h-36 fill-none"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* 頭部與上身輪廓 */}
              <circle cx="50" cy="30" r="10.5" className="stroke-white/85" strokeWidth="4.5" />
              <line x1="50" y1="42" x2="50" y2="86" className="stroke-white/60" strokeWidth="4.5" />
              {/* 一手高舉至頭頂側上方，另一手留在肩胸側邊 */}
              <path d="M 50 50 L 70 40 L 82 14" className="stroke-[#7BE0DC]" strokeWidth="6" />
              <path d="M 50 50 L 28 60 L 14 60" className="stroke-[#7BE0DC]" strokeWidth="6" />
              <circle cx="82" cy="14" r="3.5" className="fill-[#7BE0DC] stroke-none" />
              <circle cx="14" cy="60" r="3.5" className="fill-[#7BE0DC] stroke-none" />
            </svg>
            <span className="text-xs sm:text-sm md:text-base font-bold tracking-wide text-white text-center whitespace-nowrap">
              雙手一高一低
            </span>
          </div>
        </div>
      </div>

      {SHOW_DEBUG && (
        <div className="absolute top-2 left-2 z-[60] rounded-lg bg-black/80 px-2.5 py-2 text-[11px] leading-tight text-white font-mono">
          {debug ? (
            debug.map((d) => (
              <div key={d.pose} className="mb-1.5 last:mb-0">
                <div className={d.matched ? 'text-[#7BE0DC] font-bold' : 'text-zinc-300'}>
                  {d.matched ? '● ' : '○ '}
                  {d.name}
                </div>
                {d.checks.map((c) => (
                  <div key={c.label} className={c.ok ? 'text-zinc-300' : 'text-[#F28B82]'}>
                    {c.ok ? '✓' : '✗'} {c.label}
                    {c.core ? '' : '（次要）'}
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="text-[#F28B82]">沒認到肩膀和兩隻手腕</div>
          )}
        </div>
      )}
    </div>
  );
};

export default LandscapeMode;
