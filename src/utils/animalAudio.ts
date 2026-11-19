// Web Audio API Synthesizer for Distinct Mockup Animal Sounds
// No external audio files needed; 100% reliable, zero-latency in-browser synthesis

class AnimalAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private currentStopCallback: (() => void) | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Synthesize sound for given animal/landscape ID
   * Resolves when the sound finishes playing
   */
  public playSound(id: string): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return Promise.resolve();

    // Stop any previous sound if still playing
    if (this.currentStopCallback) {
      this.currentStopCallback();
      this.currentStopCallback = null;
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    return new Promise<void>((resolve) => {
      let isDone = false;
      const done = () => {
        if (!isDone) {
          isDone = true;
          this.currentStopCallback = null;
          resolve();
        }
      };

      try {
        switch (id) {
          case 'macaca_cyclopis':
            this.playMonkey(ctx, done);
            break;
          case 'sylvirana_guentheri':
            this.playFrog(ctx, done);
            break;
          case 'lophura_swinhoii':
            this.playBird(ctx, done);
            break;
          case 'diploderma_polygonatum_xanthostomum':
            this.playLizard(ctx, done);
            break;
          case 'graphium_sarpedon_connectens':
            this.playButterfly(ctx, done);
            break;
          case 'Mountain_type_1':
          case 'Mountain_type_2':
          case 'Mountain_type_3':
            this.playMountainChime(ctx, done);
            break;
          default:
            this.playGenericNatureSound(ctx, done);
            break;
        }
      } catch (err) {
        console.warn('Web Audio synthesis error:', err);
        done();
      }
    });
  }

  // 1. 台灣獼猴 (Macaca cyclopis): 活潑清脆的連續猴啼啁啾叫聲 (Eek-eek-krr)
  private playMonkey(ctx: AudioContext, onEnded: () => void) {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.3, now);
    masterGain.connect(ctx.destination);

    const chirpPitches = [800, 1350, 1600, 1100, 1450];
    chirpPitches.forEach((pitch, i) => {
      const startTime = now + i * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, startTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, startTime + 0.05);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.7, startTime + 0.11);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.35, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.13);
    });

    const totalDuration = chirpPitches.length * 0.14 + 0.15;
    const timer = setTimeout(onEnded, totalDuration * 1000);
    this.currentStopCallback = () => {
      clearTimeout(timer);
      try {
        masterGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      } catch {}
      onEnded();
    };
  }

  // 2. 貢德氏赤蛙 (Sylvirana guentheri): 俗稱「狗蛙」的低沉共鳴汪叫求偶聲 (Wof-ribbit)
  private playFrog(ctx: AudioContext, onEnded: () => void) {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.35, now);
    masterGain.connect(ctx.destination);

    // 兩聲沉穩洪亮的赤蛙汪鳴
    const barks = [0, 0.42];
    barks.forEach((offset) => {
      const t = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(240, t + 0.08);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.3);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(380, t);
      filter.frequency.linearRampToValueAtTime(580, t + 0.1);
      filter.frequency.linearRampToValueAtTime(320, t + 0.3);
      filter.Q.setValueAtTime(3.5, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      osc.start(t);
      osc.stop(t + 0.36);
    });

    const totalDuration = 0.42 + 0.45;
    const timer = setTimeout(onEnded, totalDuration * 1000);
    this.currentStopCallback = () => {
      clearTimeout(timer);
      onEnded();
    };
  }

  // 3. 藍腹鷴 (Lophura swinhoii): 幽靜山林特有種高雅雉鳥悠揚長哨音 (Melodic Bird Whistle)
  private playBird(ctx: AudioContext, onEnded: () => void) {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.25, now);
    masterGain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(2600, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(2100, now + 0.55);
    osc.frequency.exponentialRampToValueAtTime(1750, now + 0.85);

    // 微妙顫音模擬鳥鳴真切喉韻
    vibrato.frequency.setValueAtTime(7.5, now);
    vibratoGain.gain.setValueAtTime(45, now);
    vibrato.connect(osc.frequency);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.08);
    gain.gain.setValueAtTime(0.35, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

    osc.connect(gain);
    gain.connect(masterGain);

    vibrato.start(now);
    osc.start(now);
    vibrato.stop(now + 1.0);
    osc.stop(now + 1.0);

    const timer = setTimeout(onEnded, 1050);
    this.currentStopCallback = () => {
      clearTimeout(timer);
      onEnded();
    };
  }

  // 4. 黃口攀蜥 (Diploderma): 威嚇張口示威的氣流嘶聲與喉底低音 (Warning Hiss & Display)
  private playLizard(ctx: AudioContext, onEnded: () => void) {
    const now = ctx.currentTime;
    const duration = 0.65;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.3, now);
    masterGain.connect(ctx.destination);

    // 白噪音生成氣息嘶聲
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(950, now + duration);
    filter.Q.setValueAtTime(2.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // 同步加入微弱低頻胸腔共振
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(130, now);
    subOsc.frequency.exponentialRampToValueAtTime(80, now + duration);
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.2, now + 0.06);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    subOsc.connect(subGain);
    subGain.connect(masterGain);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    noise.start(now);
    subOsc.start(now);
    noise.stop(now + duration);
    subOsc.stop(now + duration);

    const timer = setTimeout(onEnded, 700);
    this.currentStopCallback = () => {
      clearTimeout(timer);
      onEnded();
    };
  }

  // 5. 青帶鳳蝶 (Graphium sarpedon): 蝶翼迅捷翩躚穿梭森林微風聲與輕透和弦 (Wing Flutter & Shimmer)
  private playButterfly(ctx: AudioContext, onEnded: () => void) {
    const now = ctx.currentTime;
    const duration = 0.8;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.2, now);
    masterGain.connect(ctx.destination);

    // 輕巧的高音清亮泛音
    const notes = [1760, 2093, 2637];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.09;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.08, t + 0.25);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(t);
      osc.stop(t + 0.36);
    });

    const timer = setTimeout(onEnded, 850);
    this.currentStopCallback = () => {
      clearTimeout(timer);
      onEnded();
    };
  }

  // 6. 壯闊高山手勢：高山微風與聖稜鐘音 (Alpine Harmonic Wind Chime)
  private playMountainChime(ctx: AudioContext, onEnded: () => void) {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.25, now);
    masterGain.connect(ctx.destination);

    const harmonics = [440, 660, 880, 1320];
    harmonics.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.06;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.3 / (idx + 1), t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(t);
      osc.stop(t + 1.25);
    });

    const timer = setTimeout(onEnded, 1300);
    this.currentStopCallback = () => {
      clearTimeout(timer);
      onEnded();
    };
  }

  // 通用大自然音效
  private playGenericNatureSound(ctx: AudioContext, onEnded: () => void) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.2);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.42);

    const timer = setTimeout(onEnded, 450);
    this.currentStopCallback = () => {
      clearTimeout(timer);
      onEnded();
    };
  }
}

export const animalAudio = new AnimalAudioSynthesizer();
