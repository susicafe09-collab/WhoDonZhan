import { useState, useRef, useEffect, useMemo } from 'react';

export type LandscapePoseType = 'pose_1' | 'pose_2' | 'pose_3';

export interface LandscapeTrackingResult {
  activePose: LandscapePoseType | null;
  pose1Opacity: number;
  pose2Opacity: number;
  pose3Opacity: number;
  /** 距離過遠警告 */
  userDistanceWarning: boolean;
  /** 抓不到上半身肩膀或雙手關鍵節點警告 */
  outOfFrameWarning: boolean;
}

const MIN_JOINT_VISIBILITY = 0.25;

const isVisibleJoint = (joint: any): boolean => {
  if (!joint) return false;
  if (typeof joint.visibility === 'number' && joint.visibility < MIN_JOINT_VISIBILITY) {
    return false;
  }
  return true;
};

/**
 * 山脈（風景手勢）模式上半身偵測 Hook：
 * 全程以肩寬 `shoulderDist = 距離(11, 12)` 作為動態比例基準，確保遠近站位皆可精準觸發。
 * 使用關鍵點：鼻子 (0)、雙肩 (11, 12)、雙腕 (15, 16)、雙食指 (19, 20)。
 *
 * 1. Mountain_type_1 (pose_1)：胸前三角形手勢 ▲
 * 2. Mountain_type_2 (pose_2)：下巴前水平一直線手勢 —
 * 3. Mountain_type_3 (pose_3)：單手高舉、單手平放的高低錯位手勢（不限左右）
 */
