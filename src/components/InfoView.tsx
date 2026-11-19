import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { syncSocket, SyncStatePayload } from '../utils/syncSocket';
import {
  KNOWLEDGE_DICTIONARY,
  KnowledgeItem,
  MUZHA_PLANTS_DATA,
  CONCISE_PLANT_DESCRIPTIONS,
} from '../data/knowledgeData';
import { MuzhaPlantInfo } from '../types';
import {
  Maximize2,
  Minimize2,
  Volume2,
} from 'lucide-react';
import { animalAudio } from '../utils/animalAudio';
import { useScreenRatio } from '../hooks/useScreenRatio';
import { useRightClickControls } from '../hooks/useRightClickControls';

// 全套木柵貓空 7 款植物完整資料庫（依茶山垂直生態鏈排序）
const ALL_DEFAULT_MUZHA_PLANTS: MuzhaPlantInfo[] = [
  {
    id: 'plant-1',
    name: '木柵特產・破土綠竹筍',
    scientificName: 'Bambusa oldhamii (Shoots)',
    categoryLabel: '地板植被・木柵名產',
    imageSrc: '/leaves_ground_4.png',
    muzhaSpot: '老泉里・指南茶山坡地',
    tags: ['🎋 木柵三寶', '💧 坡地固水', '🌱 雨後破土'],
    muzhaRelation:
      '木柵老泉里向陽背風、土壤鬆軟富含腐植質，造就綠竹筍清甜如梨。初夏採筍與焙製鐵觀音交相輝映，是貓空茶山農耕共生的名產瑰寶。',
    description:
      '多年生常綠竹類地下嫩芽，雨後強力破土。基部根系具強大抓土固水功能，守護坡地表土。',
    funFact:
      '茶農須在清晨破曉前摸黑掘筍，筍尖一旦探出照光出青便會轉苦，採筍全憑指尖摸尋！',
  },
  {
    id: 'plant-2',
    name: '樟樹步道・樟楠樹冠',
    scientificName: 'Cinnamomum camphora',
    categoryLabel: '側邊植物・樹冠林蔭',
    imageSrc: '/leaves.png',
    muzhaSpot: '樟樹步道・百年老樟樹群',
    tags: ['☀️ 柔和漫射', '🍃 天然芬多精', '🌿 驅蟲清芬'],
    muzhaRelation:
      '貓空「樟湖」地名之由來。枝繁葉茂的巨大樹冠宛如天然綠傘，為林下怕強光的鐵觀音茶樹遮擋烈日，提供溫和漫射光與天然驅蟲香氣。',
    description:
      '樟科常綠喬木，葉具明顯三出脈。搓揉新鮮葉片即散發清芬提神的天然芳樟醇，清淨山林空氣。',
    funFact:
      '清晨微風吹拂樟楠樹冠釋放豐富樟醇與芬多精，昔日茶農深信能驅瘴醒腦，是步道天然防護罩。',
  },
  {
    id: 'plant-3',
    name: '百年老樹・垂懸崖薑蕨',
    scientificName: 'Aglaomorpha coronans',
    categoryLabel: '側邊植物・空中皇冠',
    imageSrc: '/leaves_ground_6.png',
    muzhaSpot: '指南宮後山・巨木相思林',
    tags: ['👑 空中客棧', '🌧️ 聚寶盛雨', '🌿 雲霧著生'],
    muzhaRelation:
      '附生於指南山老樹樹幹上的大型著生蕨，宛如翡翠皇冠高懸林間。基部腐植葉如聚寶盆盛接雨水與落葉，在半空中形成提供小生物棲息的微型生態圈。',
    description:
      '水龍骨科大型附生蕨，根莖粗厚肉質橫生。基部如鳥巢般盛接落葉，上部羽狀葉優雅垂墜。',
    funFact:
      '崖薑蕨是山林中的「空中客棧」，底部堆積的腐植土層常吸引樹蛙、攀蜥在半空中築巢安家！',
  },
  {
    id: 'plant-4',
    name: '銀河洞溪谷・闊葉水龍骨',
    scientificName: 'Polypodiodes amoena',
    categoryLabel: '地板植被・潮濕溪谷',
    imageSrc: '/leaves_ground_1.png',
    muzhaSpot: '銀河洞瀑布・指南溪上游岩壁',
    tags: ['💧 濕度指標', '🏞️ 懸崖著生', '🌿 翠綠革質'],
    muzhaRelation:
      '常年繁生於銀河洞瀑布水氣瀰漫的峭壁與石壁。貓空年降雨充沛且濕度高達 85%，青翠的水龍骨群正是茶山純淨泉水與天然濕度的環境指標。',
    description:
      '水龍骨科常綠著生蕨類，肉質根莖被覆金褐鱗片。羽狀深裂葉片青翠革質，葉背具金黃孢子囊群。',
    funFact:
      '肉質根狀莖覆滿鱗片宛如青龍盤旋石壁因而得名，組織蓄水力極佳，能抵擋山區短暫乾旱。',
  },
  {
    id: 'plant-5',
    name: '貓空野徑・垂懸藤葉',
    scientificName: 'Ampelocissus cantoniensis',
    categoryLabel: '側邊植物・林緣攀緣',
    imageSrc: '/leaves_ground_5.png',
    muzhaSpot: '壺穴步道・溪畔次生林緣',
    tags: ['🍇 獼猴珍饈', '🌿 垂掛綠簾', '💧 朝露滋養'],
    muzhaRelation:
      '攀附於壺穴步道岩壁與茶園石籬間，垂懸形成如綠色水簾的林緣景致。深秋結出的深紫漿果，是貓空山林台灣獼猴與藍腹鷴最愛的野性珍饈。',
    description:
      '木質落葉攀援藤本，以枝梢卷鬚攀附向上蔓生。葉片心狀卵形，垂掛步道兩側極具野趣。',
    funFact:
      '木質藤莖導水能力極強，昔日老獵人與巡山人在深山缺水時，斜切新鮮藤莖便能汲取天然甘泉！',
  },
  {
    id: 'plant-6',
    name: '貓空步道・高山箭竹',
    scientificName: 'Yushania niitakayamensis',
    categoryLabel: '地板植被・水土護坡',
    imageSrc: '/leaves_ground_3.png',
    muzhaSpot: '樟湖步道・待老坑山稜線',
    tags: ['🛡️ 護坡防線', '🌫️ 凝結晨霧', '🌿 百年古道'],
    muzhaRelation:
      '生長於待老坑山脊梁，緻密竹根如立體鋼筋網牢抓邊坡。季風吹拂時為茶園聚攏水氣凝結山嵐，是守護挑茶古道百年不塌的護坡功臣。',
    description:
      '禾本科多年生走莖植物，竹稈極富韌性。緻密根系交織於地表下，是水土保持的關鍵防線。',
    funFact:
      '地下竹鞭蔓延極深且韌性驚人，昔日挑茶人行走陡坡，全靠箭竹根緊繫砂石維繫安全步道。',
  },
];

