/**
 * Realistic Web Audio procedural sound effects and audio asset playback
 */

class SoundEffects {
  private ctx: AudioContext | null = null;
  private audioCache: Map<string, HTMLAudioElement> = new Map();

  // 4 個撥葉與復位音效檔案清單
  private soundFiles = [
    '/leaves_sound_1.mp3',
    '/leaves_sound_2.mp3',
    '/leaves_sound_3.mp3',
    '/leaves_sound_4.mp3',
  ];

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Helper to play random sound from the 4 leaf sound files
   */
  private playRandomLeafSound(fallbackProcedural: () => void) {
    const randomIndex = Math.floor(Math.random() * this.soundFiles.length);
    const chosenSound = this.soundFiles[randomIndex];

    try {
      let audio = this.audioCache.get(chosenSound);
      if (!audio) {
        audio = new Audio(chosenSound);
        audio.preload = 'auto';
        this.audioCache.set(chosenSound, audio);
      }

      // 重設播放進度並播放
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // 若檔案未就緒或瀏覽器策略阻擋，無縫降級使用 Procedural Web Audio 合成音效
          fallbackProcedural();
        });
      }
    } catch {
      fallbackProcedural();
    }
  }

  /**
   * Leaf rustling sound when foliage is brushed or parted.
   * Randomly chooses from leaves_sound_1.mp3, leaves_sound_2.mp3, leaves_sound_3.mp3, leaves_sound_4.mp3.
   */
  playRustle() {
    this.playRandomLeafSound(() => this.playProceduralRustle());
  }

  /**
   * Leaf returning/snapping back to border position.
   * Now also randomly chooses from leaves_sound_1.mp3, leaves_sound_2.mp3, leaves_sound_3.mp3, leaves_sound_4.mp3.
   */
  playRestore() {
    this.playRandomLeafSound(() => this.playProceduralRestore());
  }

  /**
   * Procedural pink noise rustle fallback
   */
  private playProceduralRustle() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const bufferSize = this.ctx.sampleRate * 0.35;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      let b0 = 0,
        b1 = 0,
        b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.055;
        b1 = 0.985 * b1 + white * 0.075;
        b2 = 0.95 * b2 + white * 0.15;
        data[i] = (b0 + b1 + b2) * 0.3;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.35);
      filter.Q.setValueAtTime(2.5, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.28, this.ctx.currentTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    } catch {
      // Audio playback failed silently
    }
  }

  /**
   * Procedural restore fallback
   */
  private playProceduralRestore() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25); // A5

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.55);
    } catch {
      // Audio playback failed silently
    }
  }

  /**
   * Light rustle/flutter when a single wave stroke is registered
   */
  playWaveBrush() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.08);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Audio playback failed silently
    }
  }
}

export const soundManager = new SoundEffects();
