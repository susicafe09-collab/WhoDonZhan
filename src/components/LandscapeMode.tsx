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
      {/* 3 張絕對固定於畫面的滿版疊加層（0.7s 平滑淡入淡出，保證單一顯示）     */}
      {/* 使用 object-contain object-center 確保上下兩端圖案 100% 完整無裁切 */}
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
          className="absolute inset-0 w-full h-full object-contain object-center pointer-events-none"
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
          className="absolute inset-0 w-full h-full object-contain object-center pointer-events-none"
        />
      </div>

      {/* 風景圖 3 (對應 Pose 3: 右手高舉，左手放胸前) */}
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
          className="absolute inset-0 w-full h-full object-contain object-center pointer-events-none"
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
      {/* 透明對位參考圖 UI（純圖片圖示，完全去文字化）                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div
        className={`absolute inset-0 z-40 flex items-center justify-center p-4 pointer-events-none transition-all duration-500 ease-in-out ${
          hasAnyPoseActive ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-80 scale-100'
        }`}
      >
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 max-w-[min(86vw,360px)] w-full">
          {/* Pose 1 圖示卡片 */}
          <div className="flex items-center justify-center p-2 rounded-2xl bg-[#141414] border-none shadow-none">
            <svg
              viewBox="0 0 100 120"
              className="w-12 h-16 sm:w-14 sm:h-20 stroke-white/90 fill-none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="50" cy="40" r="10" strokeWidth="3.5" />
              <line x1="50" y1="50" x2="50" y2="85" />
              <path d="M 50 58 Q 20 40 38 18 Q 50 12 50 15" />
              <path d="M 50 58 Q 80 40 62 18 Q 50 12 50 15" />
              <line x1="50" y1="85" x2="35" y2="115" />
              <line x1="50" y1="85" x2="65" y2="115" />
            </svg>
          </div>

          {/* Pose 2 圖示卡片 */}
          <div className="flex items-center justify-center p-2 rounded-2xl bg-[#141414] border-none shadow-none">
            <svg
              viewBox="0 0 100 120"
              className="w-12 h-16 sm:w-14 sm:h-20 stroke-white/90 fill-none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="50" cy="30" r="10" strokeWidth="3.5" />
              <line x1="50" y1="40" x2="50" y2="80" />
              <line x1="12" y1="50" x2="88" y2="50" />
              <line x1="50" y1="80" x2="35" y2="115" />
              <line x1="50" y1="80" x2="65" y2="115" />
            </svg>
          </div>

          {/* Pose 3 圖示卡片 */}
          <div className="flex items-center justify-center p-2 rounded-2xl bg-[#141414] border-none shadow-none">
            <svg
              viewBox="0 0 100 120"
              className="w-12 h-16 sm:w-14 sm:h-20 stroke-white/90 fill-none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="50" cy="30" r="10" strokeWidth="3.5" />
              <line x1="50" y1="40" x2="50" y2="80" />
              <path d="M 50 50 L 78 20" />
              <path d="M 50 50 L 32 55 L 42 62" />
              <line x1="50" y1="80" x2="35" y2="115" />
              <line x1="50" y1="80" x2="65" y2="115" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandscapeMode;
