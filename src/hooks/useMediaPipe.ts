import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export type MediaPipeMode = 'leaves' | 'animal' | 'landscape';
export type CameraRotationDeg = 0 | 90 | -90;

export interface UseMediaPipeOptions {
  /** 當前啟用模式：未啟用的模型不在背景執行推論 */
  activeMode: MediaPipeMode;
  /** 實體鏡頭旋轉角度 (90 / -90 / 0)，僅於需要轉正時生效 */
  cameraRotation: CameraRotationDeg;
  /** 是否水平鏡像（與畫面上 <video> 鏡像方向保持一致） */
  mirrorVideo: boolean;
  /** 螢幕是否為直式（決定離屏迷你畫布採用 180x320 直式尺寸） */
  isPortrait: boolean;
  /** 互動舞台實際像素寬度（用來與 object-fit: cover 精確對齊裁切範圍） */
  stageWidth: number;
  /** 互動舞台實際像素高度 */
  stageHeight: number;
  /** 進場狀態機是否已解鎖互動（未解鎖時不額外執行臉部推論） */
  isInteractionUnlocked: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 低功耗硬體全局效能優化常數（樹莓派等裝置專用）
// ─────────────────────────────────────────────────────────────────────────────
const MODEL_COMPLEXITY = 0; // 強制 Lite 模式（對應 pose_landmarker_lite.task）
const INFERENCE_INTERVAL_MS = 90; // AI 推論節流 10~12 FPS（每 90ms 運算一次 ≈ 11.1 FPS）
const MINI_CANVAS_PORTRAIT_W = 180;
const MINI_CANVAS_PORTRAIT_H = 320;
const MINI_CANVAS_LANDSCAPE_W = 320;
const MINI_CANVAS_LANDSCAPE_H = 180;

// Suppress harmless MediaPipe TFLite and WebGL OpenGL logs
const originalConsoleInfo = console.info;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

const suppressMediaPipeLogs = (method: Function) => (...args: any[]) => {
  if (typeof args[0] === 'string') {
    const msg = args[0];
    if (
      msg.includes('Created TensorFlow Lite XNNPACK delegate for CPU') ||
      msg.includes('OpenGL error checking is disabled') ||
      msg.includes('gl_context.cc')
    ) {
      return;
    }
  }
  method(...args);
};

console.info = suppressMediaPipeLogs(originalConsoleInfo);
console.log = suppressMediaPipeLogs(originalConsoleLog);
console.warn = suppressMediaPipeLogs(originalConsoleWarn);
console.error = suppressMediaPipeLogs(originalConsoleError);

async function createLitePoseLandmarker(vision: any): Promise<PoseLandmarker> {
  // modelComplexity = 0 -> 強制載入最輕量 pose_landmarker_lite.task
  const localModel = MODEL_COMPLEXITY === 0 ? '/models/pose_landmarker_lite.task' : '/models/pose_landmarker_lite.task';
  const remoteModel =
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

  const attempts: Array<{ modelAssetPath: string; delegate: 'GPU' | 'CPU' }> = [
    { modelAssetPath: localModel, delegate: 'GPU' },
    { modelAssetPath: localModel, delegate: 'CPU' },
    { modelAssetPath: remoteModel, delegate: 'GPU' },
    { modelAssetPath: remoteModel, delegate: 'CPU' },
  ];

  let lastErr: unknown;
  for (const cfg of attempts) {
    try {
      return await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: cfg.modelAssetPath,
          delegate: cfg.delegate,
        },
        runningMode: 'VIDEO',
        numPoses: 3,
        minPoseDetectionConfidence: 0.4,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function createLiteFaceLandmarker(vision: any): Promise<FaceLandmarker> {
  const localModel = '/models/face_landmarker.task';
  const remoteModel =
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

  const attempts: Array<{ modelAssetPath: string; delegate: 'GPU' | 'CPU' }> = [
    { modelAssetPath: localModel, delegate: 'GPU' },
    { modelAssetPath: localModel, delegate: 'CPU' },
    { modelAssetPath: remoteModel, delegate: 'GPU' },
    { modelAssetPath: remoteModel, delegate: 'CPU' },
  ];

  let lastErr: unknown;
  for (const cfg of attempts) {
    try {
      return await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: cfg.modelAssetPath,
          delegate: cfg.delegate,
        },
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
        runningMode: 'VIDEO',
        numFaces: 3,
        minFaceDetectionConfidence: 0.4,
        minFacePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/**
 * 將 1080p 原始 <video> 繪製到隱藏離屏迷你畫布（直式 180x320 / 橫式 320x180）：
 * 1. 先依舞台實際比例計算與 CSS `object-fit: cover` 完全一致的中心裁切區
 * 2. 再依 cameraRotation (90 / -90 / 0) 與 mirrorVideo 轉正＋鏡像成直立畫面
 * 3. 輸出給 MediaPipe 推論後，所有關鍵點直接為 0.0~1.0 螢幕對齊座標
 */
function drawPreprocessedMiniFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  opts: UseMediaPipeOptions
): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;

  const isQuarterTurn = opts.cameraRotation === 90 || opts.cameraRotation === -90;
  const usePortraitCanvas =
    isQuarterTurn ||
    opts.isPortrait ||
    (opts.stageHeight > 0 && opts.stageWidth > 0 && opts.stageHeight > opts.stageWidth);
  const targetW = usePortraitCanvas ? MINI_CANVAS_PORTRAIT_W : MINI_CANVAS_LANDSCAPE_W;
  const targetH = usePortraitCanvas ? MINI_CANVAS_PORTRAIT_H : MINI_CANVAS_LANDSCAPE_H;

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  // 依據舞台比例還原 object-fit: cover 中心裁切區（16:9 鏡頭於 9:16 直式舞台即為滿幅 0 裁切）
  const stageW = opts.stageWidth > 0 ? opts.stageWidth : targetW;
  const stageH = opts.stageHeight > 0 ? opts.stageHeight : targetH;
  const boxW = isQuarterTurn ? stageH : stageW;
  const boxH = isQuarterTurn ? stageW : stageH;

  const coverScale = Math.max(boxW / vw, boxH / vh);
  const srcW = Math.min(vw, boxW / coverScale);
  const srcH = Math.min(vh, boxH / coverScale);
  const srcX = (vw - srcW) * 0.5;
  const srcY = (vh - srcH) * 0.5;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(canvas.width / 2, canvas.height / 2);

  // 與 CSS `translate(-50%, -50%) scaleX(-1) rotate(90deg)` 完全一致：
  // 先水平鏡像 scale(-1, 1)，再順時針旋轉 90° (Math.PI / 2)
  if (opts.mirrorVideo) {
    ctx.scale(-1, 1);
  }
  if (opts.cameraRotation !== 0) {
    ctx.rotate((opts.cameraRotation * Math.PI) / 180);
  }

  if (isQuarterTurn) {
    ctx.drawImage(
      video,
      srcX,
      srcY,
      srcW,
      srcH,
      -canvas.height / 2,
      -canvas.width / 2,
      canvas.height,
      canvas.width
    );
  } else {
    ctx.drawImage(
      video,
      srcX,
      srcY,
      srcW,
      srcH,
      -canvas.width / 2,
      -canvas.height / 2,
      canvas.width,
      canvas.height
    );
  }
  ctx.restore();
  return true;
}

export const useMediaPipe = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: UseMediaPipeOptions
) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const visionRef = useRef<any>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const faceLoadingRef = useRef<boolean>(false);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);

