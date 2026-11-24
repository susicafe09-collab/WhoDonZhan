import { useRef, useEffect } from 'react';
import { PlantItem } from '../types';

export interface HandPoint {
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
  /** 手要揮多遠才撥開（畫面高度的比例，0.15 = 15%），越小越靈敏 */
  waveDistance?: number;
  onWaveStroke: (plantId: string) => void;
  onHandActive?: (points: HandPoint[]) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// 可微調參數（座標已由離屏畫布轉正與鏡像，0.0~1.0 = 螢幕位置）
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_WAVE_DISTANCE = 0.15; // 0.5 秒內在植物附近累積揮過畫面高度 15% 才算
const MIN_HAND_VISIBILITY = 0.5; // 模型自己也沒把握的點不算（原本 0.2）
const SMOOTH_TAU_MS = 80; // 手的位置平滑，濾掉辨識抖動
const WAVE_WINDOW_MS = 500; // 只看最近 0.5 秒的揮動
const JUMP_RESET = 0.2; // 一格內跳超過畫面 20% = 認錯人，重來
const REARM_MS = 600; // 撥開或歸位後 0.6 秒內不重複觸發
const ZONE_MARGIN = 0.08; // 植物外圍多留 8% 當觸發範圍
const STAGE_ASPECT = 9 / 16; // 舞台寬高比：把左右移動換算成跟上下同一把尺

// 一隻手只算一個點：手腕和手尖端的中間
const HANDS = [
  { hand: 'left' as const, wrist: 15, tip: 19 },
  { hand: 'right' as const, wrist: 16, tip: 20 },
];

/** 植物在螢幕上的範圍（跟 Plant.tsx 的擺放位置一致）＋外圍 8% */
export const plantZone = (plant: PlantItem) => {
  const offset = (plant.horizontalOffsetPercent ?? -5) / 100;
  const isLeft = plant.side === 'left';
  const isBottom = plant.positionType === 'bottom';
  const w = isBottom ? 0.42 : 0.35;
  const h = isBottom ? 0.29 : 0.21;
  const top = isBottom ? 1 - h : (plant.topPercent ?? 20) / 100;
  const left = isLeft ? offset : 1 - offset - w;
  return {
    x1: left - ZONE_MARGIN,
    x2: left + w + ZONE_MARGIN,
    y1: top - ZONE_MARGIN,
    y2: top + h + ZONE_MARGIN,
  };
};

type Sample = { t: number; x: number; y: number };
type Track = { x: number; y: number; t: number; samples: Sample[] };

const readHand = (pose: any, wristId: number, tipId: number) => {
  const ok = (p: any) =>
    p && !(typeof p.visibility === 'number' && p.visibility < MIN_HAND_VISIBILITY);
  const w = pose[wristId];
  const t = pose[tipId];
  if (ok(w) && ok(t)) return { x: (w.x + t.x) / 2, y: (w.y + t.y) / 2 };
  if (ok(w)) return { x: w.x, y: w.y };
  return null;
};

/**
 * 撥開葉子：手要真的在植物附近揮過一段距離才算。
 * 手放著不動只有細小抖動 → 平滑後累積不到門檻 → 不會誤觸。
 */
export const useLeafHandTracking = ({
  poses,
  plants,
  enabled,
  requiredWaveCount: _requiredWaveCount,
  waveDistance = DEFAULT_WAVE_DISTANCE,
  onWaveStroke,
  onHandActive,
}: UseLeafHandTrackingParams) => {
  const tracksRef = useRef<Record<string, Track>>({});
  // 每株植物「從這個時間之後的揮動才算」：撥開／歸位時更新，手停在原地不會馬上又撥開
  const armedAtRef = useRef<Record<string, number>>({});
  const wasPushedRef = useRef<Record<string, boolean>>({});

  const plantsRef = useRef<PlantItem[]>(plants);
  plantsRef.current = plants;
  const waveDistanceRef = useRef(waveDistance);
  waveDistanceRef.current = waveDistance;
  const onWaveStrokeRef = useRef(onWaveStroke);
  onWaveStrokeRef.current = onWaveStroke;
  const onHandActiveRef = useRef(onHandActive);
  onHandActiveRef.current = onHandActive;
  const hadActiveHandsRef = useRef(false);

  useEffect(() => {
    const now = performance.now();

    // 植物歸位的那一刻重新上膛
    for (const plant of plantsRef.current) {
      const was = wasPushedRef.current[plant.id] ?? false;
      if (was !== plant.isPushed) armedAtRef.current[plant.id] = now + REARM_MS;
      wasPushedRef.current[plant.id] = plant.isPushed;
    }

    if (!enabled || !poses || poses.length === 0) {
      tracksRef.current = {};
      if (hadActiveHandsRef.current) {
        hadActiveHandsRef.current = false;
        onHandActiveRef.current?.([]);
      }
      return;
    }

    const activeHands: HandPoint[] = [];
    const nextTracks: Record<string, Track> = {};

    poses.forEach((pose, personIdx) => {
      if (!pose) return;
      for (const { hand, wrist, tip } of HANDS) {
        const raw = readHand(pose, wrist, tip);
        if (!raw) continue;
        // 螢幕外的手不算
        if (raw.x < 0 || raw.x > 1 || raw.y < 0 || raw.y > 1) continue;

        const id = `p${personIdx}-${hand}`;
        const prev = tracksRef.current[id];
        let track: Track;
        if (!prev || now - prev.t > 500 || Math.hypot(raw.x - prev.x, raw.y - prev.y) > JUMP_RESET) {
          track = { x: raw.x, y: raw.y, t: now, samples: [] };
        } else {
          const alpha = 1 - Math.exp(-(now - prev.t) / SMOOTH_TAU_MS);
          track = {
            x: prev.x + (raw.x - prev.x) * alpha,
            y: prev.y + (raw.y - prev.y) * alpha,
            t: now,
            samples: prev.samples.filter((s) => now - s.t <= WAVE_WINDOW_MS),
          };
        }
        track.samples.push({ t: now, x: track.x, y: track.y });
        nextTracks[id] = track;

        activeHands.push({ x: track.x * 100, y: track.y * 100, hand, id });

        // 每株植物：只算「終點落在植物範圍內」、而且在上膛之後的移動
        const s = track.samples;
        for (const plant of plantsRef.current) {
          if (plant.isPushed) continue;
          const armedAt = armedAtRef.current[plant.id] ?? 0;
          if (now < armedAt) continue;
          const z = plantZone(plant);
          let path = 0;
          for (let k = 1; k < s.length; k++) {
            const b = s[k];
            if (s[k - 1].t < armedAt) continue;
            if (b.x < z.x1 || b.x > z.x2 || b.y < z.y1 || b.y > z.y2) continue;
            path += Math.hypot((b.x - s[k - 1].x) * STAGE_ASPECT, b.y - s[k - 1].y);
          }
          if (path >= waveDistanceRef.current) {
            armedAtRef.current[plant.id] = now + REARM_MS;
            onWaveStrokeRef.current(plant.id);
            break;
          }
        }
      }
    });
    tracksRef.current = nextTracks;

    if (activeHands.length > 0) {
      hadActiveHandsRef.current = true;
      onHandActiveRef.current?.(activeHands);
    } else if (hadActiveHandsRef.current) {
      hadActiveHandsRef.current = false;
      onHandActiveRef.current?.([]);
    }
  }, [poses, enabled]);
};
