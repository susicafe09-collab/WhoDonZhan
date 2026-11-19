import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useMediaPipe } from '../hooks/useMediaPipe';
import { useLeafHandTracking } from '../hooks/useLeafHandTracking';
import { useRightClickControls } from '../hooks/useRightClickControls';
import {
  VideoCoverProjection,
  IDENTITY_VIDEO_PROJECTION,
  computeVideoCoverProjection,
} from '../utils/videoProjection';
import AnimalMode from './AnimalMode';
import LandscapeMode from './LandscapeMode';
import { Plant } from './Plant';
import LeafBorder from './LeafBorder';
import { PlantItem, MuzhaPlantInfo } from '../types';
import { soundManager } from '../utils/sound';
import { syncSocket } from '../utils/syncSocket';
import { MUZHA_PLANTS_DATA, CONCISE_PLANT_DESCRIPTIONS } from '../data/knowledgeData';
import {
  Mountain,
  Dog,
  Leaf,
  RefreshCw,
  AlertCircle,
  Maximize2,
  Minimize2,
  RotateCcw,
  Hand,
  Clock,
  Settings2,
  Radio,
  ExternalLink,
  BookOpen,
  Sparkles,
  Info,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

export type UnifiedMode = 'leaves' | 'animal' | 'landscape';

interface MediaPipeViewProps {
  initialMode?: UnifiedMode;
}

interface TrackingLayerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  activeMode: UnifiedMode;
  plants: PlantItem[];
  projection: VideoCoverProjection;
  showLoading: boolean;
  onWaveStroke: (plantId: string) => void;
  onActiveAnimalChange: (target: string | null) => void;
  onActiveLandscapeChange: (target: string | null) => void;
}

/**
 * 鏡頭辨識層：MediaPipe 每一格畫面都會更新 poses/faces。
 * 把它們關在這個小元件裡，每格只重畫這裡，外面的大畫面和面板不跟著重畫。
 */