  const miniCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const miniCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const lastVideoTimeRef = useRef(-1);
  const lastInferenceAtRef = useRef(0);
  const lastTimestampMsRef = useRef(0);
  const lastFacesEmptyRef = useRef(true);
  const lastPosesEmptyRef = useRef(true);

  // 透過 ref 保存最新設定，避免參數變動重建推論迴圈或引發重渲染
  const optionsRef = useRef<UseMediaPipeOptions>(options);
  optionsRef.current = options;

  const [faces, setFaces] = useState<any[]>([]);
  const [poses, setPoses] = useState<any[]>([]);

  // 1. 初始化 WASM 與輕量 PoseLandmarker（所有模式共用，負責進場偵測＋手部／上半身追蹤）
  useEffect(() => {
    let isActive = true;

    const initPose = async () => {
      try {
        let vision: any = null;
        try {
          vision = await FilesetResolver.forVisionTasks('/wasm');
        } catch (e) {
          console.warn('Local WASM loading failed, falling back to CDN:', e);
          vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
          );
        }

        if (!isActive) return;
        visionRef.current = vision;

        const poseLm = await createLitePoseLandmarker(vision);
        if (!isActive) {
          poseLm.close();
          return;
        }
        poseLandmarkerRef.current = poseLm;

        // 若初始模式即為動物互動，同步載入 FaceLandmarker；否則按需延遲載入以節省記憶體
        if (optionsRef.current.activeMode === 'animal' && !faceLandmarkerRef.current) {
          faceLoadingRef.current = true;
          try {
            const faceLm = await createLiteFaceLandmarker(vision);
            if (!isActive) {
              faceLm.close();
              return;
            }
            faceLandmarkerRef.current = faceLm;
          } finally {
            faceLoadingRef.current = false;
          }
        }

        if (isActive) {
          setIsLoaded(true);
        }
      } catch (err) {
        console.error('Failed to initialize MediaPipe:', err);
      }
    };

    initPose();

    return () => {
      isActive = false;
      faceLandmarkerRef.current?.close();
      faceLandmarkerRef.current = null;
      poseLandmarkerRef.current?.close();
      poseLandmarkerRef.current = null;
    };
  }, []);

  // 2. 僅當切換至「動物互動」模式時才載入 FaceLandmarker；切離時清空 faces 並停止臉部推論
  useEffect(() => {
    if (options.activeMode !== 'animal') {
      if (!lastFacesEmptyRef.current) {
        lastFacesEmptyRef.current = true;
        setFaces([]);
      }
      return;
    }

    if (!isLoaded || faceLandmarkerRef.current || faceLoadingRef.current || !visionRef.current) {
      return;
    }

    let cancelled = false;
    faceLoadingRef.current = true;
    createLiteFaceLandmarker(visionRef.current)
      .then((faceLm) => {
        if (cancelled) {
          faceLm.close();
          return;
        }
        faceLandmarkerRef.current = faceLm;
      })
      .catch((err) => {
        console.error('Failed to initialize FaceLandmarker:', err);
      })
      .finally(() => {
        faceLoadingRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [options.activeMode, isLoaded]);

  // 3. 節流推論迴圈（10~12 FPS + 離屏 180x320 先轉正再偵測 + 依啟用模式門控）
  useEffect(() => {
    if (!isLoaded) return;

    if (!miniCanvasRef.current && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = MINI_CANVAS_PORTRAIT_W;
      canvas.height = MINI_CANVAS_PORTRAIT_H;
      miniCanvasRef.current = canvas;
      miniCtxRef.current = canvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
      });
    }

    let animationFrameId = 0;

    const detect = () => {
      const now = performance.now();
      const video = videoRef.current;
      const canvas = miniCanvasRef.current;
      const ctx = miniCtxRef.current;
      const poseLm = poseLandmarkerRef.current;

      // 節流至 10~12 FPS（每 90ms 執行一次推論）
      if (
        now - lastInferenceAtRef.current >= INFERENCE_INTERVAL_MS &&
        video &&
        video.readyState >= 2 &&
        canvas &&
        ctx &&
        poseLm
      ) {
        if (lastVideoTimeRef.current !== video.currentTime) {
          lastVideoTimeRef.current = video.currentTime;
          lastInferenceAtRef.current = now;

          const currentOpts = optionsRef.current;
          const drawn = drawPreprocessedMiniFrame(video, canvas, ctx, currentOpts);

          if (drawn) {
            const timestampMs = Math.max(lastTimestampMsRef.current + 1, Math.round(now));
            lastTimestampMsRef.current = timestampMs;

            try {
              // PoseLandmarker (Lite)：驅動 3 秒進場狀態機，以及撥開葉子／風景手勢模式
              const poseResult = poseLm.detectForVideo(canvas, timestampMs);
              const nextPoses = poseResult.landmarks || [];
              const isNextPosesEmpty = nextPoses.length === 0;

              if (!(lastPosesEmptyRef.current && isNextPosesEmpty)) {
                lastPosesEmptyRef.current = isNextPosesEmpty;
                setPoses(nextPoses);
              }

              // FaceLandmarker：嚴格限定僅在「動物互動」模式且已解鎖互動時執行，其他模式零背景耗能
              const shouldRunFace =
                currentOpts.activeMode === 'animal' &&
                currentOpts.isInteractionUnlocked &&
                Boolean(faceLandmarkerRef.current);

              if (shouldRunFace && faceLandmarkerRef.current) {
                const faceResult = faceLandmarkerRef.current.detectForVideo(canvas, timestampMs);
                const nextFaces = faceResult.faceLandmarks || [];
                const isNextFacesEmpty = nextFaces.length === 0;
                if (!(lastFacesEmptyRef.current && isNextFacesEmpty)) {
                  lastFacesEmptyRef.current = isNextFacesEmpty;
                  setFaces(nextFaces);
                }
              } else if (!lastFacesEmptyRef.current) {
                lastFacesEmptyRef.current = true;
                setFaces([]);
              }
            } catch (e) {
              console.error('Detection error:', e);
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(detect);
    };

    animationFrameId = requestAnimationFrame(detect);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isLoaded, videoRef]);

  return { faces, poses, isLoaded };
};
