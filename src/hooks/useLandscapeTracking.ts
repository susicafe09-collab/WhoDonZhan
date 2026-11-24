import { useState, useRef, useEffect, useMemo } from 'react';

export type LandscapePoseType = 'pose_1' | 'pose_2' | 'pose_3';

/** 除錯用：每個手勢的每個條件有沒有過 */
export interface LandscapeCheck {
  label: string;
  ok: boolean;
  /** true = 必要條件（一定要過）；false = 次要條件（可以錯一個） */
  core: boolean;
}
export interface LandscapePoseDebug {
  pose: LandscapePoseType;
  name: string;
  checks: LandscapeCheck[];
  matched: boolean;
}

export interface LandscapeTrackingResult {
  activePose: LandscapePoseType | null;
  pose1Opacity: number;
  pose2Opacity: number;
  pose3Opacity: number;
  /** 距離過遠警告 */
  userDistanceWarning: boolean;
  /** 抓不到上半身肩膀或雙手關鍵節點警告 */
  outOfFrameWarning: boolean;
  /** 只有 showDebug 時才有內容 */
  debug: LandscapePoseDebug[] | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 可微調參數（距離一律以「肩寬」= 兩肩距離為單位，遠近站位都適用）
// ─────────────────────────────────────────────────────────────────────────────
const MIN_JOINT_VISIBILITY = 0.25;
const SMOOTH_TAU_MS = 100; // 關鍵點平滑：越大越穩但越慢跟上
const VOTE_WINDOW_MS = 600; // 看最近 0.6 秒
const VOTE_RATIO = 0.6; // 6 成以上的畫面是同一個手勢就算數
const VOTE_MIN_FRAMES = 3; // 至少要看到 3 格
const GRACE_PERIOD_MS = 800; // 手勢放掉 0.8 秒內圖維持顯示
const FADE_OUT_DURATION_MS = 700; // 舊圖淡出時間（對應 CSS 0.7s）
const TICK_MS = 150; // 沒有新畫面時也定期檢查（人離開後圖才會收掉）

const HANDS_TOGETHER_INDEX = 0.6; // 兩手尖端距離 < 0.6 肩寬（原本 0.35）
const HANDS_TOGETHER_WRIST = 0.9; // 手尖端認不到時，改看兩手腕距離 < 0.9 肩寬
const POSE1_TIP_ABOVE_WRIST = 0.2; // 三角形：尖端比手腕高 > 0.2 肩寬
const POSE2_FLAT_MAX = 0.12; // 一字形：尖端和手腕高低差 < 0.12 肩寬（跟三角形之間留空檔，不會來回跳）
const MIDLINE_MAX = 0.8; // 手在身體中線附近 < 0.8 肩寬（原本 0.65）
const WRISTS_LEVEL_MAX = 0.35; // 兩手腕同高 < 0.35 肩寬（原本 0.25）
const POSE3_HEIGHT_DIFF = 0.5; // 一高一低：兩手腕高低差 > 0.5 肩寬（原本 0.65）

const LANDMARK_IDS = [0, 11, 12, 15, 16, 19, 20] as const;

type Pt = { x: number; y: number; visibility?: number };
type Smoothed = { pts: Record<number, Pt>; t: number };

const isVisibleJoint = (joint: Pt | undefined): joint is Pt =>
  Boolean(joint) && !(typeof joint!.visibility === 'number' && joint!.visibility! < MIN_JOINT_VISIBILITY);

/** 先把每個點跟前幾格做平均，濾掉辨識的細小抖動（用經過的時間算，每秒幾格都一樣） */
const smoothPose = (pose: any[], prev: Smoothed | undefined, now: number): Smoothed => {
  const pts: Record<number, Pt> = {};
  const dt = prev ? now - prev.t : Infinity;
  const ls = pose[11];
  const rs = pose[12];
  const pls = prev?.pts[11];
  const prs = prev?.pts[12];
  // 換人或隔太久：直接重來，不跟舊位置平均
  const jumped =
    !prev ||
    dt > 500 ||
    !ls || !rs || !pls || !prs ||
    Math.hypot((ls.x + rs.x) / 2 - (pls.x + prs.x) / 2, (ls.y + rs.y) / 2 - (pls.y + prs.y) / 2) > 0.2;
  const alpha = jumped ? 1 : 1 - Math.exp(-dt / SMOOTH_TAU_MS);

  for (const id of LANDMARK_IDS) {
    const cur = pose[id];
    if (!cur) continue;
    const old = prev?.pts[id];
    pts[id] =
      jumped || !old
        ? { x: cur.x, y: cur.y, visibility: cur.visibility }
        : {
            x: old.x + (cur.x - old.x) * alpha,
            y: old.y + (cur.y - old.y) * alpha,
            visibility: cur.visibility,
          };
  }
  return { pts, t: now };
};

/** 判斷一個人的姿勢：必要條件全過、次要條件最多錯一個 */
export const evaluateBody = (p: Record<number, Pt>): LandscapePoseDebug[] | null => {
  const nose = p[0];
  const lShoulder = p[11];
  const rShoulder = p[12];
  const lWrist = p[15];
  const rWrist = p[16];
  const lIndex = p[19];
  const rIndex = p[20];

  if (!isVisibleJoint(lShoulder) || !isVisibleJoint(rShoulder)) return null;
  if (!isVisibleJoint(lWrist) || !isVisibleJoint(rWrist)) return null;

  const sw = Math.max(0.06, Math.hypot(lShoulder.x - rShoulder.x, lShoulder.y - rShoulder.y));
  const shoulderAvgY = (lShoulder.y + rShoulder.y) * 0.5;
  const shoulderCenterX = (lShoulder.x + rShoulder.x) * 0.5;
  const noseY = isVisibleJoint(nose) ? nose.y : shoulderAvgY - 0.45 * sw;

  const wristDistX = Math.abs(lWrist.x - rWrist.x);
  const wristDist = Math.hypot(lWrist.x - rWrist.x, lWrist.y - rWrist.y);
  const wristDiffY = Math.abs(lWrist.y - rWrist.y);
  const avgWristY = (lWrist.y + rWrist.y) * 0.5;
  const minWristY = Math.min(lWrist.y, rWrist.y);
  const maxWristY = Math.max(lWrist.y, rWrist.y);

  const hasIdx = isVisibleJoint(lIndex) && isVisibleJoint(rIndex);
  const indexDist = hasIdx ? Math.hypot(lIndex!.x - rIndex!.x, lIndex!.y - rIndex!.y) : Infinity;
  const indexDistX = hasIdx ? Math.abs(lIndex!.x - rIndex!.x) : wristDistX;
  const avgIndexY = hasIdx ? (lIndex!.y + rIndex!.y) * 0.5 : avgWristY;
  const avgHandX = hasIdx ? (lIndex!.x + rIndex!.x) * 0.5 : (lWrist.x + rWrist.x) * 0.5;
  const avgHandY = (avgIndexY + avgWristY) * 0.5;

  // 手的尖端常被手擋住認不到 → 改看兩手腕夠不夠近
  const handsTogether = hasIdx
    ? indexDist < HANDS_TOGETHER_INDEX * sw
    : wristDist < HANDS_TOGETHER_WRIST * sw;
  const nearMidline = Math.abs(avgHandX - shoulderCenterX) < MIDLINE_MAX * sw;
  const wristsLevel = wristDiffY < WRISTS_LEVEL_MAX * sw;

  const make = (
    pose: LandscapePoseType,
    name: string,
    checks: LandscapeCheck[]
  ): LandscapePoseDebug => {
    const coreOk = checks.every((c) => c.core === false || c.ok);
    const secondaryFails = checks.filter((c) => !c.core && !c.ok).length;
    return { pose, name, checks, matched: coreOk && secondaryFails <= 1 };
  };

  return [
    // 1. 胸前三角形 ▲
    make('pose_1', '三角形', [
      { label: '兩手靠攏', ok: handsTogether, core: true },
      { label: '尖端比手腕高', ok: hasIdx && avgWristY - avgIndexY > POSE1_TIP_ABOVE_WRIST * sw, core: true },
      { label: '手比鼻子低', ok: avgIndexY > noseY, core: true },
      { label: '在身體中線', ok: nearMidline, core: false },
      { label: '手腕比尖端分得開', ok: wristDistX > indexDistX, core: false },
      { label: '兩手腕同高', ok: wristsLevel, core: false },
    ]),
    // 2. 下巴前一字形 —
    make('pose_2', '一字形', [
      { label: '兩手靠攏', ok: handsTogether, core: true },
      { label: '前臂平', ok: !hasIdx || Math.abs(avgWristY - avgIndexY) < POSE2_FLAT_MAX * sw, core: true },
      { label: '高度在下巴到肩膀', ok: avgHandY > noseY - 0.1 * sw && avgHandY < shoulderAvgY + 0.2 * sw, core: true },
      { label: '手腕分開', ok: wristDistX > 0.5 * sw, core: false },
      { label: '兩手腕同高', ok: wristsLevel, core: false },
      { label: '在身體中線', ok: nearMidline, core: false },
    ]),
    // 3. 一手高舉、一手平放（不分左右）
    make('pose_3', '一高一低', [
      { label: '兩手腕高低差大', ok: wristDiffY > POSE3_HEIGHT_DIFF * sw, core: true },
      { label: '高的手比鼻子高', ok: minWristY < noseY, core: true },
      { label: '兩手左右分開', ok: indexDistX > 0.5 * sw, core: false },
      { label: '手腕左右分開', ok: wristDistX > 0.35 * sw, core: false },
      { label: '低的手在肩膀附近', ok: maxWristY > shoulderAvgY - 0.15 * sw, core: false },
    ]),
  ];
};

/**
 * 山脈（風景手勢）模式上半身偵測 Hook：
 * 1. 每個點先平滑，濾掉抖動
 * 2. 每格判斷三個手勢：必要條件全過、次要條件最多錯一個
 * 3. 最近 0.6 秒內 6 成以上是同一個手勢才顯示（不用每一格都對）
 */
export const useLandscapeTracking = (
  poses: any[],
  showDebug = false
): LandscapeTrackingResult => {
  const [lockedScene, setLockedScene] = useState<LandscapePoseType | null>(null);
  const lockedSceneRef = useRef<LandscapePoseType | null>(null);

  const [outOfFrameWarning, setOutOfFrameWarning] = useState<boolean>(false);
  const outOfFrameWarningRef = useRef<boolean>(false);
  const [debug, setDebug] = useState<LandscapePoseDebug[] | null>(null);

  const smoothedRef = useRef<Record<number, Smoothed>>({});
  const historyRef = useRef<Array<{ t: number; pose: LandscapePoseType | null }>>([]);
  const lastSeenLockedPoseRef = useRef<number>(0);
  const fadingOutPoseRef = useRef<LandscapePoseType | null>(null);
  const fadeOutStartTimeRef = useRef<number>(0);

  // 依最近 0.6 秒的投票結果決定要不要顯示／換圖／收圖
  const updateLock = (now: number) => {
    const history = historyRef.current;
    while (history.length && now - history[0].t > VOTE_WINDOW_MS) history.shift();

    let candidate: LandscapePoseType | null = null;
    if (history.length >= VOTE_MIN_FRAMES) {
      const counts: Partial<Record<LandscapePoseType, number>> = {};
      for (const h of history) if (h.pose) counts[h.pose] = (counts[h.pose] || 0) + 1;
      for (const pose of Object.keys(counts) as LandscapePoseType[]) {
        if (counts[pose]! / history.length >= VOTE_RATIO) candidate = pose;
      }
    }

    const prevLocked = lockedSceneRef.current;
    const isFadingOut =
      fadingOutPoseRef.current !== null && now - fadeOutStartTimeRef.current < FADE_OUT_DURATION_MS;
    let nextLocked = prevLocked;

    if (prevLocked) {
      if (candidate === prevLocked) lastSeenLockedPoseRef.current = now;
      const lostTooLong = now - lastSeenLockedPoseRef.current > GRACE_PERIOD_MS;
      const switching = candidate !== null && candidate !== prevLocked;
      if (lostTooLong || switching) {
        fadingOutPoseRef.current = prevLocked;
        fadeOutStartTimeRef.current = now;
        nextLocked = null;
      }
    } else if (!isFadingOut && candidate) {
      fadingOutPoseRef.current = null;
      lastSeenLockedPoseRef.current = now;
      nextLocked = candidate;
    }

    if (nextLocked !== prevLocked) {
      lockedSceneRef.current = nextLocked;
      setLockedScene(nextLocked);
    }
  };
  const updateLockRef = useRef(updateLock);
  updateLockRef.current = updateLock;

  // 每來一格新的骨架：判斷手勢、記進投票紀錄
  useEffect(() => {
    const now = performance.now();
    let rawPose: LandscapePoseType | null = null;
    let firstChecks: LandscapePoseDebug[] | null = null;
    let foundValidUpperBody = false;
    const nextSmoothed: Record<number, Smoothed> = {};

    (poses || []).forEach((pose, i) => {
      if (!pose) return;
      const sm = smoothPose(pose, smoothedRef.current[i], now);
      nextSmoothed[i] = sm;
      if (rawPose) return;
      const checks = evaluateBody(sm.pts);
      if (!checks) return;
      foundValidUpperBody = true;
      if (!firstChecks) firstChecks = checks;
      const hit = checks.find((c) => c.matched);
      if (hit) {
        rawPose = hit.pose;
        firstChecks = checks;
      }
    });
    smoothedRef.current = nextSmoothed;

    historyRef.current.push({ t: now, pose: rawPose });
    updateLockRef.current(now);

    const frameWarning = !foundValidUpperBody;
    if (outOfFrameWarningRef.current !== frameWarning) {
      outOfFrameWarningRef.current = frameWarning;
      setOutOfFrameWarning(frameWarning);
    }
    if (showDebug) setDebug(firstChecks);
  }, [poses, showDebug]);

  // 沒有新畫面時（例如人走掉）也要讓圖照時間收掉
  useEffect(() => {
    const timer = window.setInterval(() => updateLockRef.current(performance.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const pose1Opacity = useMemo(() => (lockedScene === 'pose_1' ? 1 : 0), [lockedScene]);
  const pose2Opacity = useMemo(() => (lockedScene === 'pose_2' ? 1 : 0), [lockedScene]);
  const pose3Opacity = useMemo(() => (lockedScene === 'pose_3' ? 1 : 0), [lockedScene]);

  return {
    activePose: lockedScene,
    pose1Opacity,
    pose2Opacity,
    pose3Opacity,
    userDistanceWarning: false,
    outOfFrameWarning,
    debug: showDebug ? debug : null,
  };
};
