import { createSynthetic, type SyntheticKind, type SyntheticHandle } from './SyntheticNoise';
import { OnsetDetector } from './OnsetDetector';

interface Track {
  id: string;
  syntheticKind: SyntheticKind;
  src?: string;
}

interface LoadedTrack {
  handle: SyntheticHandle;
  bufferSource?: AudioBufferSourceNode;
  bufferGain?: GainNode;
  useRecording: boolean;
}

/**
 * AudioEngine — 单例
 *
 * 无缝循环策略：
 * 1. 录音 buffer 加载后，对首尾做 crossfade 处理（在内存里重写 buffer）
 *    - 取末尾 N ms 与开头 N ms 做等功率交叉淡化
 *    - 处理后的 buffer 用 loop=true 播放，样本级精确循环，无咔哒声
 * 2. 切换音轨时用 setTargetAtTime 做增益淡入淡出（~50ms）
 * 3. 多轨叠加各自独立循环，互不干扰
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

      if (t.src) {
        try {
          const resp = await fetch(t.src);
          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            const audioBuf = await this.ctx.decodeAudioData(buf);
            // 关键：对 buffer 做首尾 crossfade 处理，实现无缝循环
            const seamlessBuf = this.makeSeamlessLoop(audioBuf);
            bufferSource = this.ctx.createBufferSource();
            bufferSource.buffer = seamlessBuf;
            bufferSource.loop = true;
            bufferGain = this.ctx.createGain();
            bufferGain.gain.value = 0;
            bufferSource.connect(bufferGain).connect(trackGain);
            bufferSource.start();
            useRecording = true;
            handle.output.gain.value = 0;
          }
        } catch {
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

  /**
   * 对 AudioBuffer 做首尾交叉淡化，使其可以无缝循环播放
   * 算法：取末尾 crossfadeMs 与开头 crossfadeMs 重叠，做等功率交叉淡化
   * 处理后的 buffer 长度 = 原长度 - crossfadeMs
   */
  private makeSeamlessLoop(buf: AudioBuffer, crossfadeMs = 50): AudioBuffer {
    const sampleRate = buf.sampleRate;
    const crossfadeSamples = Math.min(
      Math.floor(sampleRate * crossfadeMs / 1000),
      Math.floor(buf.length / 4) // 不超过总长 1/4，防止过短素材被吃掉太多
    );

    // 太短的素材不处理（短于 200ms）
    if (buf.length < sampleRate * 0.2) return buf;

    const newLength = buf.length - crossfadeSamples;
    const out = this.ctx!.createBuffer(
      buf.numberOfChannels,
      newLength,
      sampleRate
    );

    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const src = buf.getChannelData(ch);
      const dst = out.getChannelData(ch);
      // 复制主体（不含末尾 crossfade 段）
      for (let i = 0; i < newLength; i++) dst[i] = src[i];
      // 对开头 crossfadeSamples 长度做交叉淡化：开头淡入 + 末尾淡出 等功率混合
      for (let i = 0; i < crossfadeSamples; i++) {
        const t = i / crossfadeSamples;
        // 等功率交叉淡化：sin/cos 曲线
        const fadeIn = Math.sin(t * Math.PI / 2);
        const fadeOut = Math.cos(t * Math.PI / 2);
        const tailSample = src[newLength + i]; // 末尾段
        dst[i] = dst[i] * fadeIn + tailSample * fadeOut;
      }
    }
    return out;
  }

  registerTracks(tracks: Track[]) {
    this.tracks = tracks;
  }

  setTrackVolume(id: string, vol: number) {
    const g = this.trackGains.get(id);
    const loaded = this.loaded.get(id);
    if (!g || !this.ctx || !loaded) return;
    if (loaded.useRecording && loaded.bufferGain) {
      // 录音模式：bufferGain 控制音量，合成器静音
      loaded.bufferGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
      loaded.handle.output.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      g.gain.setTargetAtTime(1, this.ctx.currentTime, 0.05);
    } else {
      // 合成模式：trackGain 控制音量
      g.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
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
