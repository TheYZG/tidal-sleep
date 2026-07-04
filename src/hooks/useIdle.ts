import { useEffect, useRef } from 'react';

/** 30 秒无操作返回 idle，鼠标/触摸活动时唤醒 */
export function useIdle(timeoutMs: number, onIdle: () => void, onActive: () => void) {
  const timerRef = useRef<number | null>(null);
  const idleRef = useRef(false);

  useEffect(() => {
    const reset = () => {
      if (idleRef.current) {
        idleRef.current = false;
        onActive();
      }
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        idleRef.current = true;
        onIdle();
      }, timeoutMs);
    };

    const events: (keyof WindowEventMap)[] = ['mousemove', 'touchstart', 'keydown', 'click'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [timeoutMs, onIdle, onActive]);
}
