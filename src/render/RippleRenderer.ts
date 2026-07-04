// Canvas 雨滴可视化渲染器 V3
//
// 核心思路：用频谱能量驱动雨滴生成，音频变化自然决定雨滴密度/位置/大小
//
// 雨滴生成：
// - 频谱分成 N 段（雨滴区域），每段对应屏幕一个水平区域
// - 每段维护自己的能量阈值，能量超过阈值就生成雨滴
// - 音频变化 → 频谱变化 → 不同区域雨滴密度不同，自然形成"雨打玻璃"效果
//
// 雨滴形态（模拟真实雨滴打在水面/玻璃）：
// - 撞击瞬间：中心一个亮点（雨滴落下）
// - 主涟漪：快速向外扩散的圆环
// - 次级涟漪：稍慢的第二个圆环
// - 溅起水花：撞击瞬间几个小点向外飞溅
// - 扩散过程中圆环变细变淡
//
// 性能：DPR 限制 1.5、雨滴上限 30、空闲跳帧

export interface Raindrop {
  x: number;
  y: number;
  age: number;
  duration: number;
  maxRadius: number;
  // 溅起的水花点
  splashes: { x: number; y: number; vx: number; vy: number; life: number }[];
}

// 频谱段：每个段对应屏幕一个水平区域
interface FreqBand {
  startBin: number;
  endBin: number;
  // 平滑后的能量，用于阈值判断
  smoothedEnergy: number;
  // 上次触发时间，防止同一区域过密
  lastTriggerTime: number;
}

export class RippleRenderer {
  private drops: Raindrop[] = [];
  private rafId = 0;
  private lastTime = 0;
  private dpr = 1;

  // 频谱分段
  private bands: FreqBand[] = [];
  private readonly bandCount = 12; // 屏幕水平分 12 个区域

