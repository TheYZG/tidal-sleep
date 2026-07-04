import { useAudioStore } from '../store/audioStore';

export function VideoBackground() {
  const bg = useAudioStore((s) => s.background);
  const defaultSrc = '/Background/Rain Background.mp4';

  return (
    <div className="video-bg">
      {bg.kind === 'custom' && !bg.isVideo && (
        <img
          className="video-bg__el video-bg__img"
          src={bg.src}
          alt=""
          draggable={false}
        />
      )}
      {bg.kind === 'custom' && bg.isVideo && (
        <video
          key={bg.src}
          className="video-bg__el"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src={bg.src} type="video/mp4" />
        </video>
      )}
      {bg.kind === 'default' && (
        <video
          className="video-bg__el"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src={defaultSrc} type="video/mp4" />
        </video>
      )}
      <div className="video-bg__veil" />
    </div>
  );
}
