import { useState } from 'react';
import { useAudioStore } from '../store/audioStore';
import { TrackCard } from './TrackCard';
import { CATEGORY_LABELS } from '../data/tracks';
import type { TrackState } from '../store/audioStore';

export function BottomControls() {
  const { tracks, masterVolume, setMasterVolume } = useAudioStore();
  const [open, setOpen] = useState(false);

  const byCategory = (cat: TrackState['category']) =>
    tracks.filter((t) => t.category === cat);
  const cats: TrackState['category'][] = ['nature', 'fire', 'urban', 'noise'];
  const activeCount = tracks.filter((t) => t.isPlaying).length;

  return (
    <>
      {/* 触发按钮 - 固定在右下 */}
      <button
        className={`drawer-trigger ${open ? 'is-open' : ''} ${activeCount > 0 ? 'has-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="音轨"
      >
        <span className="drawer-trigger__icon">
          {open ? '✕' : '♫'}
        </span>
        {activeCount > 0 && !open && (
          <span className="drawer-trigger__badge">{activeCount}</span>
        )}
      </button>

      {/* 遮罩（移动端用，桌面点外不关） */}
      {open && <div className="drawer-overlay" onClick={() => setOpen(false)} />}

      {/* 抽屉本体 */}
      <aside className={`drawer ${open ? 'is-open' : ''}`}>
        <div className="drawer__head">
          <div className="drawer__title">
            <span className="drawer__title-cn">声境</span>
            <span className="drawer__title-en">soundscape</span>
          </div>
          <button className="drawer__close" onClick={() => setOpen(false)}>✕</button>
        </div>

        <div className="drawer__scroll">
          {cats.map((cat) => (
            <section key={cat} className="drawer__group">
              <div className="drawer__group-label">{CATEGORY_LABELS[cat]}</div>
              <div className="drawer__tracks">
                {byCategory(cat).map((t) => (
                  <TrackCard key={t.id} track={t} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="drawer__master">
          <span className="drawer__master-label">总音量</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            style={{
              '--pct': `${masterVolume * 100}%`,
            } as React.CSSProperties}
          />
        </div>
      </aside>
    </>
  );
}
