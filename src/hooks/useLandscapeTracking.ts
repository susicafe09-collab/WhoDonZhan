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

/** 計算手臂相對於水平線的仰角（度數：正值向上、0 度為水平、負值向下） */
const armElevationDeg = (shoulder: any, target: any): number => {
  const dx = Math.abs(target.x - shoulder.x);
  const dy = shoulder.y - target.y; // Y 向下增加，故 shoulder.y - target.y > 0 表示向上抬起
  return (Math.atan2(dy, Math.max(0.001, dx)) * 180) / Math.PI;
};

/**
 * 純上半身風景手勢追蹤 Hook：
 * 嚴格僅依賴肩膀 (11, 12)、手肘 (13, 14) 與手腕 (15, 16) 的相對位置與角度，
 * 完全移除頭部、腰部與下半身點位依賴，適合展場半身或近距離取景。
 *
 * 1. Pose 1 (Mountain_type_1): 雙手高舉頭頂拱圓／三角
 * 2. Pose 2 (Mountain_type_2): 雙手水平側平舉 (T-Pose)
 * 3. Pose 3 (Mountain_type_3): 單手高舉指天、另一手置於胸前
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

  const REQUIRED_HOLD_TIME_MS = 850; // 穩定維持 0.85 秒防誤觸
  const GRACE_PERIOD_MS = 800; // 離開姿勢 0.8 秒內維持顯示
  const FADE_OUT_DURATION_MS = 700; // 舊圖淡出時間 (對應 CSS 0.7s)

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

        // 嚴格僅讀取純上半身關鍵點：肩膀 (11, 12)、手肘 (13, 14)、手腕 (15, 16)
        const lShoulder = pose[11];
        const rShoulder = pose[12];
        const lElbow = pose[13];
        const rElbow = pose[14];
        const lWrist = pose[15];
        const rWrist = pose[16];

        if (!isVisibleJoint(lShoulder) || !isVisibleJoint(rShoulder)) {
          continue;
        }

        const hasLElbow = isVisibleJoint(lElbow);
        const hasRElbow = isVisibleJoint(rElbow);
        const hasLWrist = isVisibleJoint(lWrist);
        const hasRWrist = isVisibleJoint(rWrist);

        if (!hasLElbow && !hasRElbow && !hasLWrist && !hasRWrist) {
          continue;
        }

        foundValidUpperBody = true;

        // 以雙肩寬度作為等比縮放基準單位（完全不依賴腰部／下半身）
        const unit = Math.max(
          0.08,
          Math.hypot(lShoulder.x - rShoulder.x, lShoulder.y - rShoulder.y)
        );
        const shoulderMidY = (lShoulder.y + rShoulder.y) * 0.5;
        const wristDistX = hasLWrist && hasRWrist ? Math.abs(lWrist.x - rWrist.x) : 0;
        const elbowDistX = hasLElbow && hasRElbow ? Math.abs(lElbow.x - rElbow.x) : 0;

        /* ─────────────────────────────────────────────────────────────
         * 1. Pose 1 (Mountain_type_1): 雙手高舉頭頂拱圓／三角
         *    純以上半身肩膀、手肘與手腕高度與相對距離判定
         * ───────────────────────────────────────────────────────────── */
        const bothWristsHighAndClose =
          hasLWrist &&
          hasRWrist &&
          lWrist.y < lShoulder.y - 0.5 * unit &&
          rWrist.y < rShoulder.y - 0.5 * unit &&
          wristDistX < 1.45 * unit;

        const bothElbowsRaised =
          hasLElbow &&
          hasRElbow &&
          lElbow.y < lShoulder.y - 0.05 * unit &&
          rElbow.y < rShoulder.y - 0.05 * unit &&
          armElevationDeg(lShoulder, lElbow) > 15 &&
          armElevationDeg(rShoulder, rElbow) > 15;

        const wristsNotWide =
          !hasLWrist || !hasRWrist ? true : wristDistX < 1.9 * unit;

        const isPose1 = bothWristsHighAndClose || (bothElbowsRaised && wristsNotWide);

        /* ─────────────────────────────────────────────────────────────
         * 2. Pose 2 (Mountain_type_2): 雙手側平舉 T-Pose
         *    雙側上臂（肩→肘）接近水平（仰角 ±26° 內）且雙肘明顯向外展開
         * ───────────────────────────────────────────────────────────── */
        const elbowsLevelAndWide =
          hasLElbow &&
          hasRElbow &&
          Math.abs(lElbow.y - lShoulder.y) < 0.3 * unit &&
          Math.abs(rElbow.y - rShoulder.y) < 0.3 * unit &&
          Math.abs(armElevationDeg(lShoulder, lElbow)) < 26 &&
          Math.abs(armElevationDeg(rShoulder, rElbow)) < 26 &&
          elbowDistX > 1.55 * unit;

        const wristsAlignedHorizontal =
          !hasLWrist || !hasRWrist
            ? true
            : Math.abs(lWrist.y - lShoulder.y) < 0.5 * unit &&
              Math.abs(rWrist.y - rShoulder.y) < 0.5 * unit &&
              wristDistX > 1.85 * unit;

        const isPose2 = !isPose1 && elbowsLevelAndWide && wristsAlignedHorizontal;

        /* ─────────────────────────────────────────────────────────────
         * 3. Pose 3 (Mountain_type_3): 單手高舉指天、另一手置於胸前
         *    純依據雙肩與手肘／手腕的相對仰角與高低差判定（支援左右鏡像自然舉手）
         * ───────────────────────────────────────────────────────────── */
        const isArmRaisedHigh = (
          shoulder: any,
          elbow: any,
          wrist: any,
          hasE: boolean,
          hasW: boolean
        ) => {
          const wristHigh =
            hasW && wrist.y < shoulder.y - 0.35 * unit && armElevationDeg(shoulder, wrist) > 30;
          const elbowHigh =
            hasE && elbow.y < shoulder.y - 0.05 * unit && armElevationDeg(shoulder, elbow) > 18;
          return wristHigh || elbowHigh;
        };

        const isArmChestLevel = (
          shoulder: any,
          elbow: any,
          wrist: any,
          hasE: boolean,
          hasW: boolean
        ) => {
          const refY = hasW ? wrist.y : hasE ? elbow.y : shoulderMidY + 2 * unit;
          // 位於肩線附近至胸口下方範圍內（完全以肩寬 unit 推算，不參考腰部點位）
          return refY > shoulder.y - 0.1 * unit && refY < shoulder.y + 1.25 * unit;
        };

        const rightHigh = isArmRaisedHigh(rShoulder, rElbow, rWrist, hasRElbow, hasRWrist);
        const leftHigh = isArmRaisedHigh(lShoulder, lElbow, lWrist, hasLElbow, hasLWrist);

        const leftRefY = hasLWrist ? lWrist.y : hasLElbow ? lElbow.y : shoulderMidY + unit;
        const rightRefY = hasRWrist ? rWrist.y : hasRElbow ? rElbow.y : shoulderMidY + unit;

        const rightHighLeftChest =
          rightHigh &&
          !leftHigh &&
          isArmChestLevel(lShoulder, lElbow, lWrist, hasLElbow, hasLWrist) &&
          leftRefY - rightRefY > 0.35 * unit;

        const leftHighRightChest =
          leftHigh &&
          !rightHigh &&
          isArmChestLevel(rShoulder, rElbow, rWrist, hasRElbow, hasRWrist) &&
          rightRefY - leftRefY > 0.35 * unit;

        const isPose3 = !isPose1 && !isPose2 && (rightHighLeftChest || leftHighRightChest);

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
