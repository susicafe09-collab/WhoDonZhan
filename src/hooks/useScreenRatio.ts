import { useState, useEffect, useRef } from 'react';

export type ScreenOrientationType = 'portrait' | 'landscape';

export interface ScreenRatioInfo {
  width: number;
  height: number;
  /** 螢幕寬高比 (width / height)：< 1 為直式，>= 1 為橫式 */
  ratio: number;
  orientation: ScreenOrientationType;
  /** 是否為直式螢幕 (視窗高度大於寬度，或符合 (orientation: portrait)) */
  isPortrait: boolean;
  /** 是否為橫式螢幕 (width >= height) */
  isLandscape: boolean;
  /** 狹長直式螢幕 (如 9:16 直立電視、直式手機，ratio <= 0.68) */
  isTallPortrait: boolean;
  /** 寬螢幕橫式 (如筆電、桌機、橫式大平板，ratio >= 1.15 且寬度 >= 860px) */
  isWideLandscape: boolean;
}

function getScreenMetrics(): ScreenRatioInfo {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      height: 720,
      ratio: 16 / 9,
      orientation: 'landscape',
      isPortrait: false,
      isLandscape: true,
      isTallPortrait: false,
      isWideLandscape: true,
    };
  }

  const width =
    window.visualViewport?.width ||
    window.innerWidth ||
    document.documentElement.clientWidth ||
    1280;
  const height =
    window.visualViewport?.height ||
    window.innerHeight ||
    document.documentElement.clientHeight ||
    720;
  const ratio = height > 0 ? width / height : 1;

  // 優先以實際視窗高度 > 寬度判斷直式，並輔以 matchMedia('(orientation: portrait)')
  const mqlPortrait =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(orientation: portrait)').matches
      : false;
  const isPortrait = height !== width ? height > width : mqlPortrait;
  const isLandscape = !isPortrait;
  const isTallPortrait = isPortrait && ratio <= 0.68;
  const isWideLandscape = isLandscape && ratio >= 1.15 && width >= 860;

  return {
    width,
    height,
    ratio,
    orientation: isPortrait ? 'portrait' : 'landscape',
    isPortrait,
    isLandscape,
    isTallPortrait,
    isWideLandscape,
  };
}

function syncRootOrientationClass(isPortrait: boolean) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('is-portrait', isPortrait);
  root.dataset.orientation = isPortrait ? 'portrait' : 'landscape';
}

/**
 * 自動方向偵測 Hook：
 * 1. 同時監聽 window.matchMedia("(orientation: portrait)") 的 change 事件、
 *    resize、orientationchange、screen.orientation 與 visualViewport resize。
 * 2. 網頁初始載入時立即執行一次判斷。
 * 3. 當偵測到螢幕為直式（高度 > 寬度）時，自動在根元素 <html> 加上 `.is-portrait` class，
 *    轉回橫式時立即移除。
 */
export function useScreenRatio(): ScreenRatioInfo {
  const [metrics, setMetrics] = useState<ScreenRatioInfo>(() => {
    const initial = getScreenMetrics();
    syncRootOrientationClass(initial.isPortrait);
    return initial;
  });
  const lastMetricsRef = useRef<ScreenRatioInfo>(metrics);

  useEffect(() => {
    let rafId: number | null = null;
    let delayedTimerId: number | null = null;

    const applyUpdate = () => {
      const next = getScreenMetrics();
      syncRootOrientationClass(next.isPortrait);
      const prev = lastMetricsRef.current;
      if (
        prev.width === next.width &&
        prev.height === next.height &&
        prev.orientation === next.orientation &&
        prev.isTallPortrait === next.isTallPortrait &&
        prev.isWideLandscape === next.isWideLandscape
      ) {
        return;
      }
      lastMetricsRef.current = next;
      setMetrics(next);
    };

    const scheduleUpdate = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(applyUpdate);
    };

    // 部分行動裝置在 orientationchange 當下 innerWidth/innerHeight 尚未完全更新，
    // 補一次短延遲校準確保直式畫布尺寸 100% 精確
    const handleOrientationChange = () => {
      scheduleUpdate();
      if (delayedTimerId !== null) {
        window.clearTimeout(delayedTimerId);
      }
      delayedTimerId = window.setTimeout(applyUpdate, 120);
    };

    // 初始載入立即執行一次判斷
    applyUpdate();

    window.addEventListener('resize', scheduleUpdate, { passive: true });
    window.addEventListener('orientationchange', handleOrientationChange, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleUpdate);

    const screenOrientation = window.screen?.orientation;
    screenOrientation?.addEventListener?.('change', handleOrientationChange);

    const portraitMql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(orientation: portrait)')
        : null;

    if (portraitMql) {
      if (typeof portraitMql.addEventListener === 'function') {
        portraitMql.addEventListener('change', handleOrientationChange);
      } else if (typeof portraitMql.addListener === 'function') {
        portraitMql.addListener(handleOrientationChange);
      }
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (delayedTimerId !== null) window.clearTimeout(delayedTimerId);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.visualViewport?.removeEventListener('resize', scheduleUpdate);
      screenOrientation?.removeEventListener?.('change', handleOrientationChange);

      if (portraitMql) {
        if (typeof portraitMql.removeEventListener === 'function') {
          portraitMql.removeEventListener('change', handleOrientationChange);
        } else if (typeof portraitMql.removeListener === 'function') {
          portraitMql.removeListener(handleOrientationChange);
        }
      }
    };
  }, []);

  return metrics;
}