const TrackingLayer = React.memo(function TrackingLayer({
  videoRef,
  activeMode,
  plants,
  projection,
  showLoading,
  onWaveStroke,
  onActiveAnimalChange,
  onActiveLandscapeChange,
}: TrackingLayerProps) {
  const { faces, poses, isLoaded } = useMediaPipe(videoRef, activeMode === 'animal');

  // 撥葉子手勢偵測 (傳入最新直式／橫式畫布投影，確保手勢座標零偏移)
  useLeafHandTracking({
    poses,
    faces,
    plants,
    enabled: activeMode === 'leaves',
    requiredWaveCount: 1,
    projection,
    onWaveStroke,
  });

  return (
    <>
      {!isLoaded && showLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/85">
          <div className="flex flex-col items-center dark-glow-card px-6 py-5 rounded-3xl">
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-8 h-8 border-3 border-t-[#28887A] border-r-[#28887A] border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              <p className="mt-3 text-white font-semibold text-xs tracking-wider">
                載入 MediaPipe 姿態識別中...
              </p>
              <p className="text-[11px] text-[#4CA6A8] mt-0.5">本地端模組秒速載入中</p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Mode: 動物互動模式 (傳入 videoProjection 確保直式／橫式頭飾座標精準貼合) */}
      {activeMode === 'animal' && (
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          <AnimalMode
            faces={faces}
            poses={poses}
            projection={projection}
            onActiveAnimalChange={onActiveAnimalChange}
          />
        </div>
      )}

      {/* 3. Mode: 風景手勢模式 (z-50 頂層獨立透明度渲染，含距離提示與第二螢幕同步) */}
      {activeMode === 'landscape' && (
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          <LandscapeMode poses={poses} onActiveLandscapeChange={onActiveLandscapeChange} />
        </div>
      )}
    </>
  );
});

export const MediaPipeView: React.FC<MediaPipeViewProps> = ({
  initialMode = 'leaves',
}) => {
  // Mode selection: all 3 modes integrated in the SAME switching window
  const [activeMode, setActiveMode] = useState<UnifiedMode>(initialMode);

  // 當前大螢幕觸發並展示的目標（動物代號、山嶽代號、或葉片撥開狀態），同步給平板顯示知識看板
  const [activeAnimalTarget, setActiveAnimalTarget] = useState<string | null>(null);
  const [activeLandscapeTarget, setActiveLandscapeTarget] = useState<string | null>(null);

  // 手動強制 Override 目標（若有設定，將優先發送）
  const [manualOverrideTarget, setManualOverrideTarget] = useState<string | null>(null);

  // Camera stream refs & state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // 原生 Fullscreen 狀態 (跨瀏覽器監聽同步)
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 展示模式：平常不顯示任何按鈕面板，接滑鼠按右鍵才叫出設定
  const showControls = useRightClickControls();
  const immersive = isFullscreen || !showControls;


  // 底部平板測試抽屜（預設收合，避免遮擋中央互動區）
  const [showPortraitOverride, setShowPortraitOverride] = useState(false);

  // 互動畫布與視訊 object-fit: cover 精確座標投影狀態（確保旋轉直式後追蹤座標零偏移）
  const [videoProjection, setVideoProjection] = useState<VideoCoverProjection>(
    IDENTITY_VIDEO_PROJECTION
  );

  const recalcVideoProjection = useCallback(() => {
    const stageEl = stageRef.current;
    const videoEl = videoRef.current;
    if (!stageEl) return;

    const rect = stageEl.getBoundingClientRect();
    const stageW = rect.width;
    const stageH = rect.height;
    const videoW = videoEl?.videoWidth || 0;
    const videoH = videoEl?.videoHeight || 0;

    if (stageW <= 0 || stageH <= 0) return;

    const next =
      videoW > 0 && videoH > 0
        ? computeVideoCoverProjection(videoW, videoH, stageW, stageH)
        : IDENTITY_VIDEO_PROJECTION;

    setVideoProjection((prev) => {
      if (
        prev.videoWidth === next.videoWidth &&
        prev.videoHeight === next.videoHeight &&
        Math.abs(prev.stageWidth - next.stageWidth) < 1 &&
        Math.abs(prev.stageHeight - next.stageHeight) < 1
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  // Sound and settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoReturnSeconds, setAutoReturnSeconds] = useState<number>(10); // 預設 10 秒自動復原
  const [showSettings, setShowSettings] = useState(false);
  const [showPlantInfoModal, setShowPlantInfoModal] = useState(false);

  // 穩定的回調函式，避免子元件每幀重渲染
  const handleActiveAnimalChange = useCallback((target: string | null) => {
    setActiveAnimalTarget((prev) => (prev !== target ? target : prev));
  }, []);

  const handleActiveLandscapeChange = useCallback((target: string | null) => {
    setActiveLandscapeTarget((prev) => (prev !== target ? target : prev));
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 互動植物圖庫池（木柵貓空 3 種植物生態組合：地板 1 種、側邊 2 種）：
  // 1. 側邊池（Group C 懸掛）：樟樹步道・樟楠樹冠、貓空野徑・垂懸藤葉、百年老樹・垂懸崖薑蕨
  // 2. 地板池：木柵特產・破土綠竹筍、貓空步道・高山箭竹、銀河洞溪谷・闊葉水龍骨、茶山地被・叢生腎蕨
  // ─────────────────────────────────────────────────────────────
  const SIDE_PLANT_POOLS = [
    { imageSrc: '/leaves.png', name: '樟樹步道・樟楠樹冠', group: 'C' as const },
    { imageSrc: '/leaves_ground_5.png', name: '貓空野徑・垂懸藤葉', group: 'C' as const },
    { imageSrc: '/leaves_ground_6.png', name: '百年老樹・垂懸崖薑蕨', group: 'C' as const },
  ];

  const BOTTOM_PLANT_POOLS = [
    { imageSrc: '/leaves_ground_4.png', name: '木柵特產・破土綠竹筍', group: 'B' as const },
    { imageSrc: '/leaves_ground_3.png', name: '貓空步道・高山箭竹', group: 'B' as const },
    { imageSrc: '/leaves_ground_1.png', name: '銀河洞溪谷・闊葉水龍骨', group: 'A' as const },
    { imageSrc: '/leaves_ground_2.png', name: '茶山地被・叢生腎蕨', group: 'A' as const },
  ];

  const pickRandomSidePlant = (currentSrc?: string, excludeSrc?: string) => {
    const choices = SIDE_PLANT_POOLS.filter(
      (p) => p.imageSrc !== currentSrc && p.imageSrc !== excludeSrc
    );
    const pool = choices.length > 0 ? choices : SIDE_PLANT_POOLS;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const pickRandomBottomPlant = (currentSrc?: string) => {
    const choices = currentSrc
      ? BOTTOM_PLANT_POOLS.filter((p) => p.imageSrc !== currentSrc)
      : BOTTOM_PLANT_POOLS;
    const pool = choices.length > 0 ? choices : BOTTOM_PLANT_POOLS;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // ─────────────────────────────────────────────────────────────
  // 植物槽位配置（底部左右兩側各一株，上方左右側各兩株，無重疊）：
  // 1. side-left-1: 側邊左上（top 17%）
  // 2. side-left-2: 側邊左中（top 50%）
  // 3. side-right-1: 側邊右上（top 17%）
  // 4. side-right-2: 側邊右中（top 50%）
  // 5. bottom-left: 底部左下（bottom 0）
  // 6. bottom-right: 底部右下（bottom 0）
  // ─────────────────────────────────────────────────────────────
  // 植物槽位配置（依使用者紅框標示精確調整佈局，側邊與底部植物各就其位且絕不重疊）：
  // 1. side-left-1: 側邊左上（top 15.2%，避開上方綠葉樹冠，寬度 31%）
  // 2. side-left-2: 側邊左中（top 35.2%，位於左上植物下方，寬度 31%）
  // 3. side-right-1: 側邊右上（top 20.0%，避開右上方樹冠與粉紅花穗，寬度 31%）
  // 4. side-right-2: 側邊右中（top 44.5%，位於右上植物下方，寬度 31%）
  // 5. bottom-left: 底部左下（bottom 0，寬度 37%）
  // 6. bottom-right: 底部右下（bottom 0，寬度 37%）
  // ─────────────────────────────────────────────────────────────
  const [plants, setPlants] = useState<PlantItem[]>([
    // 【側邊左上 - 紅色線框 1】
    {
      id: 'side-left-1',
      group: 'C',
      imageSrc: '/leaves_ground_5.png',
      name: '貓空野徑・垂懸藤葉',
      side: 'left',
      index: 0,
      positionType: 'hanging',
      topPercent: 15.2,
      horizontalOffsetPercent: 1,
      scale: 0.95,
      baseRotate: 0,
      isPushed: false,
      pushedAt: null,
      remainingSeconds: 10,
      displaceAngle: -4,
      displaceX: 0,
      displaceY: 0,
      waveCount: 0,
      lastWaveAt: 0,
      resetCount: 0,
    },
    // 【側邊左中 - 紅色線框 2】
    {
      id: 'side-left-2',
      group: 'C',
      imageSrc: '/leaves.png',
      name: '樟樹步道・樟楠樹冠',
      side: 'left',
      index: 1,
      positionType: 'hanging',
      topPercent: 35.2,
      horizontalOffsetPercent: 1,
      scale: 0.95,
      baseRotate: 0,
      isPushed: false,
      pushedAt: null,
      remainingSeconds: 10,
      displaceAngle: -4,
      displaceX: 0,
      displaceY: 0,
      waveCount: 0,
      lastWaveAt: 0,
      resetCount: 0,
    },
    // 【側邊右上 - 紅色線框 3】
    {
      id: 'side-right-1',
      group: 'C',
      imageSrc: '/leaves_ground_6.png',
      name: '百年老樹・垂懸崖薑蕨',
      side: 'right',
      index: 2,
      positionType: 'hanging',
      topPercent: 20.0,
      horizontalOffsetPercent: 0.5,
      scale: 0.95,
      baseRotate: 0,
      isPushed: false,
      pushedAt: null,
      remainingSeconds: 10,
      displaceAngle: 4,
      displaceX: 0,
      displaceY: 0,
      waveCount: 0,
      lastWaveAt: 0,
      resetCount: 0,
    },
    // 【側邊右中 - 紅色線框 4】
    {
      id: 'side-right-2',
      group: 'C',
      imageSrc: '/leaves_ground_5.png',
      name: '貓空野徑・垂懸藤葉',
      side: 'right',
      index: 3,
      positionType: 'hanging',
      topPercent: 44.5,
      horizontalOffsetPercent: 0.5,
      scale: 0.95,
      baseRotate: 0,
      isPushed: false,
      pushedAt: null,
      remainingSeconds: 10,
      displaceAngle: 4,
      displaceX: 0,
      displaceY: 0,
      waveCount: 0,
      lastWaveAt: 0,
      resetCount: 0,
    },
    // 【底部左下 - 紅色線框 5】
    {
      id: 'bottom-left',
      group: 'A',
      imageSrc: '/leaves_ground_1.png',
      name: '銀河洞溪谷・闊葉水龍骨',
      side: 'left',
      index: 4,
      positionType: 'bottom',
      horizontalOffsetPercent: 2,
      scale: 0.95,
      baseRotate: 0,
      isPushed: false,
      pushedAt: null,
      remainingSeconds: 10,
      displaceAngle: -6,
      displaceX: 0,
      displaceY: 0,
      waveCount: 0,
      lastWaveAt: 0,
      resetCount: 0,
    },
    // 【底部右下 - 紅色線框 6】
    {
      id: 'bottom-right',
      group: 'B',
      imageSrc: '/leaves_ground_4.png',
      name: '木柵特產・破土綠竹筍',
      side: 'right',
      index: 5,
      positionType: 'bottom',
      horizontalOffsetPercent: 0.5,
      scale: 0.95,
      baseRotate: 0,
      isPushed: false,
      pushedAt: null,
      remainingSeconds: 10,
      displaceAngle: 6,
      displaceX: 0,
      displaceY: 0,
      waveCount: 0,
      lastWaveAt: 0,
      resetCount: 0,
    },
  ]);

  // 提前預載所有 7 款植物圖檔，防止替換植物時出現瀏覽器非同步解碼白閃或延遲跳圖
  useEffect(() => {
    const allPlantImages = [
      '/leaves.png',
      '/leaves_ground_1.png',
      '/leaves_ground_2.png',
      '/leaves_ground_3.png',
      '/leaves_ground_4.png',
      '/leaves_ground_5.png',
      '/leaves_ground_6.png',
    ];
    allPlantImages.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // 始終維持 6 種植物槽位（底部左右各一株，上方左右側各兩株，無重疊）
  const visiblePlants = plants;

  // 判斷當前是否至少有一株可見葉片處於被撥開（isPushed）狀態
  const hasAnyLeafPushed = visiblePlants.some((p) => p.isPushed);

  // 當前畫面上出現的三種植物詳細生態資料（即時同步木柵貓空茶山生態誌）
  const currentActivePlants: MuzhaPlantInfo[] = useMemo(() => {
    return plants.map((p) => {
      const detail = MUZHA_PLANTS_DATA[p.imageSrc] || {
        imageSrc: p.imageSrc,
        name: p.name || '貓空植被',
        scientificName: 'Flora of Muzha Maokong',
        categoryLabel: p.positionType === 'bottom' ? '地板植物' : '側邊植物',
        muzhaSpot: '木柵貓空茶山林下',
        muzhaRelation: '生長於木柵茶園林下與溪谷，守護茶山水土。',
        description: '木柵貓空指標植被。',
        funFact: '涵養茶山水土，凝聚晨昏山嵐。',
      };
      return {
        id: p.id,
        name: detail.name,
        scientificName: detail.scientificName,
        categoryLabel: detail.categoryLabel,
        imageSrc: p.imageSrc,
        muzhaSpot: detail.muzhaSpot,
        muzhaRelation: detail.muzhaRelation,
        description: detail.description,
        funFact: detail.funFact,
        tags: detail.tags || [],
      };
    });
  }, [plants]);

  // ─────────────────────────────────────────────────────────────
  // 雙螢幕同步發送邏輯 (Socket.io Second Screen Sync)
  // 當模式改變、動物出現、山嶽手勢或葉片撥開時，即時廣播給平板展示專屬故事
  // 包含當前大螢幕正在出現的三種植物詳細資料與木柵貓空風土關係
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let target: string | null = null;
    if (manualOverrideTarget) {
      target = manualOverrideTarget;
    } else if (activeMode === 'leaves') {
      target = hasAnyLeafPushed ? 'leaf_parted' : null;
    } else if (activeMode === 'animal') {
      target = activeAnimalTarget;
    } else if (activeMode === 'landscape') {
      target = activeLandscapeTarget;
    } else {
      target = null;
    }

    syncSocket.emitSyncState({
      mode: activeMode,
      target: target,
      activePlants: currentActivePlants,
    });
  }, [
    activeMode,
    activeAnimalTarget,
    activeLandscapeTarget,
    hasAnyLeafPushed,
    manualOverrideTarget,
    currentActivePlants,
  ]);

  // 手動快速測試連動按鈕觸發函數
  const handleManualSyncTest = (target: string | null, targetMode?: UnifiedMode) => {
    if (targetMode && targetMode !== activeMode) {
      setActiveMode(targetMode);
    }
    setManualOverrideTarget(target);

    syncSocket.emitSyncState(
      {
        mode: targetMode || activeMode,
        target: target,
      },
      true // force override
    );
  };

  // ─────────────────────────────────────────────────────────────
  // 真正全螢幕 (HTML5 Fullscreen API) 跨瀏覽器支援 (iOS/iPadOS/Chrome/Safari)
  // ─────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    const doc = document as any;
    const isCurrentlyFullscreen = Boolean(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    if (!isCurrentlyFullscreen) {
      const elem = viewportRef.current as any;
      if (elem) {
        try {
          if (elem.requestFullscreen) {
            await elem.requestFullscreen();
          } else if (elem.webkitRequestFullscreen) {
            await elem.webkitRequestFullscreen();
          } else if (elem.mozRequestFullScreen) {
            await elem.mozRequestFullScreen();
          } else if (elem.msRequestFullscreen) {
            await elem.msRequestFullscreen();
          } else {
            setIsFullscreen(true);
          }
        } catch {
          setIsFullscreen(true);
        }
      } else {
        setIsFullscreen(true);
      }
    } else {
      try {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      } catch {
        // Fallback
      }
      setIsFullscreen(false);
    }
  }, []);

  // 監聽 fullscreenchange / webkitfullscreenchange 事件，精準同步 React 狀態
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isNowFullscreen = Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(isNowFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Handle hand wave gesture stroke detected on a plant
  const handleWaveStroke = useCallback(
    (plantId: string) => {
      const now = Date.now();
      setPlants((prev) => {
        const target = prev.find((p) => p.id === plantId);
        if (!target || target.isPushed) return prev;

        const nextCount = target.waveCount + 1;
        const isTriggered = nextCount >= 1;

        if (isTriggered) {
          if (soundEnabled) {
            soundManager.playRustle();
          }
          return prev.map((p) =>
            p.id === plantId
              ? {
                  ...p,
                  isPushed: true,
                  pushedAt: now,
                  remainingSeconds: autoReturnSeconds,
                  waveCount: 0,
                  lastWaveAt: now,
                }
              : p
          );
        } else {
          if (soundEnabled) {
            soundManager.playWaveBrush();
          }
          return prev.map((p) =>
            p.id === plantId
              ? {
                  ...p,
                  waveCount: nextCount,
                  lastWaveAt: now,
                }
              : p
          );
        }
      });
    },
    [autoReturnSeconds, soundEnabled]
  );

  // Push / Part a plant directly (click/touch fallback)
  const handlePushPlant = useCallback(
    (plantId: string) => {
      const now = Date.now();
      setPlants((prev) => {
        const target = prev.find((p) => p.id === plantId);
        if (target?.isPushed) {
          if (soundEnabled) {
            soundManager.playRestore();
          }
          return prev.map((p) => {
            if (p.id !== plantId) return p;
            const isBottom = p.positionType === 'bottom';
            const randomChoice = isBottom
              ? pickRandomBottomPlant(p.imageSrc)
              : pickRandomSidePlant(p.imageSrc);

            return {
              ...p,
              imageSrc: randomChoice.imageSrc,
              name: randomChoice.name,
              group: randomChoice.group,
              isPushed: false,
              pushedAt: null,
              remainingSeconds: autoReturnSeconds,
              waveCount: 0,
              resetCount: (p.resetCount || 0) + 1,
            };
          });
        }

        if (soundEnabled) {
          soundManager.playRustle();
        }
        return prev.map((p) =>
          p.id === plantId
            ? {
                ...p,
                isPushed: true,
                pushedAt: now,
                remainingSeconds: autoReturnSeconds,
                waveCount: 0,
                lastWaveAt: now,
              }
            : p
        );
      });
    },
    [autoReturnSeconds, soundEnabled]
  );

  // Reset a specific plant manually (換種復位)
  const handleResetPlant = useCallback(
    (plantId: string) => {
      if (soundEnabled) {
        soundManager.playRestore();
      }
      setPlants((prev) =>
        prev.map((p) => {
          if (p.id !== plantId) return p;
          const isBottom = p.positionType === 'bottom';
          const randomChoice = isBottom
            ? pickRandomBottomPlant(p.imageSrc)
            : pickRandomSidePlant(p.imageSrc);

          return {
            ...p,
            imageSrc: randomChoice.imageSrc,
            name: randomChoice.name,
            group: randomChoice.group,
            isPushed: false,
            pushedAt: null,
            remainingSeconds: autoReturnSeconds,
            waveCount: 0,
            resetCount: (p.resetCount || 0) + 1,
          };
        })
      );
    },
    [autoReturnSeconds, soundEnabled]
  );

  // Push All Leaves Quick Action (統一向外撥開物理動效)
  const handlePushAll = useCallback(() => {
    const now = Date.now();
    if (soundEnabled) {
      soundManager.playRustle();
    }
    setPlants((prev) =>
      prev.map((p) => ({
        ...p,
        isPushed: true,
        pushedAt: now,
        remainingSeconds: autoReturnSeconds,
        waveCount: 0,
        lastWaveAt: now,
      }))
    );
  }, [autoReturnSeconds, soundEnabled]);

  // Reset All Leaves Quick Action (全部隨機換裝復位：底部 2 株＋左右各 2 株不重疊)
  const handleResetAll = useCallback(() => {
    if (soundEnabled) {
      soundManager.playRestore();
    }

    // 地板左右兩側選取不同植物
    const bottomChoices = [...BOTTOM_PLANT_POOLS].sort(() => Math.random() - 0.5);
    const bottomLeftChoice = bottomChoices[0];
    const bottomRightChoice = bottomChoices[1] || bottomChoices[0];

    // 側邊上、中選取不同植物
    const sideChoices1 = [...SIDE_PLANT_POOLS].sort(() => Math.random() - 0.5);
    const leftTopChoice = sideChoices1[0];
    const leftMidChoice = sideChoices1[1] || sideChoices1[0];

    const sideChoices2 = [...SIDE_PLANT_POOLS].sort(() => Math.random() - 0.5);
    const rightTopChoice = sideChoices2[0];
    const rightMidChoice = sideChoices2[1] || sideChoices2[0];

    setPlants((prev) =>
      prev.map((p) => {
        let randomChoice;
        if (p.id === 'bottom-left') {
          randomChoice = bottomLeftChoice;
        } else if (p.id === 'bottom-right') {
          randomChoice = bottomRightChoice;
        } else if (p.id === 'side-left-1') {
          randomChoice = leftTopChoice;
        } else if (p.id === 'side-left-2') {
          randomChoice = leftMidChoice;
        } else if (p.id === 'side-right-1') {
          randomChoice = rightTopChoice;
        } else {
          randomChoice = rightMidChoice;
        }

        return {
          ...p,
          imageSrc: randomChoice.imageSrc,
          name: randomChoice.name,
          group: randomChoice.group,
          isPushed: false,
          pushedAt: null,
          remainingSeconds: autoReturnSeconds,
          waveCount: 0,
          resetCount: (p.resetCount || 0) + 1,
        };
      })
    );
  }, [autoReturnSeconds, soundEnabled]);

  // Periodic Timer: Countdown pushed plants and return them automatically with random swap (10秒復位)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      setPlants((prev) => {
        let hasChanges = false;
        const updated = prev.map((plant) => {
          if (plant.isPushed && plant.pushedAt) {
            const elapsedSeconds = (now - plant.pushedAt) / 1000;
            const remaining = Math.max(0, autoReturnSeconds - elapsedSeconds);

            if (remaining <= 0) {
              hasChanges = true;
              if (soundEnabled) {
                soundManager.playRestore();
              }
              const isBottom = plant.positionType === 'bottom';
              let randomChoice;
              if (isBottom) {
                const otherBottom = prev.find(
                  (op) => op.id !== plant.id && op.positionType === 'bottom'
                );
                randomChoice = pickRandomBottomPlant(plant.imageSrc);
                if (otherBottom && randomChoice.imageSrc === otherBottom.imageSrc) {
                  const altChoices = BOTTOM_PLANT_POOLS.filter(
                    (bp) => bp.imageSrc !== otherBottom.imageSrc
                  );
                  if (altChoices.length > 0) {
                    randomChoice = altChoices[Math.floor(Math.random() * altChoices.length)];
                  }
                }
              } else {
                // 懸掛側邊：避免與同側另一株植物相同
                const neighborSameSide = prev.find(
                  (op) => op.id !== plant.id && op.side === plant.side && op.positionType === 'hanging'
                );
                randomChoice = pickRandomSidePlant(plant.imageSrc, neighborSameSide?.imageSrc);
              }

              return {
                ...plant,
                imageSrc: randomChoice.imageSrc,
                name: randomChoice.name,
                group: randomChoice.group,
                isPushed: false,
                pushedAt: null,
                remainingSeconds: autoReturnSeconds,
                waveCount: 0,
                resetCount: (plant.resetCount || 0) + 1,
              };
            }
            // 倒數數字由 Plant 裡的倒數小圓圈自己算，不在這裡每 80ms 更新整頁
          }

          return plant;
        });

        return hasChanges ? updated : prev;
      });
    }, 80);

    return () => clearInterval(interval);
  }, [autoReturnSeconds, soundEnabled]);

  // Start / Maintain Camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('此瀏覽器環境不支援攝影機存取');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((e) => console.warn('Play interrupted:', e));
          setHasCamera(true);
          recalcVideoProjection();
        };
      }
    } catch (err: any) {
      console.warn('Camera access notice:', err);
      const isPermissionDenied =
        err?.name === 'NotAllowedError' ||
        err?.message?.includes('Permission denied') ||
        err?.message?.includes('PermissionDeniedError');
      const errMsg = isPermissionDenied
        ? '相機權限未開放（已為您啟動展示模擬模式，可直接點擊葉片或使用面板測試）'
        : '未偵測到攝影機（已啟用展示模擬模式）';
      setCameraError(errMsg);
      setHasCamera(false);
    }
  }, [recalcVideoProjection]);

  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // 叫出／收起設定或進出全螢幕後，重算鏡頭畫面和互動座標的對應
  useEffect(() => {
    const timer = window.setTimeout(recalcVideoProjection, 60);
    return () => window.clearTimeout(timer);
  }, [immersive, recalcVideoProjection]);

  // 透過 ResizeObserver 與 video resize 即時追蹤互動畫布尺寸變化，確保互動座標精準對齊
  useEffect(() => {
    const stageEl = stageRef.current;
    const videoEl = videoRef.current;

    recalcVideoProjection();

    let ro: ResizeObserver | null = null;
    if (stageEl && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        recalcVideoProjection();
      });
      ro.observe(stageEl);
    }

    const handleVideoResize = () => recalcVideoProjection();
    videoEl?.addEventListener('resize', handleVideoResize);
    videoEl?.addEventListener('loadedmetadata', handleVideoResize);

    return () => {
      ro?.disconnect();
      videoEl?.removeEventListener('resize', handleVideoResize);
      videoEl?.removeEventListener('loadedmetadata', handleVideoResize);
    };
  }, [recalcVideoProjection]);

  return (
    <div
      className="relative w-screen h-[100dvh] font-sans select-none overflow-hidden bg-[#0A0A0A] flex items-center justify-center"
    >
      {/* ───────────────────────────────────────────────────────────── */}
      {/* Child 1：頂部導覽與三大模式切換群組（浮在畫面最上方）             */}
      {/* ───────────────────────────────────────────────────────────── */}
      {!immersive && (
        <div
          className="flex flex-col gap-1.5 fixed top-0 left-0 right-0 z-55 portrait-safe-top items-center pointer-events-none"
        >
          <header
            className="w-full max-w-[680px] flex items-center justify-between px-3.5 sm:px-4 py-2 dark-glow-card rounded-2xl text-zinc-300 pointer-events-auto"
          >
            <div className="flex items-center gap-2 relative z-10 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-[#28887A] shrink-0" />
              <h1 className="text-sm sm:text-base font-medium tracking-wide text-white truncate">
                {activeMode === 'leaves'
                  ? '撥開葉子 (手部互動)'
                  : activeMode === 'animal'
                  ? '動物互動模式'
                  : '風景手勢模式'}
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#0E5A4E] text-[#4CA6A8] hidden md:inline shrink-0">
                MediaPipe Vision
              </span>
            </div>

            {/* Action icons */}
            <div className="flex items-center gap-1.5 text-xs relative z-10 shrink-0">
              {activeMode === 'leaves' && (
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                    showSettings
                      ? 'btn-dark-glow-active'
                      : 'btn-dark-glow-inactive'
                  }`}
                  title="撥開葉子參數設定"
                >
                  <Settings2 className="w-3.5 h-3.5 text-white" />
                </button>
              )}

              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-xl btn-dark-glow-inactive text-[#4CA6A8] hover:text-white cursor-pointer"
                title="進入純淨全螢幕 (True Fullscreen)"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>

          {/* 外部三大模式切換選單 */}
          <div className="w-full max-w-[680px] pointer-events-auto">
            <div className="dark-glow-card p-1.5 rounded-2xl flex items-center gap-1.5 justify-between">
              <button
                id="mode-tab-leaves"
                onClick={() => {
                  setActiveMode('leaves');
                  setManualOverrideTarget(null);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-medium relative z-10 transition-all duration-300 cursor-pointer ${
                  activeMode === 'leaves'
                    ? 'btn-dark-glow-active'
                    : 'btn-dark-glow-inactive'
                }`}
              >
                <Leaf className={`w-3.5 h-3.5 shrink-0 ${activeMode === 'leaves' ? 'text-white' : 'text-zinc-400'}`} />
                <span className="whitespace-nowrap">撥開葉子</span>
              </button>

              <button
                id="mode-tab-animal"
                onClick={() => {
                  setActiveMode('animal');
                  setManualOverrideTarget(null);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-medium relative z-10 transition-all duration-300 cursor-pointer ${
                  activeMode === 'animal'
                    ? 'btn-dark-glow-active'
                    : 'btn-dark-glow-inactive'
                }`}
              >
                <Dog className={`w-3.5 h-3.5 shrink-0 ${activeMode === 'animal' ? 'text-white' : 'text-zinc-400'}`} />
                <span className="whitespace-nowrap">動物互動</span>
              </button>

              <button
                id="mode-tab-landscape"
                onClick={() => {
                  setActiveMode('landscape');
                  setManualOverrideTarget(null);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-medium relative z-10 transition-all duration-300 cursor-pointer ${
                  activeMode === 'landscape'
                    ? 'btn-dark-glow-active'
                    : 'btn-dark-glow-inactive'
                }`}
              >
                <Mountain className={`w-3.5 h-3.5 shrink-0 ${activeMode === 'landscape' ? 'text-white' : 'text-zinc-400'}`} />
                <span className="whitespace-nowrap">風景手勢</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* Child 2：Main AR Camera Viewport Window (始終保持同一節點不重掛) */}
      {/* 不管螢幕橫放直放，都在正中間放一塊 9:16 直立畫面（直立 1080×1920 剛好滿版） */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div
        ref={viewportRef}
        id="unified-ar-viewport"
        className="fixed inset-0 z-10 w-screen h-[100dvh] overflow-hidden flex items-center justify-center bg-black"
      >
        {/* 內層舞台容器 (stageRef)：透過 ResizeObserver 同步最新寬高與投影比例 */}
        <div
          ref={stageRef}
          className="relative h-full w-auto max-w-full aspect-[9/16] overflow-hidden flex items-center justify-center bg-black"
        >
          {/* 全螢幕時的退出按鈕（進入全螢幕的按鈕在頂部導覽列） */}
          {showControls && isFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="absolute z-55 p-2.5 rounded-full bg-[#1A1A1A] hover:bg-[#28887A] text-[#4CA6A8] hover:text-white border-none shadow-none transition-all duration-200 active:scale-90 pointer-events-auto cursor-pointer"
              style={{
                top: isFullscreen ? 'max(1rem, var(--safe-top, 0px))' : '1rem',
                right: isFullscreen ? 'max(1rem, var(--safe-right, 0px))' : '1rem',
              }}
              title={isFullscreen ? '退出全螢幕 (Esc)' : '進入真正全螢幕 (True Fullscreen)'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-inherit" />
              ) : (
                <Maximize2 className="w-4 h-4 text-inherit" />
              )}
            </button>
          )}

          {/* Camera Notice Toast Banner (Non-blocking, allows full interaction) */}
          {showControls && cameraError && (
            <div
              className="absolute left-4 right-4 sm:right-14 z-45 flex items-center justify-between gap-2 px-3 py-2 rounded-xl dark-glow-card text-zinc-100 text-xs animate-fade-in pointer-events-auto"
              style={{
                top:
                  !immersive
                    ? 'calc(var(--safe-top, 0px) + 6.8rem)'
                    : '1rem',
              }}
            >
              <div className="flex items-center gap-2 overflow-hidden relative z-10">
                <AlertCircle className="w-4 h-4 text-[#D99B43] shrink-0" />
                <span className="truncate text-[11px] sm:text-xs text-zinc-200">
                  {cameraError}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 relative z-10">
                <button
                  onClick={startCamera}
                  className="px-2.5 py-1 rounded-lg btn-dark-glow-active text-[10.5px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 text-white" />
                  <span>重試</span>
                </button>
                <button
                  onClick={() => setCameraError(null)}
                  className="px-1.5 py-0.5 rounded-lg text-zinc-400 hover:text-white text-xs cursor-pointer"
                  title="關閉提示"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Camera fallback background */}
          {!hasCamera && (
            <div className="absolute inset-0 w-full h-full pointer-events-none bg-[#0A0A0A] overflow-hidden" />
          )}

          {/* Shared Live Video Element (Mirrored, object-fit: cover object-center 居中滿版不變形) */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover object-center -scale-x-100 pointer-events-none"
            autoPlay
            playsInline
            muted
          />

          {/* 1. Mode: 撥開葉子（6 株互動植物槽位分居側邊與底部兩角，全不透明渲染） */}
          {activeMode === 'leaves' && (
            <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden opacity-100">
              {visiblePlants.map((plant) => (
                <Plant
                  key={plant.id}
                  plant={plant}
                  imageSrc={plant.imageSrc}
                  invertMirror={false}
                  totalDuration={autoReturnSeconds}
                  requiredWaves={1}
                  onPush={handlePushPlant}
                  onReset={handleResetPlant}
                />
              ))}
            </div>
          )}

          {/* 鏡頭辨識層：每一格畫面的更新只重畫這一層，不會整頁重畫 */}
          <TrackingLayer
            videoRef={videoRef}
            activeMode={activeMode}
            plants={visiblePlants}
            projection={videoProjection}
            showLoading={hasCamera && !cameraError}
            onWaveStroke={handleWaveStroke}
            onActiveAnimalChange={handleActiveAnimalChange}
            onActiveLandscapeChange={handleActiveLandscapeChange}
          />

          {/* 各項互動功能的頂層邊框 (100% 完全實色不透明，無透明度效果)：
              1. 撥開葉子：boarder_top.png, boarder_side_left.png, boarder_side_right.png
              2. 動物互動：animals_boarder.webp
              3. 風景手勢：scene_boarder.png */}
          <LeafBorder activeMode={activeMode} />
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* Child 3：控制與連動測試面板（浮在畫面最下方，測試按鈕可收合）    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {!immersive && (
        <div
          className="flex flex-col items-center gap-1.5 fixed bottom-0 left-0 right-0 z-55 portrait-safe-bottom pointer-events-none"
        >
          <div className="w-full max-w-[680px] flex flex-col gap-1.5 pointer-events-auto">
          {/* 撥開葉子專屬參數抽屜與動作 */}
          {activeMode === 'leaves' && (
            <>
              {showSettings && (
                <div className="w-full dark-glow-card rounded-2xl p-2.5 animate-fade-in text-xs text-zinc-300 mb-0.5 border-none shadow-none">
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800 mb-1.5 relative z-10">
                    <span className="text-xs font-medium text-white flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#D99B43]" />
                      撥開後自動移回時間
                    </span>
                    <span className="text-[#D99B43] font-mono font-medium">
                      {autoReturnSeconds} 秒
                    </span>
                  </div>
                  <div className="flex gap-1.5 pt-0.5 relative z-10">
                    {[5, 10, 15, 20, 30].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => setAutoReturnSeconds(sec)}
                        className={`flex-1 py-1 rounded-lg text-center font-mono text-[11px] transition-all cursor-pointer ${
                          autoReturnSeconds === sec
                            ? 'btn-dark-glow-active'
                            : 'btn-dark-glow-inactive'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="w-full flex items-center justify-between gap-1.5 p-1.5 dark-glow-card rounded-2xl border-none shadow-none">
                <button
                  id="btn-push-all-leaves"
                  onClick={handlePushAll}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl btn-dark-glow-active text-xs font-medium relative z-10 transition-all active:scale-95 cursor-pointer"
                >
                  <Hand className="w-3.5 h-3.5 text-white" />
                  <span>撥開全部</span>
                </button>

                <button
                  id="btn-reset-all-leaves"
                  onClick={handleResetAll}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl btn-dark-glow-inactive text-xs font-medium relative z-10 transition-all active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                  <span>重置全部</span>
                </button>

                <button
                  id="btn-muzha-plants-info"
                  onClick={() => setShowPlantInfoModal(true)}
                  className="px-3 py-2 rounded-xl btn-dark-glow-inactive text-xs font-medium relative z-10 transition-all active:scale-95 cursor-pointer text-[#4CA6A8] hover:text-white flex items-center gap-1.5"
                  title="查看當前 3 種植物與木柵貓空風土關係"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#4CA6A8]" />
                  <span className="whitespace-nowrap">貓空植物誌</span>
                </button>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* 展場人員專用：「平板連動測試 (Socket Override)」控制卡片      */}
          {/* 可收合，避免佔用畫面高度                                      */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className="w-full dark-glow-card rounded-2xl p-2 sm:p-2.5 border-none shadow-none">
            <div
              className={`flex flex-wrap items-center justify-between gap-1.5 px-1 relative z-10 ${
                showPortraitOverride ? 'pb-2 border-b border-zinc-800 mb-2' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => setShowPortraitOverride((prev) => !prev)}
                className="text-[11px] font-medium text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5 text-[#4CA6A8]" />
                <span>平板連動測試 (Socket Override)</span>
                {showPortraitOverride ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </button>

              {/* 分離之專屬看板快速開啟連結 (Board 1, Board 2, Board 3) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <a
                  href="/info?type=leaves"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] px-2 py-0.5 rounded bg-[#1A1A1A] text-zinc-300 hover:text-white hover:bg-[#0E5A4E] flex items-center gap-1 transition-all border border-zinc-800 hover:border-[#4CA6A8]/40"
                  title="開啟專屬看板 1：撥開葉子 / 木柵貓空植物誌 (Leaves Only)"
                >
                  <span className="text-[#4CA6A8] font-bold">B1</span>
                  <span>植被</span>
                  <ExternalLink className="w-2.5 h-2.5 text-zinc-400" />
                </a>

                <a
                  href="/info?type=animals"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] px-2 py-0.5 rounded bg-[#1A1A1A] text-zinc-300 hover:text-white hover:bg-[#0E5A4E] flex items-center gap-1 transition-all border border-zinc-800 hover:border-[#4CA6A8]/40"
                  title="開啟專屬看板 2：動物互動專屬看板 (Animals Only)"
                >
                  <span className="text-[#4CA6A8] font-bold">B2</span>
                  <span>動物</span>
                  <ExternalLink className="w-2.5 h-2.5 text-zinc-400" />
                </a>

                <a
                  href="/info?type=landscape"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] px-2 py-0.5 rounded bg-[#1A1A1A] text-zinc-300 hover:text-white hover:bg-[#0E5A4E] flex items-center gap-1 transition-all border border-zinc-800 hover:border-[#4CA6A8]/40"
                  title="開啟專屬看板 3：風景手勢專屬看板 (Landscape Only)"
                >
                  <span className="text-[#4CA6A8] font-bold">B3</span>
                  <span>風景</span>
                  <ExternalLink className="w-2.5 h-2.5 text-zinc-400" />
                </a>

                <a
                  href="/info"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 px-1 py-0.5 transition-colors underline underline-offset-2"
                  title="開啟全功能通用看板 (Universal)"
                >
                  <span>通用</span>
                </a>
              </div>
            </div>

            {/* 快速手動切換按鈕組 (含測試撥開葉子、動物、山景與待機) - 平面純色膠囊 */}
            {showPortraitOverride && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 relative z-10">
                <button
                  onClick={() => handleManualSyncTest('leaf_parted', 'leaves')}
                  className="btn-dark-glow-capsule rounded-full px-3 py-1.5 text-xs transition-all flex items-center justify-center whitespace-nowrap active:scale-95 cursor-pointer border-none shadow-none"
                  title="強制平板顯示：探索自然 (撥開葉子)"
                >
                  測試撥葉
                </button>

                <button
                  onClick={() => handleManualSyncTest('macaca_cyclopis', 'animal')}
                  className="btn-dark-glow-capsule rounded-full px-3 py-1.5 text-xs transition-all flex items-center justify-center whitespace-nowrap active:scale-95 cursor-pointer border-none shadow-none"
                  title="強制平板顯示：台灣獼猴"
                >
                  猴子
                </button>

                <button
                  onClick={() => handleManualSyncTest('diploderma_polygonatum_xanthostomum', 'animal')}
                  className="btn-dark-glow-capsule rounded-full px-3 py-1.5 text-xs transition-all flex items-center justify-center whitespace-nowrap active:scale-95 cursor-pointer border-none shadow-none"
                  title="強制平板顯示：黃口攀蜥"
                >
                  攀蜥
                </button>

                <button
                  onClick={() => handleManualSyncTest('lophura_swinhoii', 'animal')}
                  className="btn-dark-glow-capsule rounded-full px-3 py-1.5 text-xs transition-all flex items-center justify-center whitespace-nowrap active:scale-95 cursor-pointer border-none shadow-none"
                  title="強制平板顯示：藍腹鷴"
                >
                  藍腹鷴
                </button>

                <button
                  onClick={() => handleManualSyncTest('Mountain_type_1', 'landscape')}
                  className="btn-dark-glow-capsule rounded-full px-3 py-1.5 text-xs transition-all flex items-center justify-center whitespace-nowrap active:scale-95 cursor-pointer border-none shadow-none"
                  title="強制平板顯示：山峰晨曦"
                >
                  山峰
                </button>

                <button
                  onClick={() => handleManualSyncTest(null)}
                  className="btn-dark-glow-capsule rounded-full px-3 py-1.5 text-xs transition-all flex items-center justify-center whitespace-nowrap active:scale-95 cursor-pointer border-none shadow-none"
                  title="強制平板回歸待機主視覺畫面"
                >
                  待機
                </button>
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 木柵貓空三種植物誌彈出資訊面板 (Flat Vector Modal)               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showPlantInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-fade-in pointer-events-auto">
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col dark-glow-card rounded-3xl p-5 sm:p-7 overflow-hidden border-none shadow-none">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#0E5A4E] text-[#4CA6A8]">
                  <BookOpen className="w-5 h-5 text-[#4CA6A8]" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">
                    木柵貓空植物生態誌
                  </h2>
                  <p className="text-xs text-zinc-400">
                    當前畫面出現的植被（底部左右各一株、上方左右各兩株）及其與鐵觀音茶山的風土淵源
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowPlantInfoModal(false)}
                className="p-2 rounded-xl btn-dark-glow-inactive text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="關閉"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 6 植物卡片清單 */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 relative z-10">
              <div
                className="grid gap-4 grid-cols-1 sm:grid-cols-2"
              >
                {currentActivePlants.map((plant) => {
                  const conciseDesc =
                    CONCISE_PLANT_DESCRIPTIONS[plant.imageSrc] ||
                    plant.muzhaRelation ||
                    plant.description;

                  return (
                    <div
                      key={plant.id}
                      className="p-3.5 rounded-2xl bg-[#141414] border-none shadow-none flex flex-col justify-between"
                    >
                      <div>
                        {/* 類型與貓空地點標籤 */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0E5A4E] text-[#4CA6A8]">
                            {plant.categoryLabel}
                          </span>
                          <span className="text-[10px] text-[#D99B43] truncate font-medium">
                            {plant.muzhaSpot}
                          </span>
                        </div>

                        {/* 植物圖像 */}
                        <div className="w-full h-28 flex items-center justify-center my-1.5 p-2 bg-[#0E5A4E] rounded-xl border-none shadow-none">
                          <img
                            src={plant.imageSrc}
                            alt={plant.name}
                            className="max-h-24 max-w-full object-contain"
                          />
                        </div>

                        {/* 植物名稱與學名 */}
                        <h3 className="text-base font-bold text-white mb-0.5">
                          {plant.name}
                        </h3>
                        <p className="text-[11px] font-serif italic text-[#4CA6A8] mb-2">
                          {plant.scientificName}
                        </p>

                        {/* 精簡介紹文字（直接呈現，無外框與無多餘標題） */}
                        <p className="text-xs text-zinc-300 leading-relaxed text-left">
                          {conciseDesc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 relative z-10">
              <span className="flex items-center gap-1.5 text-[#4CA6A8]">
                <Info className="w-3.5 h-3.5 text-[#D99B43]" />
                揮動雙手撥開葉子，10 秒後將自動平穩復位並隨機輪播貓空物種
              </span>
              <button
                onClick={() => setShowPlantInfoModal(false)}
                className="px-4 py-1.5 rounded-xl btn-dark-glow-active text-xs font-medium cursor-pointer"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaPipeView;
