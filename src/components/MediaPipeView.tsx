import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useMediaPipe, CameraRotationDeg } from '../hooks/useMediaPipe';
import { useLeafHandTracking } from '../hooks/useLeafHandTracking';
import { useScreenRatio } from '../hooks/useScreenRatio';
import AnimalMode from './AnimalMode';
import LandscapeMode from './LandscapeMode';
import { Plant } from './Plant';
import LeafBorder from './LeafBorder';
import { PlantItem, MuzhaPlantInfo } from '../types';
import { soundManager } from '../utils/sound';
import { syncSocket } from '../utils/syncSocket';
import {
  MUZHA_PLANTS_DATA,
  CONCISE_PLANT_DESCRIPTIONS,
  SIDE_PLANT_POOLS,
  BOTTOM_PLANT_POOLS,
} from '../data/knowledgeData';
import {
  Mountain,
  Dog,
  Leaf,
  RefreshCw,
  AlertCircle,
  Smartphone,
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

// ─────────────────────────────────────────────────────────────
// 實體鏡頭方向與鏡像校正參數（支援 0 / 90 / -90，方便現場微調）
// 0 = 鏡頭橫放平擺（一般狀態）；90 / -90 = 鏡頭實體側轉 90 度安裝時使用
// ─────────────────────────────────────────────────────────────
export const CAMERA_ROTATION: CameraRotationDeg = 0;
export const MIRROR_VIDEO = true;

// ─────────────────────────────────────────────────────────────
// 進場 3 秒防誤觸狀態機 — 可微調常數設定
// ─────────────────────────────────────────────────────────────
type PresenceState = 'IDLE' | 'DETECTING' | 'ACTIVE' | 'COOLDOWN';

const ENTRY_X_MIN = 0.25; // IDLE / DETECTING 水平有效左邊界
const ENTRY_X_MAX = 0.75; // IDLE / DETECTING 水平有效右邊界
const ACTIVE_X_MIN = 0.15; // ACTIVE / COOLDOWN 放寬水平左邊界
const ACTIVE_X_MAX = 0.85; // ACTIVE / COOLDOWN 放寬水平右邊界
const MIN_SHOULDER_WIDTH = 0.15; // 距離門檻：雙肩寬度比例 >= 0.15
const MIN_SHOULDER_VISIBILITY = 0.3; // 肩膀關鍵點最低可見度
const DETECTING_DURATION_MS = 3000; // 進場確認計時 (3 秒)
const DETECTING_LOSS_TOLERANCE_MS = 500; // DETECTING 期間瞬間漏偵測容忍時間 (500ms)
const COOLDOWN_DURATION_MS = 2500; // 離場緩衝計時 (2.5 秒)
const PRESENCE_TICK_MS = 100; // 狀態機計時檢查間隔
const EMPTY_LANDMARKS: any[] = []; // 停用互動時傳入的穩定空陣列，避免不必要 re-render

// 高質感明暗過渡層設定（不使用 blur）
const DIM_OVERLAY_GRADIENT =
  'radial-gradient(circle at center, rgba(8, 12, 10, 0.58) 0%, rgba(4, 7, 6, 0.88) 100%)';
const DIM_OVERLAY_OPACITY: Record<PresenceState, number> = {
  IDLE: 1,
  DETECTING: 0.55,
  ACTIVE: 0,
  COOLDOWN: 0,
};

const hasValidPresencePerson = (
  poseList: any[],
  useRelaxedBounds: boolean
): boolean => {
  if (!poseList || poseList.length === 0) return false;
  const minX = useRelaxedBounds ? ACTIVE_X_MIN : ENTRY_X_MIN;
  const maxX = useRelaxedBounds ? ACTIVE_X_MAX : ENTRY_X_MAX;

  for (let i = 0; i < poseList.length; i++) {
    const pose = poseList[i];
    if (!pose) continue;

    const lShoulder = pose[11];
    const rShoulder = pose[12];
    if (!lShoulder || !rShoulder) continue;

    if (
      (typeof lShoulder.visibility === 'number' &&
        lShoulder.visibility < MIN_SHOULDER_VISIBILITY) ||
      (typeof rShoulder.visibility === 'number' &&
        rShoulder.visibility < MIN_SHOULDER_VISIBILITY)
    ) {
      continue;
    }

    const shoulderCenterX = (lShoulder.x + rShoulder.x) * 0.5;
    const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);

    if (
      shoulderCenterX >= minX &&
      shoulderCenterX <= maxX &&
      shoulderWidth >= MIN_SHOULDER_WIDTH
    ) {
      return true;
    }
  }
  return false;
};

