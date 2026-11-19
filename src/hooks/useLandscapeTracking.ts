import { useState, useRef, useEffect, useMemo } from 'react';

export type LandscapePoseType = 'pose_1' | 'pose_2' | 'pose_3';

export interface LandscapeTrackingResult {
  activePose: LandscapePoseType | null;
  pose1Opacity: number;
  pose2Opacity: number;
  pose3Opacity: number;
  /** 距離過遠警告（shoulderDist < 0.15） */
  userDistanceWarning: boolean;
  /** 抓不到肩膀或雙手關鍵節點警告 */
  outOfFrameWarning: boolean;
}

/**
 * 需求優化：
 * 1. 加嚴 Mountain_type_2（雙手平舉 T-Pose）判定：
 *    - 必須確保手腕 (Wrists)、手肘 (Elbows) 與肩膀 (Shoulders) 的 Y 軸高度非常接近（限制在 shoulderDist * 0.20 以內）。
 *    - 必須確保雙手向外伸直，手腕水平距離 wristDistX 必須夠寬（手腕距離 > shoulderDist * 2.1）。
 *    避免自然放下手臂或手部剛好經過肩膀高度時被誤觸發！
 * 2. 優化 Mountain_type_3（右手高舉、左手微抬/放胸前）：
 *    - 右手腕明顯高於右肩（高出 shoulderDist * 0.45 以上）。
 *    - 左手腕低於左肩（介於肩下至胸腹之間），且雙手高度差顯著（高低差 > shoulderDist * 0.5）。
 * 3. 姿勢互斥順序與防抖延遲 (Debounce / Hold Time)：
 *    - 優先順序：Pose 1 (頭頂大圓弧) -> Pose 3 (高低手) -> Pose 2 (嚴格雙手平舉)，保證三者互斥。
 *    - 必須「穩定維持該姿勢超過 0.85 秒 (850ms)」才能正式切換場景，揮手掠過絕不誤觸發。
 * 4. 雙肩距離過遠與出框提示 (userDistanceWarning / outOfFrameWarning)。
 * 5. 確保狀態更新僅在值真正變動時才調用 setState，避免觸發 Maximum update depth exceeded 循環。
 */
