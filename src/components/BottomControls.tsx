import { useRef, useState } from 'react';
import { useAudioStore } from '../store/audioStore';
import { TrackCard } from './TrackCard';
import { CATEGORY_LABELS } from '../data/tracks';
import type { TrackState } from '../store/audioStore';

export function BottomControls() {
  const { tracks, masterVolume, setMasterVolume, background, setBackground, resetBackground } = useAudioStore();
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const byCategory = (cat: TrackState['category']) =>
    tracks.filter((t) => t.category === cat);
  const cats: TrackState['category'][] = ['nature', 'fire', 'urban', 'noise'];
  const activeCount = tracks.filter((t) => t.isPlaying).length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) return;
    // 用 DataURL 持久化（图片小可存 localStorage；视频大则不持久化，刷新后回退默认）
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setBackground({
        kind: 'custom',
        src,
        isVideo,
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
    // 清空 input，允许重复选同一文件
    e.target.value = '';
  };

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

      {open && <div className="drawer-overlay" onClick={() => setOpen(false)} />}

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

        <div className="drawer__bg-section">
          <div className="drawer__group-label">背景</div>
          <div className="drawer__bg-controls">
            <button
              className="drawer__bg-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="drawer__bg-btn-icon">⊜</span>
              <span className="drawer__bg-btn-text">
                {background.kind === 'custom' ? '更换背景' : '上传图片/视频'}
              </span>
            </button>
            {background.kind === 'custom' && (
              <button
                className="drawer__bg-btn drawer__bg-btn--reset"
                onClick={resetBackground}
              >
                <span className="drawer__bg-btn-icon">↺</span>
                <span className="drawer__bg-btn-text">恢复默认</span>
              </button>
            )}
            {background.kind === 'custom' && background.name && (
              <div className="drawer__bg-name" title={background.name}>
                {background.name}
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
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