export const useLandscapeTracking = (poses: any[]): LandscapeTrackingResult => {
  const [lockedScene, setLockedScene] = useState<LandscapePoseType | null>(null);
  const lockedSceneRef = useRef<LandscapePoseType | null>(null);

  const [userDistanceWarning, setUserDistanceWarning] = useState<boolean>(false);
  const [outOfFrameWarning, setOutOfFrameWarning] = useState<boolean>(false);
  const userDistanceWarningRef = useRef<boolean>(false);
  const outOfFrameWarningRef = useRef<boolean>(false);

  const candidatePoseRef = useRef<LandscapePoseType | null>(null);
  const candidateStartTimeRef = useRef<number>(0);
  const lastSeenLockedPoseRef = useRef<number>(0);
  const fadingOutPoseRef = useRef<LandscapePoseType | null>(null);
  const fadeOutStartTimeRef = useRef<number>(0);

  const REQUIRED_HOLD_TIME_MS = 500; // 穩定保持 0.5 秒（0.4～0.6s 區間），防舉手經過誤觸
  const GRACE_PERIOD_MS = 800; // 離開姿勢 0.8 秒內維持顯示
  const FADE_OUT_DURATION_MS = 700; // 舊圖淡出時間（對應 CSS 0.7s）

  useEffect(() => {
    const now = performance.now();
    let currentRawPose: LandscapePoseType | null = null;
    const distWarning = false;
    let frameWarning = false;

    if (!poses || poses.length === 0) {
      frameWarning = true;
    } else {
      let foundValidUpperBody = false;

      for (let i = 0; i < poses.length; i++) {
        const pose = poses[i];
        if (!pose) continue;

        // 讀取指定上半身關鍵點：鼻子 (0)、雙肩 (11, 12)、雙腕 (15, 16)、雙食指 (19, 20)
        const nose = pose[0];
        const lShoulder = pose[11];
        const rShoulder = pose[12];
        const lWrist = pose[15];
        const rWrist = pose[16];
        const lIndex = pose[19];
        const rIndex = pose[20];

        if (!isVisibleJoint(lShoulder) || !isVisibleJoint(rShoulder)) {
          continue;
        }

        const hasLWrist = isVisibleJoint(lWrist);
        const hasRWrist = isVisibleJoint(rWrist);
        const hasLIndex = isVisibleJoint(lIndex);
        const hasRIndex = isVisibleJoint(rIndex);

        if (!hasLWrist || !hasRWrist) {
          continue;
        }

        foundValidUpperBody = true;

        // 肩寬作為全程比例基準（遠近站位自適應）
        const shoulderDist = Math.max(
          0.06,
          Math.hypot(lShoulder.x - rShoulder.x, lShoulder.y - rShoulder.y)
        );
        const shoulderAvgY = (lShoulder.y + rShoulder.y) * 0.5;
        const shoulderCenterX = (lShoulder.x + rShoulder.x) * 0.5;
        const noseY = isVisibleJoint(nose) ? nose.y : shoulderAvgY - 0.45 * shoulderDist;

        const wristDistX = Math.abs(lWrist.x - rWrist.x);
        const wristDiffY = Math.abs(lWrist.y - rWrist.y);
        const avgWristY = (lWrist.y + rWrist.y) * 0.5;
        const minWristY = Math.min(lWrist.y, rWrist.y);
        const maxWristY = Math.max(lWrist.y, rWrist.y);

        const hasBothIndices = hasLIndex && hasRIndex;
        const indexDist = hasBothIndices
          ? Math.hypot(lIndex.x - rIndex.x, lIndex.y - rIndex.y)
          : Infinity;
        const indexDistX = hasBothIndices
          ? Math.abs(lIndex.x - rIndex.x)
          : wristDistX;
        const avgIndexY = hasBothIndices ? (lIndex.y + rIndex.y) * 0.5 : avgWristY;
        const avgHandX = hasBothIndices
          ? (lIndex.x + rIndex.x) * 0.5
          : (lWrist.x + rWrist.x) * 0.5;
        const avgHandY = (avgIndexY + avgWristY) * 0.5;

        const fingertipsTouching = hasBothIndices && indexDist < 0.35 * shoulderDist;
        const wristsRoughlyLevel = wristDiffY < 0.25 * shoulderDist;
        const handsNearMidline = Math.abs(avgHandX - shoulderCenterX) < 0.65 * shoulderDist;

        /* ─────────────────────────────────────────────────────────────
         * 1. Mountain_type_1 (pose_1)：胸前三角形手勢 ▲
         *    - 指尖相觸：dist(19, 20) < 0.35 * shoulderDist
         *    - 形成斜角：avgWristY - avgIndexY > 0.15 * shoulderDist 且 |x15 - x16| > |x19 - x20|
         *    - 位置高度：胸前中線附近、avgIndexY > noseY、雙腕大致水平
         * ───────────────────────────────────────────────────────────── */
        const isPose1 =
          fingertipsTouching &&
          avgWristY - avgIndexY > 0.15 * shoulderDist &&
          wristDistX > indexDistX &&
          handsNearMidline &&
          avgIndexY > noseY &&
          wristsRoughlyLevel;

        /* ─────────────────────────────────────────────────────────────
         * 2. Mountain_type_2 (pose_2)：下巴前水平一直線手勢 —
         *    - 指尖相觸：dist(19, 20) < 0.35 * shoulderDist
         *    - 保持水平：|avgWristY - avgIndexY| < 0.15 * shoulderDist
         *      且 |x15 - x16| > 0.6 * shoulderDist、雙腕大致水平
         *    - 位置高度：介於鼻子 (0) 與肩膀中點高度之間
         * ───────────────────────────────────────────────────────────── */
        const isPose2 =
          !isPose1 &&
          fingertipsTouching &&
          Math.abs(avgWristY - avgIndexY) < 0.15 * shoulderDist &&
          wristDistX > 0.6 * shoulderDist &&
          wristsRoughlyLevel &&
          handsNearMidline &&
          avgHandY > noseY &&
          avgHandY < shoulderAvgY;

        /* ─────────────────────────────────────────────────────────────
         * 3. Mountain_type_3 (pose_3)：單手高舉、單手平放的高低錯位手勢（不限左右）
         *    - 雙手分開：|x19 - x20| > 0.5 * shoulderDist（且手腕不併攏於中線）
         *    - 顯著高低差：|y15 - y16| > 0.65 * shoulderDist
         *    - 較高手腕高於鼻子：min(y15, y16) < noseY
         *    - 較低手腕於肩膀附近或略低：max(y15, y16) > shoulderAvgY - 0.15 * shoulderDist
         * ───────────────────────────────────────────────────────────── */
        const isPose3 =
          !isPose1 &&
          !isPose2 &&
          indexDistX > 0.5 * shoulderDist &&
          wristDistX > 0.35 * shoulderDist &&
          wristDiffY > 0.65 * shoulderDist &&
          minWristY < noseY &&
          maxWristY > shoulderAvgY - 0.15 * shoulderDist;

        if (isPose1) {
          currentRawPose = 'pose_1';
          break;
        } else if (isPose2) {
          currentRawPose = 'pose_2';
          break;
        } else if (isPose3) {
          currentRawPose = 'pose_3';
          break;
        }
      }

      if (!foundValidUpperBody) {
        frameWarning = true;
      }
    }

    if (userDistanceWarningRef.current !== distWarning) {
      userDistanceWarningRef.current = distWarning;
      setUserDistanceWarning(distWarning);
    }
    if (outOfFrameWarningRef.current !== frameWarning) {
      outOfFrameWarningRef.current = frameWarning;
      setOutOfFrameWarning(frameWarning);
    }

    if (currentRawPose) {
      if (candidatePoseRef.current !== currentRawPose) {
        candidatePoseRef.current = currentRawPose;
        candidateStartTimeRef.current = now;
      }
    } else {
      candidatePoseRef.current = null;
      candidateStartTimeRef.current = 0;
    }

    const holdDuration =
      candidateStartTimeRef.current > 0 ? now - candidateStartTimeRef.current : 0;
    const isCandidateQualified =
      candidatePoseRef.current !== null && holdDuration >= REQUIRED_HOLD_TIME_MS;

    const prevLocked = lockedSceneRef.current;
    const isFadingOut =
      fadingOutPoseRef.current !== null &&
      now - fadeOutStartTimeRef.current < FADE_OUT_DURATION_MS;

    let nextLocked: LandscapePoseType | null = prevLocked;

    if (prevLocked) {
      if (currentRawPose === prevLocked) {
        lastSeenLockedPoseRef.current = now;
      } else {
        const timeSinceLastSeen = now - lastSeenLockedPoseRef.current;
        if (timeSinceLastSeen > GRACE_PERIOD_MS) {
          fadingOutPoseRef.current = prevLocked;
          fadeOutStartTimeRef.current = now;
          nextLocked = null;
        } else if (isCandidateQualified && candidatePoseRef.current !== prevLocked) {
          fadingOutPoseRef.current = prevLocked;
          fadeOutStartTimeRef.current = now;
          nextLocked = null;
        }
      }
    } else if (!isFadingOut && isCandidateQualified && candidatePoseRef.current) {
      fadingOutPoseRef.current = null;
      lastSeenLockedPoseRef.current = now;
      nextLocked = candidatePoseRef.current;
    }

    if (nextLocked !== prevLocked) {
      lockedSceneRef.current = nextLocked;
      setLockedScene(nextLocked);
    }
  }, [poses]);

  const pose1Opacity = useMemo(() => (lockedScene === 'pose_1' ? 1 : 0), [lockedScene]);
  const pose2Opacity = useMemo(() => (lockedScene === 'pose_2' ? 1 : 0), [lockedScene]);
  const pose3Opacity = useMemo(() => (lockedScene === 'pose_3' ? 1 : 0), [lockedScene]);

  return {
    activePose: lockedScene,
    pose1Opacity,
    pose2Opacity,
    pose3Opacity,
    userDistanceWarning,
    outOfFrameWarning,
  };
};
