import type { TrackState } from '../store/audioStore';
import { useAudioStore } from '../store/audioStore';

interface Props {
  track: TrackState;
}

export function TrackCard({ track }: Props) {
  const { toggleTrack, setTrackVolume } = useAudioStore();

  return (
    <div
      className={`track ${track.isPlaying ? 'is-playing' : ''}`}
      onClick={() => toggleTrack(track.id)}
    >
      <div className="track__head">
        <span className="track__icon">{track.icon}</span>
        <span className="track__name">{track.name}</span>
        <span className="track__name-en">{track.nameEn}</span>
        <span className="track__pulse" />
      </div>
      <div className="track__slider" onClick={(e) => e.stopPropagation()}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={track.volume}
          onChange={(e) => setTrackVolume(track.id, parseFloat(e.target.value))}
          style={{
            '--pct': `${track.volume * 100}%`,
          } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
