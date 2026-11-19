import { useRef, useEffect } from 'react';
import { PlantItem } from '../types';
import {
  VideoCoverProjection,
  IDENTITY_VIDEO_PROJECTION,
  projectVideoPointToStage,
} from '../utils/videoProjection';

interface HandPoint {
  x: number; // visual screen percentage (0 - 100)
  y: number; // visual screen percentage (0 - 100)
  hand: 'left' | 'right';
  id: string;
}

interface UseLeafHandTrackingParams {
  poses: any[];
  faces: any[];
  plants: PlantItem[];
  enabled: boolean;
  requiredWaveCount: number;
  projection?: VideoCoverProjection;
  onWaveStroke: (plantId: string) => void;
  onHandActive?: (points: HandPoint[]) => void;
}

/**
 * Hand-Only Wave & Push Tracker for Leaf Parting ("撥開葉子")
 * Strictly uses MediaPipe Pose landmarks for wrists and hands (15, 16, 17, 18, 19, 20).
 * Prevents infinite re-render loops by:
 * 1. Storing plants in a ref so plant state changes (waves, countdowns) never trigger detection re-runs.
 * 2. Caching hand point states so onHandActive is only fired when positions or presence change.
 * 3. Enforcing a strict per-plant trigger debounce.
 */
export const useLeafHandTracking = ({
  poses,
  faces: _faces,
  plants,
  enabled,
  requiredWaveCount: _requiredWaveCount,
  projection = IDENTITY_VIDEO_PROJECTION,
  onWaveStroke,
  onHandActive,
}: UseLeafHandTrackingParams) => {
  // Store previous hand positions to calculate velocity
  const prevHandsRef = useRef<{
    [key: string]: { x: number; y: number; time: number };
  }>({});

  // Debounce triggers per plant to avoid rapid re-triggering in a single gesture
  const lastTriggerTimeRef = useRef<{ [plantId: string]: number }>({});

  // Keep plants, projection, and callbacks in refs so changes don't re-trigger the effect
  const plantsRef = useRef<PlantItem[]>(plants);
  plantsRef.current = plants;

  const projectionRef = useRef<VideoCoverProjection>(projection);
  projectionRef.current = projection;

  const onWaveStrokeRef = useRef(onWaveStroke);
  onWaveStrokeRef.current = onWaveStroke;

  const onHandActiveRef = useRef(onHandActive);
  onHandActiveRef.current = onHandActive;

  // Track whether hands were active on the previous frame to avoid spamming empty arrays
  const hadActiveHandsRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled || !poses || poses.length === 0) {
      if (hadActiveHandsRef.current) {
        hadActiveHandsRef.current = false;
        onHandActiveRef.current?.([]);
      }
      return;
    }

    const now = performance.now();
    const activeHands: HandPoint[] = [];

    // MediaPipe Pose landmarks for arms and hands:
    // Left elbow: 13, Right elbow: 14
    // Left wrist: 15, Right wrist: 16
    // Left pinky: 17, Right pinky: 18
    // Left index: 19, Right index: 20
    // Visual display is mirrored horizontally: screenX = 1 - landmark.x, screenY = landmark.y

    poses.forEach((pose, personIdx) => {
      if (!pose) return;
      const lShoulder = pose[11];
      const rShoulder = pose[12];
      const leftElbow = pose[13];
      const rightElbow = pose[14];
      const leftWrist = pose[15];
      const rightWrist = pose[16];
      const leftPinky = pose[17];
      const rightPinky = pose[18];
      const leftIndex = pose[19];
      const rightIndex = pose[20];

      // 距離自適應速度門檻：將雙肩座標投影至目前直式／橫式可視畫布，
      // 確保旋轉螢幕或 object-fit: cover 裁切後，手勢速度與距離判定依然準確！
      const proj = projectionRef.current;
      const shoulderDist =
        lShoulder && rShoulder
          ? (() => {
              const ls = projectVideoPointToStage(lShoulder.x, lShoulder.y, proj, true);
              const rs = projectVideoPointToStage(rShoulder.x, rShoulder.y, proj, true);
              return Math.hypot(ls.x - rs.x, ls.y - rs.y);
            })()
          : 0.25;
      const distScale = Math.min(1.3, Math.max(0.35, shoulderDist / 0.26));
      const requiredSpeed = 0.12 * distScale; // 遠距離時降至 ~0.045
      const requiredVx = 0.00008 * distScale;

      // 嚴格手部特徵點：手腕 (15, 16) 與指尖 (17, 18, 19, 20)，排除手肘以免身體轉動誤觸
      const handCandidates: {
        point: any;
        hand: 'left' | 'right';
        id: string;
      }[] = [];

      // 手腕
      if (leftWrist && (leftWrist.visibility === undefined || leftWrist.visibility > 0.3)) {
        handCandidates.push({ point: leftWrist, hand: 'left', id: `p${personIdx}-lw` });
      }
      if (rightWrist && (rightWrist.visibility === undefined || rightWrist.visibility > 0.3)) {
        handCandidates.push({ point: rightWrist, hand: 'right', id: `p${personIdx}-rw` });
      }

      // 指尖（食指、小指）
      if (leftIndex && (leftIndex.visibility === undefined || leftIndex.visibility > 0.3)) {
        handCandidates.push({ point: leftIndex, hand: 'left', id: `p${personIdx}-li` });
      }
      if (rightIndex && (rightIndex.visibility === undefined || rightIndex.visibility > 0.3)) {
        handCandidates.push({ point: rightIndex, hand: 'right', id: `p${personIdx}-ri` });
      }
      if (leftPinky && (leftPinky.visibility === undefined || leftPinky.visibility > 0.3)) {
        handCandidates.push({ point: leftPinky, hand: 'left', id: `p${personIdx}-lp` });
      }
      if (rightPinky && (rightPinky.visibility === undefined || rightPinky.visibility > 0.3)) {
        handCandidates.push({ point: rightPinky, hand: 'right', id: `p${personIdx}-rp` });
      }

      handCandidates.forEach(({ point, hand, id }) => {
        // 依據 object-fit: cover 的畫布裁切與鏡像關係，轉換為目前直／橫螢幕的精確可視座標 (0.0 ~ 1.0)
        const { x: screenX, y: screenY } = projectVideoPointToStage(
          point.x,
          point.y,
          proj,
          true
        );

        // Push to active hand points if onHandActive callback is provided
        if (onHandActiveRef.current && (id.endsWith('-lw') || id.endsWith('-rw'))) {
          activeHands.push({
            x: Math.max(0, Math.min(100, screenX * 100)),
            y: Math.max(0, Math.min(100, screenY * 100)),
            hand,
            id,
          });
        }

        // Calculate velocity
        const prev = prevHandsRef.current[id];
        let speed = 0;
        let vx = 0;
        let vy = 0;

        if (prev) {
          const dt = Math.max(1, now - prev.time);
          vx = (screenX - prev.x) / dt;
          vy = (screenY - prev.y) / dt;
          speed = Math.hypot(vx, vy) * 1000; // normalized speed per second
        }

        prevHandsRef.current[id] = { x: screenX, y: screenY, time: now };

        // Test each plant using latest reference from plantsRef
        const currentPlants = plantsRef.current;
        for (let i = 0; i < currentPlants.length; i++) {
          const plant = currentPlants[i];
          // If already pushed and counting down, skip
          if (plant.isPushed) continue;

          const lastTrig = lastTriggerTimeRef.current[plant.id] || 0;
          if (now - lastTrig < 600) continue; // 600ms debounce between strokes

          // Check if hand is near this plant
          const isBottomPlant = plant.positionType === 'bottom';

          if (isBottomPlant) {
            // 地板左右植物槽位：位於畫面下半部左右兩側 (screenY > 0.58)
            const isNearY = screenY > 0.58;
            const isNearX = plant.side === 'left' ? screenX < 0.45 : screenX > 0.55;
            if (isNearX && isNearY) {
              const isMoving = speed > requiredSpeed || Math.abs(vx) > requiredVx || Math.abs(vy) > requiredVx;
              if (isMoving) {
                lastTriggerTimeRef.current[plant.id] = now;
                onWaveStrokeRef.current(plant.id);
                break;
              }
            }
          } else {
            // 側邊懸掛植物槽位：依據 plant.topPercent 垂直中心與左右側判定
            const plantTop = (plant.topPercent ?? 30) / 100;
            const isNearY = Math.abs(screenY - plantTop) < 0.18;
            const isNearX = plant.side === 'left' ? screenX < 0.40 : screenX > 0.60;

            if (isNearX && isNearY) {
              const isMoving = speed > requiredSpeed || Math.abs(vx) > requiredVx || Math.abs(vy) > requiredVx;
              if (isMoving) {
                lastTriggerTimeRef.current[plant.id] = now;
                onWaveStrokeRef.current(plant.id);
                break;
              }
            }
          }
        }
      });
    });

    if (activeHands.length > 0) {
      hadActiveHandsRef.current = true;
      onHandActiveRef.current?.(activeHands);
    } else if (hadActiveHandsRef.current) {
      hadActiveHandsRef.current = false;
      onHandActiveRef.current?.([]);
    }
  }, [poses, enabled]);
};
