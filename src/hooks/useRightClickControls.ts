import { useEffect, useState } from 'react';

/**
 * 展示模式開關：平常隱藏所有按鈕和面板。
 * 接滑鼠按右鍵 → 叫出／收起設定；觸控長按不會叫出來（觀眾碰不到）。
 * 瀏覽器原本的右鍵選單一律擋掉。
 */
export const useRightClickControls = () => {
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    let lastPointerType = 'mouse';
    const onPointerDown = (e: PointerEvent) => {
      lastPointerType = e.pointerType;
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (lastPointerType === 'mouse') setShowControls((v) => !v);
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('contextmenu', onContextMenu);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  return showControls;
};
