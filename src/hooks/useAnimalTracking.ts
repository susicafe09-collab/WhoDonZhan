import { useState, useRef, useEffect } from 'react';

export type EndemicAnimalType =
  | 'macaca_cyclopis'                       // 台灣獼猴
  | 'diploderma_polygonatum_xanthostomum'   // 黃口攀蜥
  | 'graphium_sarpedon_connectens'          // 青帶鳳蝶
  | 'lophura_swinhoii'                      // 藍腹鷴
  | 'sylvirana_guentheri';                  // 貢德氏赤蛙

export type AnimalAppearanceType = 'type_1' | 'type_2';

export const ENDEMIC_ANIMAL_TYPES: EndemicAnimalType[] = [
  'macaca_cyclopis',
  'diploderma_polygonatum_xanthostomum',
  'graphium_sarpedon_connectens',
  'lophura_swinhoii',
  'sylvirana_guentheri',
];

export interface TrackedAnimal {
  id: string;
  type: EndemicAnimalType;
  appearance: AnimalAppearanceType; // 隨機抽選的 Type 1 或 Type 2
  x: number;
  y: number;
  width: number;
  opacity: number;
  firstSeenAt: number;
  lastSeenAt: number;
  isActive: boolean;
  lastRotationAt: number;
  rotationPhase: 'none' | 'fading_out' | 'fading_in';
  transitionDuration: number;
}

const dist = (x1: number, y1: number, x2: number, y2: number) => {
  if (x1 == null || y1 == null || x2 == null || y2 == null) return 0.2;
  return Math.hypot(x1 - x2, y1 - y2);
};

// 隨機抽選 1 或 2 號外觀型態
export const getRandomAppearance = (): AnimalAppearanceType => {
  return Math.random() < 0.5 ? 'type_1' : 'type_2';
};

