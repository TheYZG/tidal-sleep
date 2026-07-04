// 13 个白噪音/环境音的 Web Audio 实时合成
// 每个合成器返回一组 AudioNode，由 AudioEngine 接到 masterGain
// 所有合成器在启动时生成 ~2 秒 buffer 循环播放，或用 noise + filter 实时处理

export type SyntheticKind =
  | 'white'
  | 'pink'
  | 'brown'
  | 'rain'
  | 'thunder'
  | 'ocean'
  | 'wind'
  | 'stream'
  | 'birds'
  | 'campfire'
  | 'cafe'
  | 'keyboard'
  | 'train';

export interface SyntheticHandle {
  output: GainNode; // 接到 masterGain
  start: () => void;
  stop: () => void;
}

// 生成白噪音 buffer（2 秒，循环用）
function makeWhiteNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const length = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// 生成粉噪音 buffer（Voss-McCartney 简化版）
function makePinkNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const length = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

// 生成褐噪音 buffer（积分白噪音）
function makeBrownNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const length = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

// 创建循环 buffer 源
function makeLoopSource(ctx: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

// 纯噪音合成器（白/粉/褐）
function createPureNoise(
  ctx: AudioContext,
  kind: 'white' | 'pink' | 'brown'
): SyntheticHandle {
  const buffer =
    kind === 'white'
      ? makeWhiteNoiseBuffer(ctx)
      : kind === 'pink'
        ? makePinkNoiseBuffer(ctx)
        : makeBrownNoiseBuffer(ctx);
  const source = makeLoopSource(ctx, buffer);
  const output = ctx.createGain();
  output.gain.value = 0;
  source.connect(output);
  return {
    output,
    start: () => source.start(),
    stop: () => {
      try {
        source.stop();
      } catch {
        /* 已停止 */
      }
    },
  };
}

// 雨声：白噪音经高通滤波 + 轻微调制，模拟雨打玻璃
function createRain(ctx: AudioContext): SyntheticHandle {
  const buffer = makeWhiteNoiseBuffer(ctx, 3);
  const source = makeLoopSource(ctx, buffer);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 800;
  hp.Q.value = 0.7;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5000;
  // 缓慢振幅调制，让雨声有"阵密阵疏"
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.15;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.12;
  const baseGain = ctx.createGain();
  baseGain.gain.value = 0.18;
  lfo.connect(lfoGain).connect(baseGain.gain);
  const output = ctx.createGain();
  output.gain.value = 0;
  source.connect(hp).connect(lp).connect(baseGain).connect(output);
  return {
    output,
    start: () => {
      source.start();
      lfo.start();
    },
    stop: () => {
      try {
        source.stop();
        lfo.stop();
      } catch {
        /* */
      }
    },
  };
}

// 雷声：低频褐噪音 + 偶发爆发（用 LFO 触发 gain 脉冲）
function createThunder(ctx: AudioContext): SyntheticHandle {
  const buffer = makeBrownNoiseBuffer(ctx, 4);
  const source = makeLoopSource(ctx, buffer);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 200;
  const output = ctx.createGain();
  output.gain.value = 0;
  source.connect(lp).connect(output);
  // 周期性雷声脉冲
  const lfo = ctx.createOscillator();
  lfo.type = 'sawtooth';
  lfo.frequency.value = 0.08; // ~12秒一次
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.25;
  const rect = ctx.createWaveShaper();
  rect.curve = makeRectifierCurve();
  lfo.connect(rect).connect(lfoGain).connect(output.gain);
  return {
    output,
    start: () => {
      source.start();
      lfo.start();
    },
    stop: () => {
      try {
        source.stop();
        lfo.stop();
      } catch {
        /* */
      }
    },
  };
}

function makeRectifierCurve(): Float32Array {
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / n) * 2 - 1;
    curve[i] = Math.max(0, x);
  }
  return curve;
}

