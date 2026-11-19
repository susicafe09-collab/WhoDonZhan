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

export const useMediaPipe = (videoRef: React.RefObject<HTMLVideoElement | null>) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const lastVideoTimeRef = useRef(-1);
  
  const [faces, setFaces] = useState<any[]>([]);
  const [poses, setPoses] = useState<any[]>([]);

  useEffect(() => {
    let isActive = true;

    const initMediaPipe = async () => {
      try {
        // 1. 本地端 WASM 目錄 (/wasm)，離線或行動裝置可秒開；同時具備 CDN 自動降級備援
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

        // 2. 利用 Promise.all 同時平行載入 FaceLandmarker 與 PoseLandmarker，大幅壓縮載入等待時間
        const [faceLm, poseLm] = await Promise.all([
          FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: '/models/face_landmarker.task',
              delegate: 'GPU',
            },
            outputFaceBlendshapes: false,
            runningMode: 'VIDEO',
            numFaces: 3,
            minFaceDetectionConfidence: 0.4,
            minFacePresenceConfidence: 0.4,
            minTrackingConfidence: 0.4,
          }).catch((err) => {
            console.warn('Local face model failed, fallback to online model:', err);
            return FaceLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath:
                  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                delegate: 'GPU',
              },
              outputFaceBlendshapes: false,
              runningMode: 'VIDEO',
              numFaces: 3,
              minFaceDetectionConfidence: 0.4,
              minFacePresenceConfidence: 0.4,
              minTrackingConfidence: 0.4,
            });
          }),

          PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: '/models/pose_landmarker_lite.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numPoses: 3,
            minPoseDetectionConfidence: 0.4,
            minPosePresenceConfidence: 0.4,
            minTrackingConfidence: 0.4,
          }).catch((err) => {
            console.warn('Local pose model failed, fallback to online model:', err);
            return PoseLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath:
                  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                delegate: 'GPU',
              },
              runningMode: 'VIDEO',
              numPoses: 3,
              minPoseDetectionConfidence: 0.4,
              minPosePresenceConfidence: 0.4,
              minTrackingConfidence: 0.4,
            });
          }),
        ]);

        if (!isActive) {
          faceLm?.close();
          poseLm?.close();
          return;
        }

        faceLandmarkerRef.current = faceLm;
        poseLandmarkerRef.current = poseLm;

        if (isActive) {
          setIsLoaded(true);
        }
      } catch (err) {
        console.error('Failed to initialize MediaPipe:', err);
      }
    };

    initMediaPipe();

    return () => {
      isActive = false;
      if (faceLandmarkerRef.current) faceLandmarkerRef.current.close();
      if (poseLandmarkerRef.current) poseLandmarkerRef.current.close();
    };
  }, []);

  useEffect(() => {
    let animationFrameId: number;

    const detect = () => {
      if (
        videoRef.current &&
        videoRef.current.readyState >= 2 &&
        isLoaded &&
        faceLandmarkerRef.current &&
        poseLandmarkerRef.current
      ) {
        const video = videoRef.current;
        let startTimeMs = performance.now();
        if (lastVideoTimeRef.current !== video.currentTime) {
          lastVideoTimeRef.current = video.currentTime;

          try {
            const faceResult = faceLandmarkerRef.current.detectForVideo(video, startTimeMs);
            const poseResult = poseLandmarkerRef.current.detectForVideo(video, startTimeMs);

            const nextFaces = faceResult.faceLandmarks || [];
            const nextPoses = poseResult.landmarks || [];

            setFaces((prev) => (prev.length === 0 && nextFaces.length === 0 ? prev : nextFaces));
            setPoses((prev) => (prev.length === 0 && nextPoses.length === 0 ? prev : nextPoses));
          } catch (e) {
            console.error('Detection error:', e);
          }
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
