import React, { useEffect, useRef } from 'react';
import { useLandscapeTracking } from '../hooks/useLandscapeTracking';
import { UserCheck, Eye } from 'lucide-react';

interface LandscapeModeProps {
  poses: any[];
  onActiveLandscapeChange?: (activeLandscape: string | null) => void;
}

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
  } = useLandscapeTracking(poses);

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

      {/* 風景圖 1 (對應 Pose 1: 雙手頭頂大圓弧/三角形) */}
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

      {/* 風景圖 2 (對應 Pose 2: 雙手側平舉 T-Pose) */}
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

      {/* 風景圖 3 (對應 Pose 3: 單手高舉指天，另一手放胸前) */}
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
      {/* 高對比放大版風景手勢引導圖示（放大 1.7x+，純上半身動作一眼可辨）       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div
        className={`absolute inset-0 z-40 flex items-center justify-center p-4 sm:p-6 pointer-events-none transition-all duration-500 ease-in-out ${
          hasAnyPoseActive ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-95 scale-100'
        }`}
      >
        <div className="grid grid-cols-3 gap-3 sm:gap-5 max-w-[min(94vw,640px)] w-full">
          {/* Pose 1 圖示卡片：雙手高舉過頭圓弧 */}
          <div className="flex items-center justify-center p-3.5 sm:p-5 rounded-3xl bg-[rgba(10,16,15,0.88)] border-2 border-[#4CA6A8]/85 shadow-[0_8px_24px_rgba(0,0,0,0.65)]">
            <svg
              viewBox="0 0 100 100"
              className="w-20 h-24 sm:w-28 sm:h-32 md:w-32 md:h-36 fill-none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="50" cy="40" r="11" className="stroke-white" strokeWidth="5.5" />
              <line x1="50" y1="52" x2="50" y2="88" className="stroke-white" />
              <path d="M 50 58 Q 16 40 36 14 Q 50 6 50 10" className="stroke-[#7BE0DC]" />
              <path d="M 50 58 Q 84 40 64 14 Q 50 6 50 10" className="stroke-[#7BE0DC]" />
            </svg>
          </div>

          {/* Pose 2 圖示卡片：雙手水平側平舉 T-Pose */}
          <div className="flex items-center justify-center p-3.5 sm:p-5 rounded-3xl bg-[rgba(10,16,15,0.88)] border-2 border-[#4CA6A8]/85 shadow-[0_8px_24px_rgba(0,0,0,0.65)]">
            <svg
              viewBox="0 0 100 100"
              className="w-20 h-24 sm:w-28 sm:h-32 md:w-32 md:h-36 fill-none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="50" cy="28" r="11" className="stroke-white" strokeWidth="5.5" />
              <line x1="50" y1="40" x2="50" y2="88" className="stroke-white" />
              <line x1="8" y1="50" x2="92" y2="50" className="stroke-[#7BE0DC]" />
            </svg>
          </div>

          {/* Pose 3 圖示卡片：單手高舉指天、另一手置於胸前 */}
          <div className="flex items-center justify-center p-3.5 sm:p-5 rounded-3xl bg-[rgba(10,16,15,0.88)] border-2 border-[#4CA6A8]/85 shadow-[0_8px_24px_rgba(0,0,0,0.65)]">
            <svg
              viewBox="0 0 100 100"
              className="w-20 h-24 sm:w-28 sm:h-32 md:w-32 md:h-36 fill-none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="50" cy="28" r="11" className="stroke-white" strokeWidth="5.5" />
              <line x1="50" y1="40" x2="50" y2="88" className="stroke-white" />
              <path d="M 50 50 L 82 14" className="stroke-[#7BE0DC]" />
              <path d="M 50 50 L 26 56 L 42 66" className="stroke-[#7BE0DC]" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandscapeMode;
