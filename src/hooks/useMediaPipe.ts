import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Suppress harmless MediaPipe TFLite and WebGL OpenGL logs that trigger AI Studio error boundaries or clutter console
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

const loadVision = () =>
  FilesetResolver.forVisionTasks('/wasm').catch((e) => {
    console.warn('Local WASM loading failed, falling back to CDN:', e);
    return FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
  });

const FACE_OPTIONS = {
  outputFaceBlendshapes: false,
  runningMode: 'VIDEO' as const,
  numFaces: 3,
  minFaceDetectionConfidence: 0.4,
  minFacePresenceConfidence: 0.4,
  minTrackingConfidence: 0.4,
};

const POSE_OPTIONS = {
  runningMode: 'VIDEO' as const,
  numPoses: 3,
  minPoseDetectionConfidence: 0.4,
  minPosePresenceConfidence: 0.4,
  minTrackingConfidence: 0.4,
};

/**
 * needFaces：只有「動物互動」要認臉。其他模式不載入、也不跑臉部模型，
 * 每一格畫面只跑姿勢模型，省下一半運算。
 */
export const useMediaPipe = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  needFaces: boolean
) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const visionRef = useRef<any>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const needFacesRef = useRef(needFaces);
  needFacesRef.current = needFaces;

  const [faces, setFaces] = useState<any[]>([]);
  const [poses, setPoses] = useState<any[]>([]);

  // 姿勢模型：三種模式都要，一開始就載入
  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        const vision = await loadVision();
        if (!isActive) return;
        visionRef.current = vision;

        const poseLm = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task', delegate: 'GPU' },
          ...POSE_OPTIONS,
        }).catch((err) => {
          console.warn('Local pose model failed, fallback to online model:', err);
          return PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
              delegate: 'GPU',
            },
            ...POSE_OPTIONS,
          });
        });

        if (!isActive) {
          poseLm.close();
          return;
        }
        poseLandmarkerRef.current = poseLm;
        setIsLoaded(true);
      } catch (err) {
        console.error('Failed to initialize MediaPipe:', err);
      }
    })();

    return () => {
      isActive = false;
      poseLandmarkerRef.current?.close();
      poseLandmarkerRef.current = null;
      faceLandmarkerRef.current?.close();
      faceLandmarkerRef.current = null;
    };
  }, []);

  // 臉部模型：第一次切到動物模式才載入，之後留著
  useEffect(() => {
    if (!needFaces || !isLoaded || faceLandmarkerRef.current) return;
    let isActive = true;
    const vision = visionRef.current;

    FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
      ...FACE_OPTIONS,
    })
      .catch((err) => {
        console.warn('Local face model failed, fallback to online model:', err);
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          ...FACE_OPTIONS,
        });
      })
      .then((faceLm) => {
        if (isActive && !faceLandmarkerRef.current) faceLandmarkerRef.current = faceLm;
        else faceLm.close();
      })
      .catch((err) => console.error('Failed to load face model:', err));

    return () => {
      isActive = false;
    };
  }, [needFaces, isLoaded]);

  useEffect(() => {
    if (!needFaces) setFaces((prev) => (prev.length === 0 ? prev : []));
  }, [needFaces]);

  useEffect(() => {
    let animationFrameId: number;

    const detect = () => {
      const video = videoRef.current;
      const poseLm = poseLandmarkerRef.current;
      if (video && video.readyState >= 2 && poseLm && lastVideoTimeRef.current !== video.currentTime) {
        lastVideoTimeRef.current = video.currentTime;
        const startTimeMs = performance.now();

        try {
          const nextPoses = poseLm.detectForVideo(video, startTimeMs).landmarks || [];
          setPoses((prev) => (prev.length === 0 && nextPoses.length === 0 ? prev : nextPoses));

          const faceLm = needFacesRef.current ? faceLandmarkerRef.current : null;
          if (faceLm) {
            const nextFaces = faceLm.detectForVideo(video, startTimeMs).faceLandmarks || [];
            setFaces((prev) => (prev.length === 0 && nextFaces.length === 0 ? prev : nextFaces));
          }
        } catch (e) {
          console.error('Detection error:', e);
        }
      }
      animationFrameId = requestAnimationFrame(detect);
    };

    if (isLoaded) {
      detect();
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isLoaded, videoRef]);

  return { faces, poses, isLoaded };
};
