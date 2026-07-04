import { useEffect, useState } from 'react';
import { useAudioStore } from '../store/audioStore';

const OPTIONS: (number | null)[] = [15, 30, 60, null];

export function Timer() {
  const { timerMinutes, setTimer, stopAll } = useAudioStore();
  const [, force] = useState(0);

  // 每秒刷新显示
  useEffect(() => {
    const i = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const endsAt = useAudioStore((s) => s.timerEndsAt);

  // 到点触发
  useEffect(() => {
    if (!endsAt) return;
    const remaining = endsAt - Date.now();
    if (remaining <= 0) {
      stopAll();
      return;
    }
    const t = setTimeout(() => stopAll(), remaining);
    return () => clearTimeout(t);
  }, [endsAt, stopAll]);

  const display = (() => {
    if (!endsAt) return timerMinutes ? `${timerMinutes}:00` : '∞';
    const remaining = Math.max(0, endsAt - Date.now());
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, '0')}`;
  })();

  return (
    <div className="timer">
      <div className="timer__display">{display}</div>
      <div className="timer__opts">
        {OPTIONS.map((o) => (
          <button
            key={String(o)}
            className={`timer__opt ${timerMinutes === o ? 'is-active' : ''}`}
            onClick={() => setTimer(o)}
          >
            {o === null ? '∞' : `${o}m`}
          </button>
        ))}
      </div>
    </div>
  );
}