interface MediaPipeViewProps {
  initialMode?: UnifiedMode;
}

export const MediaPipeView: React.FC<MediaPipeViewProps> = ({
  initialMode = 'leaves',
}) => {
  // Mode selection: all 3 modes integrated in the SAME switching window
  const [activeMode, setActiveMode] = useState<UnifiedMode>(initialMode);

  // 當前大螢幕觸發並展示的目標（動物代號、山嶽代號、或葉片撥開狀態），同步給平板顯示知識看板
  const [activeAnimalTarget, setActiveAnimalTarget] = useState<string | null>(null);
  const [activeLandscapeTarget, setActiveLandscapeTarget] = useState<string | null>(null);
  const activeAnimalTargetRef = useRef<string | null>(null);
  const activeLandscapeTargetRef = useRef<string | null>(null);

  // 手動強制 Override 目標（若有設定，將優先發送）
  const [manualOverrideTarget, setManualOverrideTarget] = useState<string | null>(null);

  // Camera stream refs & state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const cameraErrorRef = useRef<string | null>(null);
  const [isPhoneFrame, setIsPhoneFrame] = useState(true);

  // 原生 Fullscreen 狀態 (跨瀏覽器監聽同步)
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 自動偵測螢幕比例與直／橫方向 (Portrait / Landscape)，同步根元素 .is-portrait
  const { isPortrait, isWideLandscape, width: screenWidth, height: screenHeight } = useScreenRatio();

  // 直式模式下可收合之底部平板測試抽屜（預設精簡收合，避免遮擋中央互動區）
  const [showPortraitOverride, setShowPortraitOverride] = useState(false);

  // 互動舞台實際尺寸（提供旋轉 90° 的 1080p <video> 與 180x320 離屏畫布精確 1:1 對齊）
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const stageSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  const recalcStageSize = useCallback(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w <= 0 || h <= 0) return;
    if (
      Math.abs(stageSizeRef.current.width - w) < 1 &&
      Math.abs(stageSizeRef.current.height - h) < 1
    ) {
      return;
    }
    const next = { width: w, height: h };
    stageSizeRef.current = next;
    setStageSize(next);
  }, []);

  // Sound and settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoReturnSeconds, setAutoReturnSeconds] = useState<number>(10); // 預設 10 秒自動復原
  const [showSettings, setShowSettings] = useState(false);
  const [showPlantInfoModal, setShowPlantInfoModal] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // 進場 3 秒防誤觸四階段狀態機 (IDLE -> DETECTING -> ACTIVE -> COOLDOWN)
  // 計時器與時間戳記全面以 ref 管理，僅於狀態實際切換時更新 state
  // ─────────────────────────────────────────────────────────────
  const [presenceState, setPresenceState] = useState<PresenceState>('IDLE');
  const presenceStateRef = useRef<PresenceState>('IDLE');
  const prevPresenceStateRef = useRef<PresenceState>('IDLE');
  const isInteractionUnlocked =
    presenceState === 'ACTIVE' || presenceState === 'COOLDOWN';

  // 依 CAMERA_ROTATION (0 / 90 / -90) 同步套用至 <video> 與離屏偵測畫布
  const effectiveCameraRotation = CAMERA_ROTATION as CameraRotationDeg;

  // MediaPipe AI Vision（離屏 180x320 先轉正再偵測 + Lite 模型 + 10~12 FPS 節流 + 依模式門控）
  const { faces, poses, isLoaded } = useMediaPipe(videoRef, {
    activeMode,
    cameraRotation: effectiveCameraRotation,
    mirrorVideo: MIRROR_VIDEO,
    isPortrait,
    stageWidth: stageSize.width,
    stageHeight: stageSize.height,
    isInteractionUnlocked,
  });

  const latestPosesRef = useRef<any[]>(poses);
  latestPosesRef.current = poses;

  const detectingStartAtRef = useRef<number | null>(null);
  const lastValidSeenAtRef = useRef<number | null>(null);
  const cooldownStartAtRef = useRef<number | null>(null);
  const presenceTimerRef = useRef<number | null>(null);

  // 明暗過渡層與底層畫面色調呼應（退回待機 2s ease-in-out，其餘 1.4s cubic-bezier）
  const dimOverlayOpacity = DIM_OVERLAY_OPACITY[presenceState];
  const dimTransitionCurve =
    presenceState === 'IDLE'
      ? '2s ease-in-out'
      : '1.4s cubic-bezier(0.22, 1, 0.36, 1)';
  const videoToneFilter =
    presenceState === 'IDLE'
      ? 'brightness(0.84) saturate(0.76)'
      : presenceState === 'DETECTING'
      ? 'brightness(0.93) saturate(0.9)'
      : 'brightness(1) saturate(1)';

  const commitPresenceState = useCallback((next: PresenceState) => {
    if (presenceStateRef.current === next) return;
    presenceStateRef.current = next;
    setPresenceState(next);
  }, []);

  const evaluatePresenceState = useCallback(() => {
    const now = performance.now();
    const state = presenceStateRef.current;
    const useRelaxedBounds = state === 'ACTIVE' || state === 'COOLDOWN';
    const isValid = hasValidPresencePerson(
      latestPosesRef.current,
      useRelaxedBounds
    );

    if (state === 'IDLE') {
      if (isValid) {
        detectingStartAtRef.current = now;
        lastValidSeenAtRef.current = now;
        cooldownStartAtRef.current = null;
        commitPresenceState('DETECTING');
      }
      return;
    }

    if (state === 'DETECTING') {
      if (isValid) {
        lastValidSeenAtRef.current = now;
        if (detectingStartAtRef.current === null) {
          detectingStartAtRef.current = now;
        }
        if (now - detectingStartAtRef.current >= DETECTING_DURATION_MS) {
          detectingStartAtRef.current = null;
          cooldownStartAtRef.current = null;
          commitPresenceState('ACTIVE');
        }
      } else {
        const lastSeen = lastValidSeenAtRef.current ?? now;
        if (now - lastSeen > DETECTING_LOSS_TOLERANCE_MS) {
          detectingStartAtRef.current = null;
          lastValidSeenAtRef.current = null;
          commitPresenceState('IDLE');
        }
      }
      return;
    }

    if (state === 'ACTIVE') {
      if (isValid) {
        lastValidSeenAtRef.current = now;
      } else {
        cooldownStartAtRef.current = now;
        commitPresenceState('COOLDOWN');
      }
      return;
    }

    if (state === 'COOLDOWN') {
      if (isValid) {
        lastValidSeenAtRef.current = now;
        cooldownStartAtRef.current = null;
        commitPresenceState('ACTIVE');
      } else {
        const cooldownStart = cooldownStartAtRef.current ?? now;
        if (now - cooldownStart >= COOLDOWN_DURATION_MS) {
          cooldownStartAtRef.current = null;
          detectingStartAtRef.current = null;
          lastValidSeenAtRef.current = null;
          commitPresenceState('IDLE');
        }
      }
    }
  }, [commitPresenceState]);

  // 每次骨架更新即時判定（不額外觸發 re-render）
  useEffect(() => {
    evaluatePresenceState();
  }, [poses, evaluatePresenceState]);

  // 僅在 DETECTING / COOLDOWN 期間啟動計時檢查，確保離場無新幀時仍準確超時
  useEffect(() => {
    if (presenceTimerRef.current !== null) {
      window.clearInterval(presenceTimerRef.current);
      presenceTimerRef.current = null;
    }

    if (presenceState === 'DETECTING' || presenceState === 'COOLDOWN') {
      presenceTimerRef.current = window.setInterval(() => {
        evaluatePresenceState();
      }, PRESENCE_TICK_MS);
    }

    return () => {
      if (presenceTimerRef.current !== null) {
        window.clearInterval(presenceTimerRef.current);
        presenceTimerRef.current = null;
      }
    };
  }, [presenceState, evaluatePresenceState]);

  // 穩定的回調函式，避免子元件每幀重渲染
  const handleActiveAnimalChange = useCallback((target: string | null) => {
    if (activeAnimalTargetRef.current === target) return;
    activeAnimalTargetRef.current = target;
    setActiveAnimalTarget(target);
  }, []);

  const handleActiveLandscapeChange = useCallback((target: string | null) => {
    if (activeLandscapeTargetRef.current === target) return;
    activeLandscapeTargetRef.current = target;
    setActiveLandscapeTarget(target);
  }, []);

  // 互動植物圖庫池已集中管理於 src/data/bioData.ts（經由 knowledgeData.ts 匯出）
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

  // 植物槽位配置（底部與左右邊緣統一採用 -5% 負邊距錨定，確保根莖緊貼螢幕邊框不浮空）
  const [plants, setPlants] = useState<PlantItem[]>([
    {
      id: 'side-left-1',
      group: 'C',
      imageSrc: '/leaves_ground_5.png',
      name: MUZHA_PLANTS_DATA['/leaves_ground_5.png']?.name || '貓空野徑・垂懸藤葉',
      side: 'left',
      index: 0,
      positionType: 'hanging',
      topPercent: 15.2,
      horizontalOffsetPercent: -5,
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
    {
      id: 'side-left-2',
      group: 'C',
      imageSrc: '/leaves.png',
      name: MUZHA_PLANTS_DATA['/leaves.png']?.name || '樟樹步道・樟楠樹冠',
      side: 'left',
      index: 1,
      positionType: 'hanging',
      topPercent: 35.2,
      horizontalOffsetPercent: -5,
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
    {
      id: 'side-right-1',
      group: 'C',
      imageSrc: '/leaves_ground_6.png',
      name: MUZHA_PLANTS_DATA['/leaves_ground_6.png']?.name || '百年老樹・垂懸崖薑蕨',
      side: 'right',
      index: 2,
      positionType: 'hanging',
      topPercent: 20.0,
      horizontalOffsetPercent: -5,
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
    {
      id: 'side-right-2',
      group: 'C',
      imageSrc: '/leaves_ground_5.png',
      name: MUZHA_PLANTS_DATA['/leaves_ground_5.png']?.name || '貓空野徑・垂懸藤葉',
      side: 'right',
      index: 3,
      positionType: 'hanging',
      topPercent: 44.5,
      horizontalOffsetPercent: -5,
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
    {
      id: 'bottom-left',
      group: 'A',
      imageSrc: '/leaves_ground_2.png',
      name: MUZHA_PLANTS_DATA['/leaves_ground_2.png']?.name || '鐵觀音',
      side: 'left',
      index: 4,
      positionType: 'bottom',
      horizontalOffsetPercent: -5,
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
    {
      id: 'bottom-right',
      group: 'B',
      imageSrc: '/leaves_ground_4.png',
      name: MUZHA_PLANTS_DATA['/leaves_ground_4.png']?.name || '木柵特產・破土綠竹筍',
      side: 'right',
      index: 5,
      positionType: 'bottom',
      horizontalOffsetPercent: -5,
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

  // 提前預載所有 6 款植物圖檔，防止替換植物時出現瀏覽器非同步解碼白閃或延遲跳圖
  useEffect(() => {
    const allPlantImages = [
      '/leaves.png',
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

  // 當狀態機由 COOLDOWN / DETECTING 平滑重置回 IDLE 時，清空殘留互動狀態
  useEffect(() => {
    const prevState = prevPresenceStateRef.current;
    prevPresenceStateRef.current = presenceState;

    if (prevState !== 'IDLE' && presenceState === 'IDLE') {
      if (activeAnimalTargetRef.current !== null) {
        activeAnimalTargetRef.current = null;
        setActiveAnimalTarget(null);
      }
      if (activeLandscapeTargetRef.current !== null) {
        activeLandscapeTargetRef.current = null;
        setActiveLandscapeTarget(null);
      }
      setPlants((prev) => {
        const hasInteractiveState = prev.some(
          (p) => p.isPushed || p.waveCount > 0
        );
        if (!hasInteractiveState) return prev;
        return prev.map((p) => ({
          ...p,
          isPushed: false,
          pushedAt: null,
          remainingSeconds: autoReturnSeconds,
          waveCount: 0,
        }));
      });
    }
  }, [presenceState, autoReturnSeconds]);

  // ─────────────────────────────────────────────────────────────
  // 雙螢幕同步發送邏輯 (Socket.io Second Screen Sync)
  // 當模式改變、動物出現、山嶽手勢或葉片撥開時，即時廣播給平板展示專屬故事
  // 包含當前大螢幕正在出現的三種植物詳細資料與木柵貓空風土關係
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let target: string | null = null;
    if (manualOverrideTarget) {
      target = manualOverrideTarget;
    } else if (!isInteractionUnlocked) {
      target = null;
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
    isInteractionUnlocked,
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
      if (
        presenceStateRef.current !== 'ACTIVE' &&
        presenceStateRef.current !== 'COOLDOWN'
      ) {
        return;
      }
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

  // Hook for strict hand-only tracking (15, 16, 19, 20; 座標已由離屏畫布對齊螢幕)
  useLeafHandTracking({
    poses: isInteractionUnlocked ? poses : EMPTY_LANDMARKS,
    plants: visiblePlants,
    enabled: activeMode === 'leaves' && isInteractionUnlocked,
    requiredWaveCount: 1,
    onWaveStroke: handleWaveStroke,
  });

  // Push / Part a plant directly (click/touch fallback)
  const handlePushPlant = useCallback(
    (plantId: string) => {
      if (
        presenceStateRef.current !== 'ACTIVE' &&
        presenceStateRef.current !== 'COOLDOWN'
      ) {
        return;
      }
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
            } else if (Math.abs(plant.remainingSeconds - remaining) > 0.08) {
              hasChanges = true;
              return {
                ...plant,
                remainingSeconds: remaining,
              };
            }
          }

          return plant;
        });

        return hasChanges ? updated : prev;
      });
    }, 80);

    return () => clearInterval(interval);
  }, [autoReturnSeconds, soundEnabled]);

  // Start / Maintain Camera (維持請求 1920x1080 Full HD 滿畫質)
  const startCamera = useCallback(async () => {
    if (cameraErrorRef.current !== null) {
      cameraErrorRef.current = null;
      setCameraError(null);
    }
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
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((e) => console.warn('Play interrupted:', e));
          setHasCamera(true);
          recalcStageSize();
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
      cameraErrorRef.current = errMsg;
      setCameraError(errMsg);
      setHasCamera(false);
    }
  }, [recalcStageSize]);

  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [startCamera]);

  // 螢幕方向／尺寸切換時重新量測舞台像素寬高，確保旋轉 90° 的 1080p <video> 與離屏畫布精準對齊
  useEffect(() => {
    recalcStageSize();
    const timer = window.setTimeout(recalcStageSize, 60);
    return () => window.clearTimeout(timer);
  }, [isPortrait, screenWidth, screenHeight, isFullscreen, isPhoneFrame, recalcStageSize]);

  useEffect(() => {
    const stageEl = stageRef.current;
    recalcStageSize();

    let ro: ResizeObserver | null = null;
    if (stageEl && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        recalcStageSize();
      });
      ro.observe(stageEl);
    }

    return () => {
      ro?.disconnect();
    };
  }, [recalcStageSize]);

  // 計算 <video> 樣式：旋轉 ±90° 時絕對定位居中、寬高對調 (100dvh × 100vw)，
  // 並維持 scaleX(-1) 在 rotate(90deg) 之前，確保先順時針轉正再左右鏡像、滿版無黑邊
  const isQuarterTurn =
    effectiveCameraRotation === 90 || effectiveCameraRotation === -90;
  const videoTransform = isQuarterTurn
    ? `translate(-50%, -50%) ${MIRROR_VIDEO ? 'scaleX(-1) ' : ''}rotate(${effectiveCameraRotation}deg)`
    : MIRROR_VIDEO
    ? 'scaleX(-1)'
    : 'none';

  const useViewportDims = isPortrait || isFullscreen;
  const videoStyle: React.CSSProperties = isQuarterTurn
    ? {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: useViewportDims
          ? '100dvh'
          : stageSize.height > 0
          ? `${stageSize.height}px`
          : '100dvh',
        height: useViewportDims
          ? '100vw'
          : stageSize.width > 0
          ? `${stageSize.width}px`
          : '100vw',
        maxWidth: 'none',
        maxHeight: 'none',
        objectFit: 'cover',
        objectPosition: 'center',
        transform: videoTransform,
        filter: videoToneFilter,
        transition: `filter ${dimTransitionCurve}`,
      }
    : {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center',
        transform: videoTransform,
        filter: videoToneFilter,
        transition: `filter ${dimTransitionCurve}`,
      };

  return (
    <div
      className={`relative w-screen h-[100dvh] font-sans select-none overflow-hidden bg-[#0A0A0A] transition-all duration-300 ${
        isFullscreen
          ? 'flex items-center justify-center p-0'
          : isPortrait
          ? 'portrait-stage-canvas block p-0'
          : isWideLandscape
          ? 'grid grid-cols-[minmax(0,1fr)_350px] lg:grid-cols-[minmax(0,1fr)_400px] grid-rows-[auto_minmax(0,1fr)] gap-x-6 lg:gap-x-8 gap-y-2.5 items-start justify-center max-w-[1220px] mx-auto px-5 py-3'
          : 'grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] justify-items-center gap-1.5 p-1.5 sm:p-2'
      }`}
    >
      {/* ───────────────────────────────────────────────────────────── */}
      {/* Child 1：頂部導覽與三大模式切換群組                             */}
      {/* - 直式 (.is-portrait)：自動懸浮錨定於頂部安全邊距 (Safe Area)，   */}
      {/*   不擠壓亦不遮擋中央主互動區域                                  */}
      {/* - 橫式寬螢幕：停靠於右側控制欄上方                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {!isFullscreen && (
        <div
          className={`flex flex-col gap-1.5 transition-all duration-300 ${
            isPortrait
              ? 'fixed top-0 left-0 right-0 z-55 portrait-safe-top items-center pointer-events-none'
              : isWideLandscape
              ? 'col-start-2 row-start-1 w-full z-40 pointer-events-auto'
              : 'row-start-1 w-full max-w-lg items-center z-40 pointer-events-auto'
          }`}
        >
          <header
            className={`w-full flex items-center justify-between px-3.5 sm:px-4 py-2 dark-glow-card rounded-2xl text-zinc-300 pointer-events-auto ${
              isPortrait ? 'max-w-[680px]' : ''
            }`}
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

              {!isPortrait && (
                <button
                  onClick={() => setIsPhoneFrame(!isPhoneFrame)}
                  className="p-1.5 rounded-xl btn-dark-glow-inactive cursor-pointer"
                  title={isPhoneFrame ? '切換為滿版視圖' : '切換為手機直式外框'}
                >
                  {isPhoneFrame ? <Maximize2 className="w-3.5 h-3.5 text-white" /> : <Smartphone className="w-3.5 h-3.5 text-zinc-300" />}
                </button>
              )}

              {isPortrait && (
                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-xl btn-dark-glow-inactive text-[#4CA6A8] hover:text-white cursor-pointer"
                  title="進入純淨全螢幕 (True Fullscreen)"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </header>

          {/* 外部三大模式切換選單 */}
          <div className={`w-full pointer-events-auto ${isPortrait ? 'max-w-[680px]' : ''}`}>
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
      {/* - 直式 (.is-portrait)：100vw × 100dvh 滿版鋪滿，object-fit: cover */}
      {/* - 橫式寬螢幕：左側滿高呈現 9:16 互動舞台                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div
        ref={viewportRef}
        id="unified-ar-viewport"
        className={`overflow-hidden transition-all duration-300 flex items-center justify-center bg-black ${
          isFullscreen
            ? 'fixed inset-0 z-50 w-screen h-[100dvh] max-w-none max-h-none rounded-none border-none p-0'
            : isPortrait
            ? 'fixed inset-0 z-10 w-screen h-[100dvh] max-w-none max-h-none rounded-none border-none p-0'
            : isWideLandscape
            ? isPhoneFrame
              ? 'relative col-start-1 row-start-1 row-span-2 justify-self-center h-[calc(100dvh-1.5rem)] w-auto max-w-full aspect-[9/16] rounded-3xl border-none shadow-none'
              : 'relative col-start-1 row-start-1 row-span-2 justify-self-stretch h-[calc(100dvh-1.5rem)] w-full rounded-3xl border-none shadow-none'
            : isPhoneFrame
            ? 'relative row-start-2 h-full min-h-0 w-auto max-w-full aspect-[9/16] rounded-3xl border-none shadow-none'
            : 'relative row-start-2 w-full h-full min-h-0 max-w-[540px] rounded-3xl border-none shadow-none'
        }`}
      >
        {/* 內層舞台容器 (stageRef)：透過 ResizeObserver 同步最新寬高與投影比例 */}
        <div
          ref={stageRef}
          className={`relative h-full overflow-hidden flex items-center justify-center bg-black transition-all duration-300 ${
            isFullscreen
              ? isPortrait
                ? 'w-full'
                : 'w-auto max-w-full aspect-[9/16]'
              : 'w-full'
          }`}
        >
          {/* 原生全螢幕切換按鈕：橫式視窗或全螢幕時呈現（直式非全螢幕時移至頂部導覽列避免重疊） */}
          {(isFullscreen || !isPortrait) && (
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
          {cameraError && (
            <div
              className="absolute left-4 right-4 sm:right-14 z-45 flex items-center justify-between gap-2 px-3 py-2 rounded-xl dark-glow-card text-zinc-100 text-xs animate-fade-in pointer-events-auto"
              style={{
                top:
                  isPortrait && !isFullscreen
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
                  onClick={() => {
                    cameraErrorRef.current = null;
                    setCameraError(null);
                  }}
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

          {/* AI Model Loading Overlay */}
          {!isLoaded && hasCamera && !cameraError && (
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

          {/* Shared Live Video Element (1080p 滿畫質 + CAMERA_ROTATION / MIRROR_VIDEO CSS 轉正與 object-fit: cover) */}
          <video
            ref={videoRef}
            className="pointer-events-none"
            style={videoStyle}
            autoPlay
            playsInline
            muted
          />

          {/* 1. Mode: 撥開葉子（6 株互動植物槽位分居側邊與底部兩角，全不透明渲染） */}
          {activeMode === 'leaves' && (
            <div
              className={`absolute inset-0 pointer-events-none z-30 overflow-hidden transition-opacity duration-700 ease-in-out ${
                isInteractionUnlocked
                  ? 'opacity-100'
                  : 'opacity-0 [&_*]:pointer-events-none'
              }`}
            >
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

          {/* 2. Mode: 動物互動模式 (離屏 180x320 畫布已先轉正與鏡像，直接使用 0.0~1.0 對齊座標) */}
          {activeMode === 'animal' && (
            <div
              className={`absolute inset-0 pointer-events-none z-30 overflow-hidden transition-opacity duration-700 ease-in-out ${
                isInteractionUnlocked ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <AnimalMode
                faces={isInteractionUnlocked ? faces : EMPTY_LANDMARKS}
                poses={isInteractionUnlocked ? poses : EMPTY_LANDMARKS}
                onActiveAnimalChange={handleActiveAnimalChange}
              />
            </div>
          )}

          {/* 3. Mode: 風景手勢模式 (z-50 頂層獨立透明度渲染，含距離提示與第二螢幕同步) */}
          {activeMode === 'landscape' && (
            <div
              className={`absolute inset-0 pointer-events-none z-30 overflow-hidden transition-opacity duration-700 ease-in-out ${
                isInteractionUnlocked ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <LandscapeMode
                poses={isInteractionUnlocked ? poses : EMPTY_LANDMARKS}
                onActiveLandscapeChange={handleActiveLandscapeChange}
              />
            </div>
          )}

          {/* 各項互動功能的頂層邊框 (100% 完全實色不透明)：
              1. 撥開葉子：boarder_top.png, boarder_side_left.png, boarder_side_right.png
              2. 動物互動：animals_boarder.png
              3. 風景手勢：scene_boarder.png */}
          <LeafBorder activeMode={activeMode} />

          {/* 高質感明暗過渡層（覆蓋於主畫面最上層，無 blur、無文字、pointer-events-none） */}
          <div
            aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none select-none z-[53]"
            style={{
              background: DIM_OVERLAY_GRADIENT,
              opacity: dimOverlayOpacity,
              transition: `opacity ${dimTransitionCurve}`,
              willChange: 'opacity',
            }}
          />
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* Child 3：控制與連動測試面板                                    */}
      {/* - 直式 (.is-portrait)：自動錨定至底部安全邊距 (Safe Area)，     */}
      {/*   預設精簡高度並支援收合測試面板，確保中央互動區域完全不被遮擋     */}
      {/* - 橫式寬螢幕：停靠於右側控制欄下方                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {!isFullscreen && (
        <div
          className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
            isPortrait
              ? 'fixed bottom-0 left-0 right-0 z-55 portrait-safe-bottom pointer-events-none'
              : isWideLandscape
              ? 'col-start-2 row-start-2 w-full max-h-full overflow-y-auto pr-0.5 z-30 pointer-events-auto'
              : 'row-start-3 w-full max-w-[440px] z-30 pointer-events-auto'
          }`}
        >
          <div className={`w-full flex flex-col gap-1.5 pointer-events-auto ${isPortrait ? 'max-w-[680px]' : ''}`}>
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
          {/* 直式模式下可收合，避免佔用畫面高度並維持底部安全留白            */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className="w-full dark-glow-card rounded-2xl p-2 sm:p-2.5 border-none shadow-none">
            <div
              className={`flex flex-wrap items-center justify-between gap-1.5 px-1 relative z-10 ${
                !isPortrait || showPortraitOverride ? 'pb-2 border-b border-zinc-800 mb-2' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => isPortrait && setShowPortraitOverride((prev) => !prev)}
                className={`text-[11px] font-medium text-white flex items-center gap-1.5 ${
                  isPortrait ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-[#4CA6A8]" />
                <span>平板連動測試 (Socket Override)</span>
                {isPortrait &&
                  (showPortraitOverride ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                  ))}
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
            {(!isPortrait || showPortraitOverride) && (
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
                className={`grid gap-4 ${
                  isPortrait
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                }`}
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
