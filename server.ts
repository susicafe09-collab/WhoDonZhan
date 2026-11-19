import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// 初始化 Socket.io 伺服器
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = Number(process.env.PORT) || 3000;

// 儲存當前全域狀態快照，供剛連線進來的平板即時同步
let currentSyncState = {
  mode: 'leaves',
  target: null,
  timestamp: Date.now(),
};

io.on('connection', (socket) => {
  console.log(`🔌 [Socket.io] Client connected: ${socket.id}`);

  // 新客戶端（例如剛打開 /info 的平板）連線時，立刻推送目前最新狀態
  socket.emit('sync_state', currentSyncState);

  // 接收大螢幕主機廣播的狀態變化
  socket.on('sync_state', (payload) => {
    currentSyncState = {
      ...payload,
      timestamp: Date.now(),
    };
    // 廣播給所有連線中的第二螢幕／看板客戶端
    socket.broadcast.emit('sync_state', currentSyncState);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 [Socket.io] Client disconnected: ${socket.id}`);
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    // 生產模式：提供打包後的靜態檔案
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // 開發模式：掛載 Vite middlewares
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [Second Screen Sync Server] running on http://0.0.0.0:${PORT}`);
    console.log(`   - Main AR Screen: http://localhost:${PORT}/`);
    console.log(`   - Tablet Info View: http://localhost:${PORT}/info`);
  });
}

startServer();
