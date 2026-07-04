// Onset 检测器：维护过去 1 秒 RMS 均值，检测瞬时峰值
export class OnsetDetector {
  private history: number[] = [];
  private readonly historyMs = 1000;
  private lastTriggerTime = 0;
  private readonly debounceMs = 80;

  constructor(
    private readonly thresholdMult = 1.5,
    private readonly minRms = 0.05
  ) {}

  /** 返回当前帧是否构成一次 onset（已做防抖） */
  detect(currentRms: number, nowMs: number): boolean {
    // 维护 1 秒历史
    this.history.push(currentRms);
    const cutoff = nowMs - this.historyMs;
    // 简单裁剪（按时间近似：保留最近 N 个样本，N 由调用频率决定）
    while (this.history.length > 60) this.history.shift();

    const avg =
      this.history.reduce((a, b) => a + b, 0) / this.history.length;

    if (
      currentRms > avg * this.thresholdMult &&
      currentRms > this.minRms &&
      nowMs - this.lastTriggerTime > this.debounceMs
    ) {
      this.lastTriggerTime = nowMs;
      return true;
    }
    return false;
  }

  reset() {
    this.history = [];
    this.lastTriggerTime = 0;
  }
}