// 海浪：褐噪音 + 慢速振幅调制（0.1Hz 模拟潮汐）
function createOcean(ctx: AudioContext): SyntheticHandle {
  const buffer = makePinkNoiseBuffer(ctx, 4);
  const source = makeLoopSource(ctx, buffer);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.1;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.25;
  const baseGain = ctx.createGain();
  baseGain.gain.value = 0.22;
  lfo.connect(lfoGain).connect(baseGain.gain);
  const output = ctx.createGain();
  output.gain.value = 0;
  source.connect(lp).connect(baseGain).connect(output);
  return {
    output,
    start: () => {
      source.start();
      lfo.start();
    },
    stop: () => {
      try {
        source.stop();
        lfo.stop();
      } catch {
        /* */
      }
    },
  };
}

// 风声：带通噪音 + 慢调制
function createWind(ctx: AudioContext): SyntheticHandle {
  const buffer = makeWhiteNoiseBuffer(ctx, 4);
  const source = makeLoopSource(ctx, buffer);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 500;
  bp.Q.value = 1.2;
  // 风的频率漂移
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 300;
  lfo.connect(lfoGain).connect(bp.frequency);
  const output = ctx.createGain();
  output.gain.value = 0;
  source.connect(bp).connect(output);
  return {
    output,
    start: () => {
      source.start();
      lfo.start();
    },
    stop: () => {
      try {
        source.stop();
        lfo.stop();
      } catch {
        /* */
      }
    },
  };
}

// 溪流：高通白噪音 + 中频带通叠加
function createStream(ctx: AudioContext): SyntheticHandle {
  const buffer = makeWhiteNoiseBuffer(ctx, 3);
  const source = makeLoopSource(ctx, buffer);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1500;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3000;
  bp.Q.value = 0.6;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.3;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.08;
  const baseGain = ctx.createGain();
  baseGain.gain.value = 0.12;
  lfo.connect(lfoGain).connect(baseGain.gain);
  const output = ctx.createGain();
  output.gain.value = 0;
  source.connect(hp).connect(bp).connect(baseGain).connect(output);
  return {
    output,
    start: () => {
      source.start();
      lfo.start();
    },
    stop: () => {
      try {
        source.stop();
        lfo.stop();
      } catch {
        /* */
      }
    },
  };
}

// 鸟鸣：间歇性正弦扫频（chirp）
function createBirds(ctx: AudioContext): SyntheticHandle {
  const output = ctx.createGain();
  output.gain.value = 0;
  const baseGain = ctx.createGain();
  baseGain.gain.value = 0;
  baseGain.connect(output);
  // 用定时器周期性触发鸟鸣
  let stopped = false;
  const chirp = () => {
    if (stopped) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const startFreq = 2000 + Math.random() * 1500;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      startFreq + 800,
      ctx.currentTime + 0.08
    );
    osc.frequency.exponentialRampToValueAtTime(
      startFreq,
      ctx.currentTime + 0.16
    );
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    osc.connect(g).connect(baseGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    // 下一只鸟
    const next = 400 + Math.random() * 1800;
    setTimeout(chirp, next);
  };
  // 启动增益拉到 1（音量由 output 控制）
  return {
    output,
    start: () => {
      baseGain.gain.value = 1;
      setTimeout(chirp, 200);
    },
    stop: () => {
      stopped = true;
      baseGain.gain.value = 0;
    },
  };
}

// 篝火：白噪音 + 偶发爆裂（crackle）
function createCampfire(ctx: AudioContext): SyntheticHandle {
  const buffer = makePinkNoiseBuffer(ctx, 3);
  const source = makeLoopSource(ctx, buffer);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 800;
  const baseGain = ctx.createGain();
  baseGain.gain.value = 0.15;
  // 振幅调制模拟火焰舔动
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.5;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.05;
  lfo.connect(lfoGain).connect(baseGain.gain);
  const output = ctx.createGain();
  output.gain.value = 0;
  source.connect(lp).connect(baseGain).connect(output);
  // 偶发爆裂
  let stopped = false;
  const crackle = () => {
    if (stopped) return;
    const burst = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.2));
    }
    burst.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2000 + Math.random() * 2000;
    const g = ctx.createGain();
    g.gain.value = 0.08 + Math.random() * 0.1;
    burst.connect(bp).connect(g).connect(output);
    burst.start();
    const next = 200 + Math.random() * 900;
    setTimeout(crackle, next);
  };
  return {
    output,
    start: () => {
      source.start();
      lfo.start();
      setTimeout(crackle, 300);
    },
    stop: () => {
      stopped = true;
      try {
        source.stop();
        lfo.stop();
      } catch {
        /* */
      }
    },
  };
}

