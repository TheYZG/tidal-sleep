// Canvas 音频可视化渲染器 V2
// 三层可视化，确保"始终活着、一眼可感知"：
// 1. 呼吸光晕：屏幕中心径向渐变，半径/亮度跟总音量实时联动
// 2. 频谱条：屏幕底部细条频谱，跟节奏跳动（最直观）
// 3. 涟漪：音量越大生成越频繁（不依赖 onset 峰值检测）
//
// 性能：DPR 限制 1.5、涟漪上限 14、空闲跳帧
export interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  age: number;
  duration: number;
}

export class RippleRenderer {
  private ripples: Ripple[] = [];
  private rafId = 0;
  private lastTime = 0;
  private dpr = 1;
  private lastRippleTime = 0;

  // 频谱数据
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private getFreqData: () => Uint8Array<ArrayBuffer> | null;

  // 调参
  maxRadiusBase = 110;
  durationMs = 1200;
  initialAlpha = 0.7;
  strokeColor = '180, 215, 235';
  glowColor = '111, 179, 168'; // 呼吸光晕色（青绿）
  private readonly maxRipples = 14;
  private idleFrames = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private ctx: CanvasRenderingContext2D,
    private getLevel: () => number,
    private getFreqDataFn: () => Uint8Array<ArrayBuffer> | null,
    private spawnTrigger: (cb: (x: number, y: number) => void) => void
  ) {
    this.getFreqData = getFreqDataFn;
  }

  start() {
    this.resize();
    this.lastTime = performance.now();
    const loop = (t: number) => {
      const dt = t - this.lastTime;
      this.lastTime = t;
      this.update(dt, t);
      this.draw();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  spawn(x?: number, y?: number) {
    if (this.ripples.length >= this.maxRipples) this.ripples.shift();
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.ripples.push({
      x: x ?? Math.random() * w,
      y: y ?? Math.random() * h,
      radius: 0,
      maxRadius: this.maxRadiusBase,
      alpha: this.initialAlpha,
      age: 0,
      duration: this.durationMs,
    });
    this.idleFrames = 0;
  }

  private update(dt: number, nowMs: number) {
    const level = this.getLevel();
    // level 通常 0~0.3，放大用于驱动效果
    const amplified = Math.min(1, level * 3);
    const dynamicMax = this.maxRadiusBase * (1 + amplified * 1.5);

    // 涟漪生成：音量越大生成越频繁（不再依赖 onset）
    // 音量 0 → 每 1500ms 一个；音量满 → 每 150ms 一个
    const interval = 1500 - amplified * 1350;
    if (amplified > 0.02 && nowMs - this.lastRippleTime > interval) {
      this.lastRippleTime = nowMs;
      this.spawnTrigger((x, y) => this.spawn(x, y));
    }

    // 更新现有涟漪
    for (const r of this.ripples) {
      r.age += dt;
      const progress = r.age / r.duration;
      r.radius = dynamicMax * easeOutCubic(progress);
      r.alpha = this.initialAlpha * (1 - progress);
    }
    this.ripples = this.ripples.filter((r) => r.age < r.duration);

    if (this.ripples.length === 0) {
      this.idleFrames++;
    } else {
      this.idleFrames = 0;
    }

    // 拉取频谱数据
    this.freqData = this.getFreqData();
  }

  private draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.ctx.clearRect(0, 0, w, h);

    const level = this.getLevel();
    const amplified = Math.min(1, level * 3);

    // === 第 1 层：呼吸光晕（屏幕中心径向渐变）===
    this.drawBreathGlow(w, h, amplified);

    // === 第 2 层：频谱条（屏幕底部）===
    this.drawSpectrum(w, h);

    // === 第 3 层：涟漪 ===
    this.drawRipples();

    // 空闲时也保留 1 帧避免完全黑屏（呼吸光晕始终在）
    void this.idleFrames;
  }

  private drawBreathGlow(w: number, h: number, amplified: number) {
    const cx = w / 2;
    const cy = h / 2;
    // 半径随音量从 30% 屏幕宽 扩到 70%
    const radius = (w * 0.3) + amplified * (w * 0.4);
    // 亮度随音量
    const alpha = 0.05 + amplified * 0.18;
    const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(${this.glowColor}, ${alpha})`);
    grad.addColorStop(0.5, `rgba(${this.glowColor}, ${alpha * 0.4})`);
    grad.addColorStop(1, `rgba(${this.glowColor}, 0)`);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);
  }

  private drawSpectrum(w: number, h: number) {
    if (!this.freqData) return;
    const data = this.freqData;
    // 只用前 1/3 频段（人耳敏感区），映射到屏幕宽
    const bins = Math.floor(data.length / 3);
    const barCount = 64;
    const step = Math.floor(bins / barCount);
    const barWidth = w / barCount;
    const maxBarHeight = h * 0.18; // 频谱最高占屏幕 18%
    const baseY = h; // 从屏幕底部往上长

    for (let i = 0; i < barCount; i++) {
      // 取这组里的最大值
      let v = 0;
      for (let j = 0; j < step; j++) {
        v = Math.max(v, data[i * step + j] || 0);
      }
      const normalized = v / 255;
      const barH = normalized * maxBarHeight;
      if (barH < 1) continue;
      const x = i * barWidth;
      // 渐变：底部青绿 → 顶部冷白
      const grad = this.ctx.createLinearGradient(0, baseY, 0, baseY - barH);
      grad.addColorStop(0, `rgba(${this.glowColor}, 0.5)`);
      grad.addColorStop(1, `rgba(${this.strokeColor}, 0.85)`);
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(x + 1, baseY - barH, barWidth - 2, barH);
    }
  }

  private drawRipples() {
    this.ctx.lineWidth = 2;
    for (const r of this.ripples) {
      // 主圆环 - 实心填充半透明 + 描边
      this.ctx.beginPath();
      this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(${this.strokeColor}, ${r.alpha * 0.08})`;
      this.ctx.fill();
      this.ctx.strokeStyle = `rgba(${this.strokeColor}, ${r.alpha})`;
      this.ctx.stroke();
      // 内圈
      if (r.radius > 12) {
        this.ctx.beginPath();
        this.ctx.arc(r.x, r.y, r.radius * 0.65, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(${this.glowColor}, ${r.alpha * 0.5})`;
        this.ctx.stroke();
      }
    }
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
