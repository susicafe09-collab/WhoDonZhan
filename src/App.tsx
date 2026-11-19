/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MediaPipeView, UnifiedMode } from './components/MediaPipeView';
import { InfoView } from './components/InfoView';

// 大螢幕用網址固定模式，跟對應的平板用同一個字：
// /?type=leaves 撥開葉子、/?type=animals 動物互動、/?type=landscape 風景手勢；沒帶就是撥開葉子
const MODE_BY_TYPE: Record<string, UnifiedMode> = {
  leaves: 'leaves',
  animals: 'animal',
  animal: 'animal',
  landscape: 'landscape',
};
const urlMode =
  MODE_BY_TYPE[new URLSearchParams(window.location.search).get('type')?.toLowerCase() || ''] ||
  'leaves';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 主螢幕 AR 互動模式（大螢幕） */}
        <Route
          path="/"
          element={
            <div className="relative w-screen h-[100dvh] bg-[#0A0A0A] text-zinc-100 flex flex-col items-center justify-center overflow-hidden">
              <main className="w-full h-full flex flex-col items-center justify-center relative z-10 overflow-hidden">
                <MediaPipeView initialMode={urlMode} />
              </main>
            </div>
          }
        />

        {/* 展場延伸知識看板模式（平板第二螢幕） */}
        <Route path="/info" element={<InfoView />} />
      </Routes>
    </BrowserRouter>
  );
}