export const useAnimalTracking = (faces: any[], poses: any[]) => {
  const trackersRef = useRef<TrackedAnimal[]>([]);
  const [renderState, setRenderState] = useState<TrackedAnimal[]>([]);

  useEffect(() => {
    const now = performance.now();
    const currentTrackers = trackersRef.current;
    
    // 統一依賴 FaceLandmarker 臉部節點進行追蹤
    const detections: { x: number; y: number; face: any }[] = [];
    for (let i = 0; i < faces.length; i++) {
      const face = faces[i];
      const faceNose = face[1];
      if (faceNose) {
        detections.push({ x: faceNose.x, y: faceNose.y, face });
      }
    }

    const matchedDetectionIndices = new Set<number>();
    
    // 1. 更新現有動物
    for (const tracker of currentTrackers) {
      let bestMatchIdx = -1;
      let minD = 0.3; // 距離門檻，移動時平順鎖定
      for (let i = 0; i < detections.length; i++) {
        if (matchedDetectionIndices.has(i)) continue;
        const d = dist(tracker.x, tracker.y, detections[i].x, detections[i].y);
        if (d < minD) {
          minD = d;
          bestMatchIdx = i;
        }
      }
      
      if (bestMatchIdx !== -1) {
        matchedDetectionIndices.add(bestMatchIdx);
        const det = detections[bestMatchIdx];
        const alpha = 0.22; // Lerp 平滑追隨係數
        
        let targetX = tracker.x;
        let targetY = tracker.y;
        let targetWidth = tracker.width;
        
        // 核心錨定：統一綁定在 FaceLandmarker 臉部節點
        if (det.face) {
          const faceTop = det.face[10];     // 額頭 / 頭頂最高節點
          const faceBottom = det.face[152]; // 下巴節點
          const cheek1 = det.face[234];     // 左臉頰邊界
          const cheek2 = det.face[454];     // 右臉頰邊界
          
          if (faceTop && faceBottom && cheek1 && cheek2) {
            const faceWidth = dist(cheek1.x, cheek1.y, cheek2.x, cheek2.y);
            const faceHeight = dist(faceTop.x, faceTop.y, faceBottom.x, faceBottom.y);
            
            // X 軸統一對齊頭頂中心
            targetX = faceTop.x;
            
            // 針對 5 種新動物體型特徵微調合適的 targetY 與 targetWidth：
            // 放寬上下限範圍為 Math.min(0.45, Math.max(0.08, faceWidth * 比例))
            // 避免遠距離時人頭小動物卻巨大，近距離特寫時動物塞滿螢幕
            switch (tracker.type) {
              case 'graphium_sarpedon_connectens': // 青帶鳳蝶
                targetY = faceTop.y - faceHeight * 0.58; // 飛高一點
                targetWidth = Math.min(0.45, Math.max(0.08, faceWidth * 1.45));
                break;
                
              case 'diploderma_polygonatum_xanthostomum': // 黃口攀蜥
                targetY = faceTop.y - faceHeight * 0.28; // 貼近頭頂
                targetWidth = Math.min(0.45, Math.max(0.08, faceWidth * 1.35));
                break;
                
              case 'sylvirana_guentheri': // 貢德氏赤蛙
                targetY = faceTop.y - faceHeight * 0.30; // 貼近頭頂趴著
                targetWidth = Math.min(0.45, Math.max(0.08, faceWidth * 1.4));
                break;
                
              case 'macaca_cyclopis': // 台灣獼猴
                targetY = faceTop.y - faceHeight * 0.42; // 標準頭頂位置
                targetWidth = Math.min(0.45, Math.max(0.08, faceWidth * 1.6));
                break;
                
              case 'lophura_swinhoii': // 藍腹鷴
                targetY = faceTop.y - faceHeight * 0.48; // 羽冠稍高展現優雅
                targetWidth = Math.min(0.45, Math.max(0.08, faceWidth * 1.65));
                break;

              default:
                targetY = faceTop.y - faceHeight * 0.4;
                targetWidth = Math.min(0.45, Math.max(0.08, faceWidth * 1.5));
                break;
            }
          }
        }
        
        tracker.x += (targetX - tracker.x) * alpha;
        tracker.y += (targetY - tracker.y) * alpha;
        tracker.width += (targetWidth - tracker.width) * alpha;
        tracker.lastSeenAt = now;
      }
    }
    
    // 2. 為新進入畫面的人物建立 Tracker（最多 3 人同框，品種盡量不重複）
    for (let i = 0; i < detections.length; i++) {
      if (!matchedDetectionIndices.has(i) && currentTrackers.length < 3) {
        const det = detections[i];
        const usedTypes = new Set(currentTrackers.map(t => t.type));
        const availableTypes = ENDEMIC_ANIMAL_TYPES.filter(t => !usedTypes.has(t));
        
        // 若全部品種都有人戴，則從全部品種中挑選
        const candidatePool = availableTypes.length > 0 ? availableTypes : ENDEMIC_ANIMAL_TYPES;
        const chosenType = candidatePool[Math.floor(Math.random() * candidatePool.length)];
        
        currentTrackers.push({
          id: Math.random().toString(36).substring(7),
          type: chosenType,
          appearance: getRandomAppearance(), // 隨機抽選 Type 1 或 Type 2
          x: det.x,
          y: det.y,
          width: 0.2,
          opacity: 0,
          firstSeenAt: now,
          lastSeenAt: now,
          isActive: false,
          lastRotationAt: now,
          rotationPhase: 'none',
          transitionDuration: 1
        });
      }
    }
    
    // 3. 狀態機與輪替邏輯 (嚴格防閃爍與平滑淡入淡出)
    const activeTrackersCount = currentTrackers.filter(t => t.isActive).length;
    
    for (let i = currentTrackers.length - 1; i >= 0; i--) {
      const tracker = currentTrackers[i];
      const timeSinceLastSeen = now - tracker.lastSeenAt;
      
      // 穩定出現 2 秒後啟動顯示
      if (!tracker.isActive && (now - tracker.firstSeenAt) > 2000 && timeSinceLastSeen < 500) {
        tracker.isActive = true;
        tracker.lastRotationAt = now; 
      }
      
      if (tracker.isActive) {
        if (timeSinceLastSeen > 500) { 
          // 人物離開視線
          tracker.opacity = 0;
          tracker.transitionDuration = 0.5;
          tracker.rotationPhase = 'none';
          if (timeSinceLastSeen > 1000) currentTrackers.splice(i, 1);
        } else {
          // 單人模式：5 秒輪替切換機制
          if (activeTrackersCount === 1) {
            const timeSinceRot = now - tracker.lastRotationAt;
            
            if (tracker.rotationPhase === 'none') {
              // 顯示滿 5 秒後啟動淡出
              if (timeSinceRot > 5000) {
                tracker.rotationPhase = 'fading_out';
                tracker.lastRotationAt = now;
                tracker.opacity = 0;
                tracker.transitionDuration = 1.5;
              } else {
                tracker.opacity = 1;
              }
            } else if (tracker.rotationPhase === 'fading_out') {
              // 淡出完成（1.5 秒），抽選下一隻動物與隨機外觀型態
              if (timeSinceRot >= 1500) {
                const availableTypes = ENDEMIC_ANIMAL_TYPES.filter(t => t !== tracker.type);
                tracker.type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
                tracker.appearance = getRandomAppearance(); // 隨機抽選 Type 1 或 Type 2
                tracker.rotationPhase = 'fading_in';
                tracker.lastRotationAt = now;
                tracker.opacity = 1;
                tracker.transitionDuration = 1.5;
              } else {
                tracker.opacity = 0;
              }
            } else if (tracker.rotationPhase === 'fading_in') {
              tracker.opacity = 1;
              if (timeSinceRot >= 1500) {
                tracker.rotationPhase = 'none';
                tracker.lastRotationAt = now; 
                tracker.transitionDuration = 1;
              }
            }
          } else {
            // 多人模式：維持顯示，中斷輪替以保證畫面穩定
            if (tracker.rotationPhase !== 'none') {
              tracker.rotationPhase = 'none';
              tracker.lastRotationAt = now;
              tracker.opacity = 1;
              tracker.transitionDuration = 0.5;
            } else {
              tracker.opacity = 1;
            }
          }
        }
      } else if (timeSinceLastSeen > 500) {
        currentTrackers.splice(i, 1);
      }
    }
    
    if (currentTrackers.length === 0) {
      setRenderState((prev) => (prev.length === 0 ? prev : []));
    } else {
      setRenderState([...currentTrackers]);
    }
  }, [faces, poses]); // 保留 poses 參數以維持呼叫簽章相容性

  return renderState;
};