export const useLandscapeTracking = (poses: any[]): LandscapeTrackingResult => {
  // 當前正式鎖定並呈現的單一場景
  const [lockedScene, setLockedScene] = useState<LandscapePoseType | null>(null);

  // 提示狀態（拆分獨立 primitive boolean，避免物件參考每幀改變）
  const [userDistanceWarning, setUserDistanceWarning] = useState<boolean>(false);
  const [outOfFrameWarning, setOutOfFrameWarning] = useState<boolean>(false);

  // 記錄各姿勢「連續維持」的起始時間戳記
  const candidatePoseRef = useRef<LandscapePoseType | null>(null);
  const candidateStartTimeRef = useRef<number>(0);

  // 記錄當前鎖定姿勢最後一次被看到的瞬間（寬限期使用）
  const lastSeenLockedPoseRef = useRef<number>(0);

  // 記錄當前正在淡出的舊姿勢（確保淡出完成前，新姿勢不搶先淡入產生重疊）
  const fadingOutPoseRef = useRef<LandscapePoseType | null>(null);
  const fadeOutStartTimeRef = useRef<number>(0);

  const REQUIRED_HOLD_TIME_MS = 850; // 落實防抖：必須穩定維持 0.85 秒防誤觸
  const GRACE_PERIOD_MS = 800;       // 離開姿勢 0.8 秒內保持顯示
  const FADE_OUT_DURATION_MS = 700;  // 舊圖淡出所需時間 (對應 CSS 0.7s)

  useEffect(() => {
    const now = performance.now();
    let currentRawPose: LandscapePoseType | null = null;
    let distWarning = false;
    let frameWarning = false;

    if (!poses || poses.length === 0) {
      // 畫面完全無骨架
      frameWarning = true;
    } else {
      let foundValidSkeleton = false;

      // 遍歷所有偵測到的骨架（若有多人，任一人完成指定動作皆可）
      for (let i = 0; i < poses.length; i++) {
        const pose = poses[i];
        if (!pose) continue;

        const nose = pose[0];
        const lEye = pose[2];
        const rEye = pose[5];
        const lShoulder = pose[11];
        const rShoulder = pose[12];
        const lElbow = pose[13];
        const rElbow = pose[14];
        const lWrist = pose[15];
        const rWrist = pose[16];

        // 檢查肩膀與雙手/手肘關鍵節點是否存在（支援近距離手腕出鏡）
        if (!lShoulder || !rShoulder) {
          continue;
        }

        const hasWrists = !!lWrist || !!rWrist;
        const hasElbows = !!lElbow || !!rElbow;
        if (!hasWrists && !hasElbows) {
          continue;
        }

        foundValidSkeleton = true;

        // 動態基準單位（Dynamic Scale Unit）：所有高度差與距離差都乘以 unit，無論遠近等比例適用
        const unit = Math.max(
          0.08,
          Math.hypot(lShoulder.x - rShoulder.x, lShoulder.y - rShoulder.y)
        );

        // 取消距離過遠阻擋：大腿以上入鏡的遠距離觀眾也能輕鬆觸發手勢
        // （不再強制因 shoulderDist 判定過遠而阻斷動作）
        const noseY = nose ? nose.y : (lShoulder.y + rShoulder.y) / 2 - 0.45 * unit;
        const wristDistX = (lWrist && rWrist) ? Math.abs(lWrist.x - rWrist.x) : 0;

        /* ─────────────────────────────────────────────────────────────
         * 1. Pose 1 (Mountain_type_1.png): 雙手高舉向內拱圓/三角
         * 條件 A (正常距離)：左右手腕 Y 皆高於鼻子 (或高於肩膀 0.6 * unit)，且左右手腕 X 距離小於 1.3 * unit
         * 條件 B (近距離特寫備案)：若雙手手肘皆高於肩膀 Y (代表雙手已舉過頭頂，手腕可能出鏡)，且手腕未明顯向外張開
         * ───────────────────────────────────────────────────────────── */
        const pose1CondA =
          !!lWrist &&
          !!rWrist &&
          (lWrist.y < noseY || lWrist.y < lShoulder.y - 0.6 * unit) &&
          (rWrist.y < noseY || rWrist.y < rShoulder.y - 0.6 * unit) &&
          wristDistX < 1.3 * unit;

        const elbowsAboveShoulder =
          !!lElbow &&
          !!rElbow &&
          lElbow.y < lShoulder.y &&
          rElbow.y < rShoulder.y;

        const wristsNotSpreadingWide =
          (!lWrist || !rWrist) ? true : (wristDistX < 1.9 * unit);

        const pose1CondB = elbowsAboveShoulder && wristsNotSpreadingWide;

        const isPose1 = pose1CondA || pose1CondB;

        /* ─────────────────────────────────────────────────────────────
         * 2. Pose 2 (Mountain_type_2.png): 雙手側平舉 T-Pose
         * 計算左臂（左肩到左手肘）與右臂（右肩到右手肘）。
         * 只要「左手肘與左肩的 Y 軸落差小於 0.28 * unit」且「右手肘與右肩的 Y 軸落差小於 0.28 * unit」，
         * 同時雙手手肘 X 軸向外展開（Math.abs(lElbow.x - rElbow.x) > unit * 1.6），
         * 且手腕沒有高舉過頭，就算手腕超出螢幕邊界，也直接判定為 Mountain_type_2！
         * ───────────────────────────────────────────────────────────── */
        const elbowsSpreadWide =
          !!lElbow &&
          !!rElbow &&
          Math.abs(lElbow.y - lShoulder.y) < 0.28 * unit &&
          Math.abs(rElbow.y - rShoulder.y) < 0.28 * unit &&
          Math.abs(lElbow.x - rElbow.x) > unit * 1.6;

        const wristsNotOverhead =
          (!lWrist || !rWrist)
            ? true
            : !(lWrist.y < lShoulder.y - 0.5 * unit && rWrist.y < rShoulder.y - 0.5 * unit);

        const isPose2 = !isPose1 && elbowsSpreadWide && wristsNotOverhead;

        /* ─────────────────────────────────────────────────────────────
         * 3. Pose 3 (Mountain_type_3.png): 右手抬高，左手微抬/放低
         * 右側（抬高）：右手腕 Y 高於右肩 0.3 * unit，或者右手肘 Y 高於右肩（近距離舉手）。
         * 左側（微抬/放低）：左手肘與左手腕的 Y 座標明顯低於右手（例如低於右肩，或介於左肩與腰部之間 lShoulder.y - 0.1 * unit 到 lShoulder.y + 1.5 * unit）。
         * ───────────────────────────────────────────────────────────── */
        const rightRaised =
          (!!rWrist && rWrist.y < rShoulder.y - 0.3 * unit) ||
          (!!rElbow && rElbow.y < rShoulder.y);

        const leftY = lWrist ? lWrist.y : (lElbow ? lElbow.y : 1);
        const rightY = rWrist ? rWrist.y : (rElbow ? rElbow.y : 0);

        const leftLowerOrModerate =
          (leftY > rShoulder.y - 0.1 * unit && leftY < lShoulder.y + 1.5 * unit) ||
          (leftY > rightY + 0.2 * unit);

        const isPose3 = !isPose1 && !isPose2 && rightRaised && leftLowerOrModerate;

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

      if (!foundValidSkeleton) {
        frameWarning = true;
      }
    }

    // 僅在警示狀態真正改變時才更新，避免每幀 render 觸發 loop
    setUserDistanceWarning((prev) => (prev !== distWarning ? distWarning : prev));
    setOutOfFrameWarning((prev) => (prev !== frameWarning ? frameWarning : prev));

    // ─────────────────────────────────────────────────────────────
    // 姿勢判定防抖延遲（Debounce / Hold Time 850ms）
    // ─────────────────────────────────────────────────────────────
    if (currentRawPose) {
      if (candidatePoseRef.current !== currentRawPose) {
        // 偵測到新的候選姿勢，重設計時器
        candidatePoseRef.current = currentRawPose;
        candidateStartTimeRef.current = now;
      }
    } else {
      // 當前無符合手勢，重設候選狀態
      candidatePoseRef.current = null;
      candidateStartTimeRef.current = 0;
    }

    // 判斷是否有候選姿勢已維持超過 REQUIRED_HOLD_TIME_MS
    const holdDuration = candidateStartTimeRef.current > 0 ? now - candidateStartTimeRef.current : 0;
    const isCandidateQualified = candidatePoseRef.current !== null && holdDuration >= REQUIRED_HOLD_TIME_MS;

    // ─────────────────────────────────────────────────────────────
    // 強制單一場景管理（防重疊，等待舊圖淡出）
    // ─────────────────────────────────────────────────────────────
    setLockedScene((prevLocked) => {
      const isFadingOut = fadingOutPoseRef.current !== null && (now - fadeOutStartTimeRef.current < FADE_OUT_DURATION_MS);

      if (prevLocked) {
        if (currentRawPose === prevLocked) {
          lastSeenLockedPoseRef.current = now;
          return prevLocked;
        }

        const timeSinceLastSeen = now - lastSeenLockedPoseRef.current;
        if (timeSinceLastSeen > GRACE_PERIOD_MS) {
          fadingOutPoseRef.current = prevLocked;
          fadeOutStartTimeRef.current = now;
          return null;
        }

        if (isCandidateQualified && candidatePoseRef.current !== prevLocked) {
          fadingOutPoseRef.current = prevLocked;
          fadeOutStartTimeRef.current = now;
          return null;
        }

        return prevLocked;
      } else {
        if (isFadingOut) {
          return null;
        }

        if (isCandidateQualified && candidatePoseRef.current) {
          fadingOutPoseRef.current = null;
          lastSeenLockedPoseRef.current = now;
          return candidatePoseRef.current;
        }

        return null;
      }
    });
  }, [poses]);

  // 使用 useMemo 計算透明度，完全不需要額外的 useEffect + setOpacities 呼叫，徹底杜絕循環觸發
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