export const InfoView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { isPortrait } = useScreenRatio();
  // 展示模式：頂部連線燈號、看板名稱、全螢幕鈕平常隱藏，接滑鼠按右鍵才出現
  const showControls = useRightClickControls();

  // 專屬看板型態判斷 (支援 query params: ?type=leaves, ?type=animals, ?type=landscape)
  // 1. Board 1 (leaves): 專屬於「撥開葉子 / 植物生態誌」，忽略動物與風景事件
  // 2. Board 2 (animals): 專屬於「動物互動」，忽略葉片撥開與風景事件
  // 3. Board 3 (landscape): 專屬於「風景手勢」，忽略葉片撥開與動物事件
  // 4. Universal (all): 通用看板，接收所有大螢幕同步事件
  const boardType = useMemo<'leaves' | 'animals' | 'landscape' | 'all'>(() => {
    const rawType = (searchParams.get('type') || '').toLowerCase();
    if (rawType === 'leaves' || rawType === 'leaf' || rawType === 'plant' || rawType === 'plants') {
      return 'leaves';
    }
    if (rawType === 'animals' || rawType === 'animal') {
      return 'animals';
    }
    if (rawType === 'landscape' || rawType === 'landscapes' || rawType === 'scene') {
      return 'landscape';
    }
    return 'all';
  }, [searchParams]);

  const [currentSync, setCurrentSync] = useState<SyncStatePayload>({
    mode: boardType === 'animals' ? 'animal' : boardType === 'landscape' ? 'landscape' : 'leaves',
    target: boardType === 'leaves' ? 'leaf_parted' : null,
  });
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeItem, setActiveItem] = useState<KnowledgeItem | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 原始傳入或預設之所有植物資料
  const [plantList, setPlantList] = useState<MuzhaPlantInfo[]>(ALL_DEFAULT_MUZHA_PLANTS);

  // 分頁狀態：一頁展示 3 款植物
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [isPageFading, setIsPageFading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressKeyRef = useRef<number>(0);

  useEffect(() => {
    const socket = syncSocket.connect();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const handleSync = (payload: SyncStatePayload) => {
      console.log(`📡 [Board: ${boardType}] Received sync_state:`, payload);

      // ── 專屬看板專用過濾 (Dedicated Info Boards per Feature) ──
      // 1. Board 1 (Leaves only): 專門監聽並展示「撥開葉子 / 植物生態誌」，完全忽略動物與風景事件
      if (boardType === 'leaves') {
        if (payload.mode !== 'leaves' && payload.target !== 'leaf_parted') {
          return;
        }
      }
      // 2. Board 2 (Animals only): 專門監聽並展示「動物互動」，完全忽略葉片撥開與風景手勢事件
      else if (boardType === 'animals') {
        if (payload.mode !== 'animal') {
          return;
        }
      }
      // 3. Board 3 (Landscape only): 專門監聽並展示「風景手勢」，完全忽略葉片撥開與動物事件
      else if (boardType === 'landscape') {
        if (payload.mode !== 'landscape') {
          return;
        }
      }

      setCurrentSync(payload);

      // 若大螢幕有傳送當前出現的植物列表
      if (payload.activePlants && payload.activePlants.length > 0) {
        const uniqueFromPayload = Array.from(
          new Map(payload.activePlants.map((p) => [p.imageSrc, p])).values()
        );

        const combined = [...uniqueFromPayload];
        for (const defaultPlant of ALL_DEFAULT_MUZHA_PLANTS) {
          if (!combined.some((p) => p.imageSrc === defaultPlant.imageSrc)) {
            combined.push(defaultPlant);
          }
        }
        setPlantList(combined);
      }

      const targetId = payload.target;
      const foundItem = targetId ? KNOWLEDGE_DICTIONARY[targetId] || null : null;

      setIsTransitioning(true);
      setTimeout(() => {
        setActiveItem(foundItem);
        setIsTransitioning(false);
      }, 250);
    };

    setIsConnected(socket.connected);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('sync_state', handleSync);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('sync_state', handleSync);
    };
  }, [boardType]);

  // 支援 URL 參數預覽（例如 ?preview=leaves 或 ?preview=standby，方便展場測試）
  const queryPreview = useMemo(() => {
    return searchParams.get('preview')?.toLowerCase() || null;
  }, [searchParams]);

  // 當前是否處於待機模式：
  // 1. 若 URL 指定 preview=standby -> 強制待機
  // 2. 若 URL 指定 preview=leaves / animal / landscape -> 依預覽模式
  // 3. Board 1 (Leaves only)：專注常駐展示 3 種植物輪播生態誌，不顯示空白待機
  // 4. Board 2 (Animals only)：僅當有特有種動物目標時才非待機；無目標時顯示優雅等待待機視覺
  // 5. Board 3 (Landscape only)：僅當有高山風景目標時才非待機；無目標時顯示優雅等待待機視覺
  // 6. 通用看板：當大螢幕 target 為 null、空值、'none' 或 'standby' 時即為待機狀態
  const isStandby = useMemo(() => {
    if (queryPreview === 'standby') return true;
    if (queryPreview === 'leaves') return false;

    if (boardType === 'leaves') {
      return false; // Board 1 專注常駐展示植物生態誌
    }

    if (boardType === 'animals') {
      return !currentSync.target || currentSync.target === 'none' || currentSync.target === 'standby' || activeItem?.category !== 'animal';
    }

    if (boardType === 'landscape') {
      return !currentSync.target || currentSync.target === 'none' || currentSync.target === 'standby' || activeItem?.category !== 'landscape';
    }

    return !currentSync.target || currentSync.target === 'none' || currentSync.target === 'standby';
  }, [currentSync.target, queryPreview, boardType, activeItem]);

  // 當前是否處於動物或風景特殊展示模式
  const isAnimalOrLandscape = Boolean(
    !isStandby && activeItem && (
      (boardType === 'animals' && activeItem.category === 'animal') ||
      (boardType === 'landscape' && activeItem.category === 'landscape') ||
      (boardType === 'all' && (activeItem.category === 'animal' || activeItem.category === 'landscape'))
    )
  );

  // 當前是否處於撥開綠葉展示三款植物模式（非待機且非動物/風景模式）
  const isLeavesActive = !isStandby && !isAnimalOrLandscape && (boardType === 'leaves' || boardType === 'all');

  // 計算分頁：每頁 3 款植物
  const PAGE_SIZE = 3;
  const totalPages = Math.max(1, Math.ceil(plantList.length / PAGE_SIZE));

  // 當前頁面的 3 款植物
  const currentThreePlants = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return plantList.slice(start, start + PAGE_SIZE);
  }, [plantList, pageIndex]);

  // 手動切換分頁函數（帶輕快淡出淡入轉場）
  const goToPage = (newIndex: number) => {
    if (newIndex === pageIndex || isPageFading) return;
    setIsPageFading(true);
    progressKeyRef.current += 1;
    setTimeout(() => {
      setPageIndex(newIndex);
      setIsPageFading(false);
    }, 150);
  };

  const handleNextPage = () => {
    goToPage((pageIndex + 1) % totalPages);
  };

  const handlePrevPage = () => {
    goToPage((pageIndex - 1 + totalPages) % totalPages);
  };

  // ─────────────────────────────────────────────────────────────
  // 自動定時輪播：每 5 秒輕快淡入切換到下一組 3 款植物
  // 僅在撥開綠葉展示植物時運作，待機時停止輪播計時
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLeavesActive || totalPages <= 1 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setIsPageFading(true);
      progressKeyRef.current += 1;
      setTimeout(() => {
        setPageIndex((prev) => (prev + 1) % totalPages);
        setIsPageFading(false);
      }, 150);
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLeavesActive, totalPages, isPaused, pageIndex]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // 音效播放狀態與防重複觸發計時器
  const [isPlayingSound, setIsPlayingSound] = useState<boolean>(false);
  const lastSoundTargetRef = useRef<string | null>(null);

  const playCurrentSound = (targetId?: string) => {
    const soundId = targetId || activeItem?.id;
    if (!soundId) return;
    setIsPlayingSound(true);
    animalAudio.playSound(soundId).finally(() => {
      setIsPlayingSound(false);
    });
  };

  // 當動物或特殊目標出現／切換時，自動播放 Web Audio API 合成音效
  useEffect(() => {
    if (activeItem?.id) {
      if (activeItem.id !== lastSoundTargetRef.current) {
        lastSoundTargetRef.current = activeItem.id;
        playCurrentSound(activeItem.id);
      }
    } else {
      lastSoundTargetRef.current = null;
    }
  }, [activeItem?.id]);

  // 將長篇介紹文字拆分為兩段以維持優雅排版與呼吸感
  const [bodyParagraph1, bodyParagraph2] = useMemo(() => {
    if (!activeItem?.description) return ['', ''];
    const text = activeItem.description.trim();
    if (text.includes('\n\n')) {
      const parts = text.split('\n\n');
      return [parts[0], parts.slice(1).join('\n\n')];
    }
    if (text.includes('\n')) {
      const parts = text.split('\n');
      return [parts[0], parts.slice(1).join('\n')];
    }
    const sentences = text.match(/[^。！？!?]+[。！？!?]*/g) || [text];
    if (sentences.length <= 1) return [text, ''];
    const mid = Math.ceil(sentences.length / 2);
    return [
      sentences.slice(0, mid).join(''),
      sentences.slice(mid).join(''),
    ];
  }, [activeItem?.description]);

  return (
    <div
      className="relative w-screen h-[100dvh] text-zinc-100 flex flex-col overflow-hidden font-sans select-none"
      style={{
        backgroundImage: "url('/information_background.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 頂部極簡功能列：連線狀態與全螢幕按鈕（支援直式 Safe Area 邊距）  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header
        className={`relative z-20 w-full flex items-center justify-between bg-transparent ${
          showControls ? '' : 'invisible'
        } ${
          isPortrait ? 'portrait-safe-top pb-2' : 'px-6 py-3'
        }`}
      >
        {/* 左側：連線狀態燈號與專屬看板標籤 */}
        <div className="flex items-center gap-3">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
              isConnected ? 'bg-[#28887A]' : 'bg-[#1A1A1A]'
            }`}
            title={isConnected ? '區網 Socket 已連線' : '等待連線中'}
          />
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#141414]/90 border border-zinc-800 text-zinc-300 flex items-center gap-1.5 shadow-sm">
            {boardType === 'leaves' && (
              <>
                <span className="text-[#4CA6A8] font-playfair italic font-bold">Board 1</span>
                <span className="text-zinc-500">|</span>
                <span>撥開葉子・植物生態誌</span>
              </>
            )}
            {boardType === 'animals' && (
              <>
                <span className="text-[#4CA6A8] font-playfair italic font-bold">Board 2</span>
                <span className="text-zinc-500">|</span>
                <span>動物互動專屬看板</span>
              </>
            )}
            {boardType === 'landscape' && (
              <>
                <span className="text-[#4CA6A8] font-playfair italic font-bold">Board 3</span>
                <span className="text-zinc-500">|</span>
                <span>風景手勢專屬看板</span>
              </>
            )}
            {boardType === 'all' && (
              <>
                <span className="text-zinc-400 font-playfair italic font-bold">Universal</span>
                <span className="text-zinc-500">|</span>
                <span>全功能生態看板</span>
              </>
            )}
          </span>
        </div>

        {/* 右側：全螢幕切換按鈕 */}
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-xl bg-[#1A1A1A]/80 hover:bg-[#262626] text-zinc-400 hover:text-[#4CA6A8] transition-colors cursor-pointer border-none shadow-none backdrop-blur-sm"
          title={isFullscreen ? '退出全螢幕' : '全螢幕展示'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 知識內容展示主區塊：                                           */}
      {/* 依螢幕比例 (直式 / 橫式) 自動切換排版與底部留白，避開底部山巒圖形  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <main
        className={`relative z-20 flex-1 w-full h-full flex items-center justify-center overflow-hidden transition-all duration-300 ${
          isPortrait
            ? 'px-5 sm:px-10 md:px-14 pt-2'
            : 'px-5 sm:px-10 md:px-14 lg:px-20 pt-2 pb-28 sm:pb-36 md:pb-40 lg:pb-48'
        }`}
        style={
          isPortrait
            ? {
                paddingBottom: 'max(14vh, calc(var(--safe-bottom, 0px) + 12vh))',
                paddingLeft: 'max(1.25rem, var(--safe-left, 0px))',
                paddingRight: 'max(1.25rem, var(--safe-right, 0px))',
              }
            : undefined
        }
      >
        <div
          className={`w-full h-full flex flex-col transition-all duration-300 ease-out ${
            isPortrait ? 'max-w-[1040px]' : 'max-w-[1680px]'
          } ${isTransitioning ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'}`}
        >
          {isStandby ? (
            /* ═══════════════════════════════════════════════════════════ */
            /* 待機畫面：純淨無卡片雜訊，依直式／橫式自動調整比例置中           */
            /* ═══════════════════════════════════════════════════════════ */
            <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden select-none">
              <img
                src="/standby.png"
                alt="展場待機主視覺"
                className={`${
                  isPortrait ? 'max-h-[55vh] max-w-[90%]' : 'max-h-[60vh] max-w-full'
                } object-contain pointer-events-none transition-opacity duration-500`}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="mt-4 px-4 py-2 rounded-full bg-[#141414]/80 border border-zinc-800/80 text-zinc-400 text-sm tracking-wider flex items-center gap-2.5 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-[#28887A] animate-ping" />
                {boardType === 'animals' && '等待鏡頭前特有種動物互動識別中...'}
                {boardType === 'landscape' && '等待鏡頭前合歡群峰手勢體驗中...'}
                {boardType === 'all' && '展場待機中，請於鏡頭前體驗互動'}
              </div>
            </div>
          ) : isLeavesActive ? (
            /* ═══════════════════════════════════════════════════════════ */
            /* 撥開綠葉模式：                                               */
            /* - 橫式螢幕：3 欄水平並排展示                                  */
            /* - 直式螢幕：自動切換為 3 列垂直條列（左圖右文），完整運用直立空間 */
            /* ═══════════════════════════════════════════════════════════ */
            <div
              className="w-full h-full flex flex-col bg-transparent p-2 sm:p-4 relative overflow-hidden"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              <div
                className={`flex-1 w-full overflow-y-auto relative z-10 transition-all duration-300 ease-out ${
                  isPageFading ? 'opacity-0 scale-[0.985]' : 'opacity-100 scale-100'
                }`}
              >
                {isPortrait ? (
                  <div className="flex flex-col justify-evenly gap-5 sm:gap-7 md:gap-9 h-full">
                    {currentThreePlants.map((plant) => {
                      const conciseDesc =
                        CONCISE_PLANT_DESCRIPTIONS[plant.imageSrc] ||
                        plant.muzhaRelation ||
                        plant.description;

                      return (
                        <div
                          key={plant.id}
                          className="flex-1 min-h-0 flex flex-row items-center gap-5 sm:gap-8 md:gap-10 px-2 sm:px-5 py-2 bg-transparent transition-all group border-none shadow-none"
                        >
                          {/* 左側植物圖像 */}
                          <div className="w-[34%] sm:w-[36%] h-full flex items-center justify-center shrink-0 bg-transparent relative overflow-hidden group/img">
                            <img
                              src={plant.imageSrc}
                              alt={plant.name}
                              className="max-h-[18vh] sm:max-h-[20vh] w-full object-contain mx-auto filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] transition-transform duration-500 ease-out group-hover/img:scale-105"
                            />
                          </div>

                          {/* 右側名稱、學名與簡述 */}
                          <div className="flex-1 min-w-0 flex flex-col justify-center text-left">
                            <h3 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
                              {plant.name}
                            </h3>
                            <p className="text-lg sm:text-2xl md:text-3xl font-playfair italic text-[#4CA6A8] mt-1 mb-2 sm:mb-3 leading-snug">
                              {plant.scientificName}
                            </p>
                            <p className="text-base sm:text-xl md:text-2xl leading-relaxed text-zinc-200">
                              {conciseDesc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10 h-full items-stretch">
                    {currentThreePlants.map((plant) => {
                      const conciseDesc =
                        CONCISE_PLANT_DESCRIPTIONS[plant.imageSrc] ||
                        plant.muzhaRelation ||
                        plant.description;

                      return (
                        <div
                          key={plant.id}
                          className="flex flex-col justify-between p-3 sm:p-5 bg-transparent transition-all group overflow-hidden h-full border-none shadow-none"
                        >
                          {/* 植物圖像（全透明無底盒，自然融入背景） */}
                          <div className="flex-1 w-full flex items-center justify-center my-2 p-2 bg-transparent relative overflow-hidden group/img min-h-[160px] sm:min-h-[200px] md:min-h-[240px] border-none shadow-none">
                            <img
                              src={plant.imageSrc}
                              alt={plant.name}
                              className="max-h-[26vh] sm:max-h-[30vh] md:max-h-[34vh] w-auto max-w-[94%] object-contain mx-auto filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] transition-transform duration-500 ease-out group-hover/img:scale-105"
                            />
                          </div>

                          {/* 景點名稱（2.5x）、學名（2.5x）與介紹文字（2x）放大置中 */}
                          <div className="text-center mt-2 flex flex-col items-center">
                            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mt-1 mb-1 text-center leading-tight">
                              {plant.name}
                            </h3>
                            <p className="text-xl sm:text-2xl font-playfair italic text-[#4CA6A8] mb-3 text-center leading-snug">
                              {plant.scientificName}
                            </p>

                            <p className="text-xl sm:text-2xl leading-relaxed text-zinc-300 text-center max-w-xl sm:max-w-2xl mx-auto">
                              {conciseDesc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : activeItem ? (
            /* ═══════════════════════════════════════════════════════════ */
            /* 動物模式與風景模式：                                         */
            /* - 橫式螢幕：左右雙欄 (5:7)                                   */
            /* - 直式螢幕：自動切換為上下海報式排版（上圖＋右下喇叭，下文）     */
            /* ═══════════════════════════════════════════════════════════ */
            isPortrait ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-6 sm:gap-9 md:gap-12 overflow-hidden">
                {/* 上方大圖區塊：無外框放大的動物／山景插畫，右下角圓形音效按鈕 */}
                <div className="w-full flex items-center justify-center shrink-0 relative bg-transparent pt-2">
                  <div className="relative inline-flex items-center justify-center max-w-[90%]">
                    <img
                      src={activeItem.image}
                      alt={activeItem.name}
                      className="max-h-[34vh] sm:max-h-[38vh] md:max-h-[42vh] w-auto max-w-full object-contain mx-auto filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.7)] transition-transform duration-500 hover:scale-105"
                    />

                    {/* 右下角圓形音效按鈕：純實心白灰 #D9D9D9，黑色喇叭圖示，播放時脈衝動態 */}
                    <button
                      onClick={() => playCurrentSound()}
                      className={`absolute bottom-2 right-2 sm:bottom-3 sm:right-3 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-[#D9D9D9] hover:bg-white text-black flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-95 cursor-pointer z-30 ${
                        isPlayingSound
                          ? 'scale-110 ring-4 ring-[#28887A]/70 animate-pulse'
                          : 'hover:scale-105'
                      }`}
                      title="播放叫聲"
                      aria-label="播放叫聲"
                    >
                      <Volume2 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-black fill-black" />
                    </button>
                  </div>
                </div>

                {/* 下方文字解說：全透明無卡片框，標題置中對齊 + Playfair Display italic 學名 + 雙段內文 */}
                <div className="w-full max-w-4xl flex-1 min-h-0 flex flex-col justify-start items-center bg-transparent px-2 sm:px-4 overflow-y-auto">
                  <div className="relative z-10 w-full">
                    <div className="mb-5 sm:mb-7 flex flex-wrap items-baseline justify-center gap-x-4 sm:gap-x-6 gap-y-2 text-center">
                      <h2 className="text-4xl sm:text-6xl md:text-7xl font-[800] tracking-tight text-white leading-tight font-sans">
                        {activeItem.name}
                      </h2>
                      <span className="font-playfair italic text-[#28887A] text-2xl sm:text-3xl md:text-4xl align-baseline font-semibold tracking-wide inline-block">
                        {activeItem.scientificName}
                      </span>
                    </div>

                    <div className="flex flex-col gap-5 sm:gap-6">
                      {bodyParagraph1 && (
                        <p className="text-lg sm:text-2xl md:text-[28px] font-sans text-[#EAEAEA] leading-[1.7] text-justify tracking-wide">
                          {bodyParagraph1}
                        </p>
                      )}
                      {bodyParagraph2 && (
                        <p className="text-lg sm:text-2xl md:text-[28px] font-sans text-[#EAEAEA] leading-[1.7] text-justify tracking-wide">
                          {bodyParagraph2}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-14 items-center">
                {/* 左側大圖區塊：無外框、放大的動物插畫，右下角音效圓形按鈕 */}
                <div className="md:col-span-5 h-full flex items-center justify-center relative bg-transparent p-2">
                  <div className="relative inline-flex items-center justify-center w-full max-h-[68vh]">
                    <img
                      src={activeItem.image}
                      alt={activeItem.name}
                      className="max-h-[50vh] sm:max-h-[58vh] md:max-h-[66vh] w-auto max-w-full object-contain mx-auto filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.7)] transition-transform duration-500 hover:scale-105"
                    />

                    {/* 右下角圓形音效按鈕：純實心白灰 #D9D9D9，黑色喇叭圖示，播放時脈衝動態 */}
                    <button
                      onClick={() => playCurrentSound()}
                      className={`absolute bottom-2 right-2 sm:bottom-4 sm:right-6 md:bottom-3 md:right-4 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-[#D9D9D9] hover:bg-white text-black flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-95 cursor-pointer z-30 ${
                        isPlayingSound
                          ? 'scale-110 ring-4 ring-[#28887A]/70 animate-pulse'
                          : 'hover:scale-105'
                      }`}
                      title="播放叫聲"
                      aria-label="播放叫聲"
                    >
                      <Volume2 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-black fill-black" />
                    </button>
                  </div>
                </div>

                {/* 右側文字解說：全透明無卡片框，粗體 800 中文 + 右側手寫學名 + 2x 雙段內文 */}
                <div className="md:col-span-7 h-full flex flex-col justify-center bg-transparent p-2 md:p-6 overflow-y-auto">
                  <div className="relative z-10">
                    {/* 標題與學名：中文粗體 (800, #FFFFFF, 2.5x)，學名接於右側 Playfair Display italic (#28887A, 2.5x) */}
                    <div className="mb-6 md:mb-8 flex flex-wrap items-baseline gap-x-4 sm:gap-x-6 gap-y-2">
                      <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-[800] tracking-tight text-white leading-tight font-sans">
                        {activeItem.name}
                      </h2>
                      <span className="font-playfair italic text-[#28887A] text-2xl sm:text-3xl md:text-4xl lg:text-5xl align-baseline font-semibold tracking-wide ml-3 sm:ml-5 inline-block">
                        {activeItem.scientificName}
                      </span>
                    </div>

                    {/* 內文說明：無襯線體 (#EAEAEA)，2x 原字級，行高 1.7，分成兩段垂直留白排版 */}
                    <div className="flex flex-col gap-5 sm:gap-6 md:gap-7">
                      {bodyParagraph1 && (
                        <p className="text-xl sm:text-2xl md:text-[26px] lg:text-[30px] font-sans text-[#EAEAEA] leading-[1.7] text-justify tracking-wide">
                          {bodyParagraph1}
                        </p>
                      )}
                      {bodyParagraph2 && (
                        <p className="text-xl sm:text-2xl md:text-[26px] lg:text-[30px] font-sans text-[#EAEAEA] leading-[1.7] text-justify tracking-wide">
                          {bodyParagraph2}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="w-full h-full" />
          )}
        </div>
      </main>
    </div>
  );
};

export default InfoView;