// 咖啡馆：低频褐噪音 + 偶发杯子碰撞
function createCafe(ctx: AudioContext): SyntheticHandle {
  const buffer = makeBrownNoiseBuffer(ctx, 4);
  const source = makeLoopSource(ctx, buffer);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 500;
  const baseGain = ctx.createGain();
  baseGain.gain.value = 0.1;
  const output = ctx.createGain();
  output.gain.value = 0;
  source.connect(lp).connect(baseGain).connect(output);
  let stopped = false;
  const clink = () => {
    if (stopped) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = 1500 + Math.random() * 2000;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.connect(g).connect(output);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    const next = 1500 + Math.random() * 4000;
    setTimeout(clink, next);
  };
  return {
    output,
    start: () => {
      source.start();
      setTimeout(clink, 1000);
    },
    stop: () => {
      stopped = true;
      try {
        source.stop();
      } catch {
        /* */
      }
    },
  };
}

// 键盘：随机点击脉冲
function createKeyboard(ctx: AudioContext): SyntheticHandle {
  const output = ctx.createGain();
  output.gain.value = 0;
  const baseGain = ctx.createGain();
  baseGain.gain.value = 1;
  baseGain.connect(output);
  let stopped = false;
  const click = () => {
    if (stopped) return;
    const burst = ctx.createBufferSource();
    const len = 0.03;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.15));
    }
    burst.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2500 + Math.random() * 1500;
    bp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.value = 0.05 + Math.random() * 0.06;
    burst.connect(bp).connect(g).connect(baseGain);
    burst.start();
    const next = 80 + Math.random() * 250;
    setTimeout(click, next);
  };
  return {
    output,
    start: () => {
      baseGain.gain.value = 1;
      setTimeout(click, 100);
    },
    stop: () => {
      stopped = true;
      baseGain.gain.value = 0;
    },
  };
}

// 火车：低频节奏性噪音
function createTrain(ctx: AudioContext): SyntheticHandle {
  const buffer = makeBrownNoiseBuffer(ctx, 4);
  const source = makeLoopSource(ctx, buffer);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 300;
  const baseGain = ctx.createGain();
  baseGain.gain.value = 0.16;
  // 节奏性振幅调制（车轮咔哒）
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 2.5; // 每秒2.5次
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.06;
  lfo.connect(lfoGain).connect(baseGain.gain);
  const output = ctx.createGain();
  output.gain.value = 0;
  source.connect(lp).connect(baseGain).connect(output);
  return {
    output,
    start: () => {
      source.start();
      lfo.start();
    },
    stop: () => {
      try {
        source.stop();
        lfo.stop();
      } catch {
        /* */
      }
    },
  };
}

export function createSynthetic(
  ctx: AudioContext,
  kind: SyntheticKind
): SyntheticHandle {
  switch (kind) {
    case 'white':
      return createPureNoise(ctx, 'white');
    case 'pink':
      return createPureNoise(ctx, 'pink');
    case 'brown':
      return createPureNoise(ctx, 'brown');
    case 'rain':
      return createRain(ctx);
    case 'thunder':
      return createThunder(ctx);
    case 'ocean':
      return createOcean(ctx);
    case 'wind':
      return createWind(ctx);
    case 'stream':
      return createStream(ctx);
    case 'birds':
      return createBirds(ctx);
    case 'campfire':
      return createCampfire(ctx);
    case 'cafe':
      return createCafe(ctx);
    case 'keyboard':
      return createKeyboard(ctx);
    case 'train':
      return createTrain(ctx);
  }
}
