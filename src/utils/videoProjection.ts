export interface VideoCoverProjection {
  videoWidth: number;
  videoHeight: number;
  stageWidth: number;
  stageHeight: number;
  /** 可見區域佔原始視訊寬度的比例 (0..1) */
  visibleRatioX: number;
  /** 可見區域佔原始視訊高度的比例 (0..1) */
  visibleRatioY: number;
  /** 左右單側裁切比例 (0..0.5) */
  cropX: number;
  /** 上下單側裁切比例 (0..0.5) */
  cropY: number;
}

export const IDENTITY_VIDEO_PROJECTION: VideoCoverProjection = {
  videoWidth: 1,
  videoHeight: 1,
  stageWidth: 1,
  stageHeight: 1,
  visibleRatioX: 1,
  visibleRatioY: 1,
  cropX: 0,
  cropY: 0,
};

/**
 * 依據視訊原始解析度與目前互動畫布尺寸，計算 object-fit: cover + object-position: center
 * 的精確座標投影參數，確保切換直式／橫式後所有 MediaPipe 追蹤點位與畫布完全對齊、零偏移。
 */
export function computeVideoCoverProjection(
  videoWidth: number,
  videoHeight: number,
  stageWidth: number,
  stageHeight: number
): VideoCoverProjection {
  if (
    !videoWidth ||
    !videoHeight ||
    !stageWidth ||
    !stageHeight ||
    videoWidth <= 0 ||
    videoHeight <= 0 ||
    stageWidth <= 0 ||
    stageHeight <= 0
  ) {
    return IDENTITY_VIDEO_PROJECTION;
  }

  const videoAspect = videoWidth / videoHeight;
  const stageAspect = stageWidth / stageHeight;

  let visibleRatioX = 1;
  let visibleRatioY = 1;

  if (videoAspect > stageAspect) {
    // 視訊較寬（例如 16:9 攝影機呈現在 9:16 直式畫布）：左右裁切，高度滿版
    visibleRatioX = stageAspect / videoAspect;
    visibleRatioY = 1;
  } else if (videoAspect < stageAspect) {
    // 視訊較高（例如直式鏡頭呈現在寬畫布）：上下裁切，寬度滿版
    visibleRatioX = 1;
    visibleRatioY = videoAspect / stageAspect;
  }

  return {
    videoWidth,
    videoHeight,
    stageWidth,
    stageHeight,
    visibleRatioX,
    visibleRatioY,
    cropX: (1 - visibleRatioX) / 2,
    cropY: (1 - visibleRatioY) / 2,
  };
}

/**
 * 將原始視訊正規化座標 (0..1) 投影轉換至目前互動畫布可視區域座標 (0..1)。
 * @param rawX 原始 MediaPipe landmark X (0..1)
 * @param rawY 原始 MediaPipe landmark Y (0..1)
 * @param projection 當前畫布 object-fit: cover 投影資訊
 * @param mirrored 是否已套用水平鏡像 (-scale-x-100)
 */
export function projectVideoPointToStage(
  rawX: number,
  rawY: number,
  projection: VideoCoverProjection,
  mirrored = true
): { x: number; y: number } {
  const baseX = mirrored ? 1 - rawX : rawX;
  const x = (baseX - projection.cropX) / projection.visibleRatioX;
  const y = (rawY - projection.cropY) / projection.visibleRatioY;
  return { x, y };
}

/**
 * 將原始視訊中的寬度比例 (0..1) 換算為畫布寬度比例 (0..1)，
 * 避免直式裁切後頭飾／物件尺寸比例失真。
 */
export function projectVideoWidthToStage(
  rawWidth: number,
  projection: VideoCoverProjection
): number {
  return rawWidth / projection.visibleRatioX;
}
