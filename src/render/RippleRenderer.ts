// Canvas 涟漪渲染器：onset 触发时生成同心圆涟漪向外扩散
// 性能优化：DPR 限制 1.5、涟漪上限 12、无活动时空闲跳帧
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
  private dpr = 1; // 初始 1，resize 时计算
  // 调参变量
  maxRadiusBase = 80;
  durationMs = 800;
  initialAlpha = 0.55;
  strokeColor = '180, 215, 235';
  private readonly maxRipples = 12; // 20 → 12 性能优化
  private idleFrames = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private ctx: CanvasRenderingContext2D,
    private getLevel: () => number,
    private detectOnset: (nowMs: number) => boolean,
    private spawnTrigger: (cb: (x: number, y: number) => void) => void
  ) {}

  start() {
    this.resize();
    this.lastTime = performance.now();
    const loop = (t: number) => {
      const dt = t - this.lastTime;
      this.lastTime = t;
      this.update(dt, t);
      // 空闲跳帧：无涟漪且无 onset 时，跳过 draw（canvas 已是空）
      if (this.ripples.length > 0 || this.idleFrames < 3) {
        this.draw();
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
  }

  resize() {
    // DPR 限制 1.5，避免高分屏下 canvas 像素爆炸
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
    const dynamicMax = this.maxRadiusBase * (1 + level * 1.2);

    if (this.detectOnset(nowMs)) {
      this.spawnTrigger((x, y) => this.spawn(x, y));
    }

    for (const r of this.ripples) {
      r.age += dt;
      const progress = r.age / r.duration;
      r.radius = dynamicMax * easeOutCubic(progress);
      r.alpha = this.initialAlpha * (1 - progress);
    }
    this.ripples = this.ripples.filter((r) => r.age < r.duration);

    // 空闲计数：无涟漪时累计，有涟漪时归零
    if (this.ripples.length === 0) {
      this.idleFrames++;
    } else {
      this.idleFrames = 0;
    }
  }

  private draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.lineWidth = 1.5;
    for (const r of this.ripples) {
      // 主圆环
      this.ctx.beginPath();
      this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(${this.strokeColor}, ${r.alpha})`;
      this.ctx.stroke();
      // 内圈微光
      if (r.radius > 8) {
        this.ctx.beginPath();
        this.ctx.arc(r.x, r.y, r.radius * 0.7, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(${this.strokeColor}, ${r.alpha * 0.4})`;
        this.ctx.stroke();
      }
    }
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