  // 调参
  strokeColor = '180, 215, 235';
  glowColor = '111, 179, 168';
  impactColor = '220, 240, 250'; // 撞击点亮色
  private readonly maxDrops = 30;
  private idleFrames = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private ctx: CanvasRenderingContext2D,
    private getLevel: () => number,
    private getFreqDataFn: () => Uint8Array<ArrayBuffer> | null,
    private spawnTrigger: (cb: (x: number, y: number) => void) => void
  ) {
    // 初始化频谱段
    // 假设 freqData 长度 ~512，前 1/3（~170 bins）是人耳敏感区，分成 12 段
    // 在第一次拿到数据时再真正初始化 bins
    for (let i = 0; i < this.bandCount; i++) {
      this.bands.push({
        startBin: 0,
        endBin: 0,
        smoothedEnergy: 0,
        lastTriggerTime: 0,
      });
    }
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

  // 兼容旧接口（外部可能调用 spawn）
  spawn(x?: number, y?: number) {
    this.spawnDrop(x ?? Math.random() * window.innerWidth, y ?? Math.random() * window.innerHeight, 80);
  }

  // 生成一个雨滴，size 控制最大半径
  private spawnDrop(x: number, y: number, size: number) {
    if (this.drops.length >= this.maxDrops) this.drops.shift();
    // 溅起的水花：4-7 个小点向外飞
    const splashCount = 4 + Math.floor(Math.random() * 4);
    const splashes: Raindrop['splashes'] = [];
    for (let i = 0; i < splashCount; i++) {
      const angle = (Math.PI * 2 * i) / splashCount + Math.random() * 0.5;
      const speed = 0.3 + Math.random() * 0.5;
      splashes.push({
        x,
        y,
        vx: Math.cos(angle) * speed * size * 0.08,
        vy: Math.sin(angle) * speed * size * 0.08,
        life: 1,
      });
    }
    this.drops.push({
      x,
      y,
      age: 0,
      duration: 1400 + Math.random() * 400,
      maxRadius: size,
      splashes,
    });
    this.idleFrames = 0;
  }

  private update(dt: number, nowMs: number) {
    const freqData = this.getFreqDataFn();

    if (freqData) {
      // 首次拿到数据时初始化 bands 的 bin 范围
      if (this.bands[0].startBin === 0 && this.bands[0].endBin === 0) {
        // 用前 60% 的频段（避开高频噪音），分成 bandCount 段
        const usableBins = Math.floor(freqData.length * 0.6);
        const binsPerBand = Math.floor(usableBins / this.bandCount);
        for (let i = 0; i < this.bandCount; i++) {
          this.bands[i].startBin = i * binsPerBand;
          this.bands[i].endBin = (i + 1) * binsPerBand;
        }
      }

      const w = window.innerWidth;
      const h = window.innerHeight;
      const bandWidth = w / this.bandCount;

      // 逐段判断是否生成雨滴
      for (let i = 0; i < this.bandCount; i++) {
        const band = this.bands[i];
        // 计算该段平均能量
        let sum = 0;
        let count = 0;
        for (let j = band.startBin; j < band.endBin; j++) {
          sum += freqData[j] || 0;
          count++;
        }
        const energy = count > 0 ? sum / count / 255 : 0; // 0-1

        // 平滑能量（低通滤波）
        band.smoothedEnergy = band.smoothedEnergy * 0.85 + energy * 0.15;

        // 阈值判断：当前能量超过平滑能量的 1.3 倍，且超过最小阈值 0.12
        // 这样音频有波动才会生成雨滴，平稳时稀疏，突然变响时密集
        const threshold = Math.max(0.12, band.smoothedEnergy * 1.3);
        if (
          energy > threshold &&
          energy > 0.12 &&
          nowMs - band.lastTriggerTime > 60 // 同一区域最小间隔 60ms
        ) {
          band.lastTriggerTime = nowMs;
          // 在该段对应的水平区域内随机位置生成雨滴
          const x = i * bandWidth + Math.random() * bandWidth;
          const y = Math.random() * h;
          // 雨滴大小由能量决定：30 ~ 130
          const size = 30 + energy * 100;
          this.spawnDrop(x, y, size);
          // 同时调用外部 spawnTrigger（兼容旧逻辑，目前为空操作）
          this.spawnTrigger(() => {});
        }
      }
    }

    // 更新现有雨滴
    for (const d of this.drops) {
      d.age += dt;
      // 更新水花
      for (const s of d.splashes) {
        s.x += s.vx * dt * 0.1;
        s.y += s.vy * dt * 0.1;
        s.vy += dt * 0.0005; // 重力
        s.life -= dt / 400;
      }
    }
    this.drops = this.drops.filter((d) => d.age < d.duration);

    if (this.drops.length === 0) {
      this.idleFrames++;
    } else {
      this.idleFrames = 0;
    }
  }

  private draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.ctx.clearRect(0, 0, w, h);

    // === 呼吸光晕（保留，作为氛围底色）===
    const level = this.getLevel();
    const amplified = Math.min(1, level * 3);
    this.drawBreathGlow(w, h, amplified);

    // === 雨滴 ===
    this.drawDrops();

    void this.idleFrames;
  }

  private drawBreathGlow(w: number, h: number, amplified: number) {
    const cx = w / 2;
    const cy = h / 2;
    const radius = w * 0.3 + amplified * w * 0.4;
    const alpha = 0.04 + amplified * 0.14;
    const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(${this.glowColor}, ${alpha})`);
    grad.addColorStop(0.5, `rgba(${this.glowColor}, ${alpha * 0.4})`);
    grad.addColorStop(1, `rgba(${this.glowColor}, 0)`);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);
  }

  private drawDrops() {
    for (const d of this.drops) {
      const progress = d.age / d.duration;
      if (progress >= 1) continue;

      // 主涟漪：快速扩散
      const mainProgress = Math.min(1, progress * 1.4);
      const mainRadius = d.maxRadius * easeOutCubic(mainProgress);
      const mainAlpha = (1 - mainProgress) * 0.7;

      // 撞击点：只在前期可见（前 15%）
      if (progress < 0.15) {
        const impactAlpha = (1 - progress / 0.15) * 0.9;
        this.ctx.beginPath();
        this.ctx.arc(d.x, d.y, 2.5, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(${this.impactColor}, ${impactAlpha})`;
        this.ctx.fill();
      }

      // 主圆环
      if (mainRadius > 1) {
        this.ctx.beginPath();
        this.ctx.arc(d.x, d.y, mainRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(${this.strokeColor}, ${mainAlpha})`;
        this.ctx.lineWidth = 1.8;
        this.ctx.stroke();
      }

      // 次级涟漪：稍慢，半径更小
      const secondProgress = Math.min(1, progress * 0.8);
      if (secondProgress > 0.1) {
        const secondRadius = d.maxRadius * 0.6 * easeOutCubic(secondProgress);
        const secondAlpha = (1 - secondProgress) * 0.35;
        if (secondRadius > 1) {
          this.ctx.beginPath();
          this.ctx.arc(d.x, d.y, secondRadius, 0, Math.PI * 2);
          this.ctx.strokeStyle = `rgba(${this.glowColor}, ${secondAlpha})`;
          this.ctx.lineWidth = 1.2;
          this.ctx.stroke();
        }
      }

      // 溅起的水花
      for (const s of d.splashes) {
        if (s.life <= 0) continue;
        this.ctx.beginPath();
        this.ctx.arc(s.x, s.y, 1.2 * s.life, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(${this.strokeColor}, ${s.life * 0.6})`;
        this.ctx.fill();
      }
    }
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
