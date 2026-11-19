import { io, Socket } from 'socket.io-client';
import { MuzhaPlantInfo } from '../types';

export interface SyncStatePayload {
  mode: 'leaves' | 'animal' | 'landscape';
  target: string | null; // e.g. 'macaca_cyclopis', 'Mountain_type_1', or null
  activePlants?: MuzhaPlantInfo[]; // 當前畫面上出現的三種植物資訊 (木柵貓空生態誌)
  timestamp?: number;
}

class SyncSocketService {
  private socket: Socket | null = null;
  private lastSentPayload: string = '';

  public connect(): Socket {
    if (this.socket) {
      return this.socket;
    }

    // 在同一個主機/區網下，自動連線當前 host origin
    this.socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to Second Screen Sync Server:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Sync Server:', reason);
    });

    return this.socket;
  }

  public getSocket(): Socket {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }

  /**
   * 發送大螢幕狀態給平板，避免短時間高頻重複發送相同狀態
   * force=true 時可強制覆蓋（供展場手動測試按鈕 override 使用）
   */
  public emitSyncState(payload: SyncStatePayload, force = false) {
    const serialized = `${payload.mode}:${payload.target || 'none'}`;
    if (!force && serialized === this.lastSentPayload) {
      return;
    }
    this.lastSentPayload = serialized;

    const socket = this.getSocket();
    socket.emit('sync_state', {
      ...payload,
      timestamp: Date.now(),
    });
  }
}

export const syncSocket = new SyncSocketService();
