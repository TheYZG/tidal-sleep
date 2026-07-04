import { createSynthetic, type SyntheticKind, type SyntheticHandle } from './SyntheticNoise';
import { OnsetDetector } from './OnsetDetector';

interface Track {
  id: string;
  syntheticKind: SyntheticKind;
  src?: string; // 录音文件路径，可选
}

interface LoadedTrack {
  handle: SyntheticHandle; // 合成器（始终存在，作为兜底）
  bufferSource?: AudioBufferSourceNode; // 录音 buffer（若加载成功）
  bufferGain?: GainNode; // 录音 gain
  useRecording: boolean; // 是否使用录音（true=录音, false=合成）
}

/**
 * AudioEngine — 单例
 * 每个音轨：尝试加载录音文件，成功则播放录音，失败回退到合成
 * 输出路径：录音/合成 → trackGain → masterGain → analyser → destination
 */
class AudioEngineImpl {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private timeData: Uint8Array<ArrayBuffer> | null = null;
  private loaded = new Map<string, LoadedTrack>();
  private trackGains = new Map<string, GainNode>();
  private tracks: Track[] = [];
  private onset = new OnsetDetector(1.5, 0.05);
  private masterVolume = 0.7;
  private started = false;

  async ensureStarted() {
    if (this.started) return;
    this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.6;
    this.timeData = new Uint8Array(this.analyser.fftSize);
    this.masterGain.connect(this.analyser).connect(this.ctx.destination);

    for (const t of this.tracks) {
      const trackGain = this.ctx.createGain();
      trackGain.gain.value = 0;
      trackGain.connect(this.masterGain);
      this.trackGains.set(t.id, trackGain);

      // 始终创建合成器作为兜底
      const handle = createSynthetic(this.ctx, t.syntheticKind);
      handle.output.connect(trackGain);
      handle.start();

      let useRecording = false;
      let bufferSource: AudioBufferSourceNode | undefined;
      let bufferGain: GainNode | undefined;

      // 尝试加载录音文件
      if (t.src) {
        try {
          const resp = await fetch(t.src);
          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            const audioBuf = await this.ctx.decodeAudioData(buf);
            bufferSource = this.ctx.createBufferSource();
            bufferSource.buffer = audioBuf;
            bufferSource.loop = true;
            bufferGain = this.ctx.createGain();
            bufferGain.gain.value = 0; // 默认静音，播放时再开
            bufferSource.connect(bufferGain).connect(trackGain);
            bufferSource.start();
            useRecording = true;
            // 静音合成器（保留运行但听不见）
            handle.output.gain.value = 0;
          }
        } catch {
          // 文件不存在或解码失败，使用合成
          useRecording = false;
        }
      }

      this.loaded.set(t.id, {
        handle,
        bufferSource,
        bufferGain,
        useRecording,
      });
    }
    this.started = true;
  }

  registerTracks(tracks: Track[]) {
    this.tracks = tracks;
  }

  setTrackVolume(id: string, vol: number) {
    const g = this.trackGains.get(id);
    const loaded = this.loaded.get(id);
    if (!g || !this.ctx || !loaded) return;
    // 总 trackGain 始终为 vol（统一控制）
    g.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
    // 录音模式：bufferGain = vol，合成静音
    // 合成模式：handle.output 已连接，gain 默认 1，由 trackGain 控制
    if (loaded.useRecording && loaded.bufferGain) {
      loaded.bufferGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
      // 合成器保持静音
      loaded.handle.output.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      // trackGain 设为 1（不再衰减）
      g.gain.setTargetAtTime(1, this.ctx.currentTime, 0.05);
    }
  }

  setMasterVolume(vol: number) {
    this.masterVolume = vol;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
    }
  }

  stopAll() {
    for (const [, g] of this.trackGains) {
      if (this.ctx) g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    }
  }

  getLevel(): number {
    if (!this.analyser || !this.timeData) return 0;
    this.analyser.getByteTimeDomainData(this.timeData);
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = (this.timeData[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / this.timeData.length);
  }

  detectOnset(nowMs: number): boolean {
    return this.onset.detect(this.getLevel(), nowMs);
  }
}

export const AudioEngine = new AudioEngineImpl();
