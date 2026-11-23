import { useRef, useEffect } from 'react';
import { PlantItem } from '../types';

interface HandPoint {
  x: number; // visual screen percentage (0 - 100)
  y: number; // visual screen percentage (0 - 100)
  hand: 'left' | 'right';
  id: string;
}

interface UseLeafHandTrackingParams {
  poses: any[];
  plants: PlantItem[];
  enabled: boolean;
  requiredWaveCount: number;
  onWaveStroke: (plantId: string) => void;
  onHandActive?: (points: HandPoint[]) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// 植物互動靈敏度參數（座標已由離屏迷你畫布預先轉正與鏡像，直接為 0.0~1.0 螢幕座標）
// ─────────────────────────────────────────────────────────────────────────────
const STRICT_HAND_LANDMARKS: ReadonlyArray<{
  index: 15 | 16 | 19 | 20;
  hand: 'left' | 'right';
  suffix: string;
}> = [
  { index: 15, hand: 'left', suffix: 'lw' }, // 左手腕
  { index: 16, hand: 'right', suffix: 'rw' }, // 右手腕
  { index: 19, hand: 'left', suffix: 'li' }, // 左手掌／食指根部
  { index: 20, hand: 'right', suffix: 'ri' }, // 右手掌／食指根部
];

const MIN_HAND_VISIBILITY = 0.2;
const MIN_WAVE_SPEED = 0.055; // 降低揮動速度門檻，提升撥葉靈敏度
const MIN_FRAME_DISPLACEMENT = 0.014; // 單幀最小位移（約 1.4% 畫面寬高即可靈敏觸發）
const TRIGGER_DEBOUNCE_MS = 350; // 單株植物防重複觸發間隔

// 放大手部觸發半徑，讓揮手撥開更直覺順手
const BOTTOM_TRIGGER_MIN_Y = 0.48;
const BOTTOM_LEFT_MAX_X = 0.52;
const BOTTOM_RIGHT_MIN_X = 0.48;
const SIDE_TRIGGER_RADIUS_Y = 0.24;
const SIDE_LEFT_MAX_X = 0.48;
const SIDE_RIGHT_MIN_X = 0.52;

/**
 * Hand-Only Wave & Push Tracker for Leaf Parting ("撥開葉子")
 * 嚴格限定僅追蹤手部點位：Pose 模型左右手腕 (15, 16) 與左右手掌 (19, 20)，
 * 完全排除頭部與軀幹點位 (0~12)，避免觀眾走過或點頭誤觸植物。
 */
export const useLeafHandTracking = ({
  poses,
  plants,
  enabled,
  requiredWaveCount: _requiredWaveCount,
  onWaveStroke,
  onHandActive,
}: UseLeafHandTrackingParams) => {
  const prevHandsRef = useRef<{
    [key: string]: { x: number; y: number; time: number };
  }>({});

  const lastTriggerTimeRef = useRef<{ [plantId: string]: number }>({});

  const plantsRef = useRef<PlantItem[]>(plants);
  plantsRef.current = plants;

  const onWaveStrokeRef = useRef(onWaveStroke);
  onWaveStrokeRef.current = onWaveStroke;

  const onHandActiveRef = useRef(onHandActive);
  onHandActiveRef.current = onHandActive;

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

    poses.forEach((pose, personIdx) => {
      if (!pose) return;

      // 嚴格僅讀取手部關鍵點 (15, 16, 19, 20)，絕不讀取頭部與軀幹點位 (0~12)
      for (let h = 0; h < STRICT_HAND_LANDMARKS.length; h++) {
        const { index, hand, suffix } = STRICT_HAND_LANDMARKS[h];
        const point = pose[index];
        if (!point) continue;
        if (typeof point.visibility === 'number' && point.visibility < MIN_HAND_VISIBILITY) {
          continue;
        }

        // 離屏迷你畫布已轉正並套用鏡像，直接使用標準化螢幕座標 (0.0 ~ 1.0)
        const screenX = point.x;
        const screenY = point.y;
        const id = `p${personIdx}-${suffix}`;

        if (onHandActiveRef.current && (suffix === 'lw' || suffix === 'rw')) {
          activeHands.push({
            x: Math.max(0, Math.min(100, screenX * 100)),
            y: Math.max(0, Math.min(100, screenY * 100)),
            hand,
            id,
          });
        }

        const prev = prevHandsRef.current[id];
        let speed = 0;
        let frameDelta = 0;

        if (prev) {
          const dt = Math.max(1, now - prev.time);
          // 僅在連續追蹤間隔合理（< 600ms）時計算揮動速度，防止離場再進場瞬間跳變誤觸
          if (dt < 600) {
            frameDelta = Math.hypot(screenX - prev.x, screenY - prev.y);
            speed = (frameDelta / dt) * 1000;
          }
        }

        prevHandsRef.current[id] = { x: screenX, y: screenY, time: now };

        const isMoving = speed > MIN_WAVE_SPEED || frameDelta > MIN_FRAME_DISPLACEMENT;
        if (!isMoving) continue;

        const currentPlants = plantsRef.current;
        for (let i = 0; i < currentPlants.length; i++) {
          const plant = currentPlants[i];
          if (plant.isPushed) continue;

          const lastTrig = lastTriggerTimeRef.current[plant.id] || 0;
          if (now - lastTrig < TRIGGER_DEBOUNCE_MS) continue;

          const isBottomPlant = plant.positionType === 'bottom';

          if (isBottomPlant) {
            const isNearY = screenY > BOTTOM_TRIGGER_MIN_Y;
            const isNearX =
              plant.side === 'left'
                ? screenX < BOTTOM_LEFT_MAX_X
                : screenX > BOTTOM_RIGHT_MIN_X;

            if (isNearX && isNearY) {
              lastTriggerTimeRef.current[plant.id] = now;
              onWaveStrokeRef.current(plant.id);
              break;
            }
          } else {
            const plantCenterY = ((plant.topPercent ?? 30) + 9) / 100;
            const isNearY = Math.abs(screenY - plantCenterY) < SIDE_TRIGGER_RADIUS_Y;
            const isNearX =
              plant.side === 'left'
                ? screenX < SIDE_LEFT_MAX_X
                : screenX > SIDE_RIGHT_MIN_X;

            if (isNearX && isNearY) {
              lastTriggerTimeRef.current[plant.id] = now;
              onWaveStrokeRef.current(plant.id);
              break;
            }
          }
        }
      }
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
