export function VideoBackground() {
  return (
    <div className="video-bg">
      <video
        className="video-bg__el"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="/Background/Rain Background.mp4" type="video/mp4" />
      </video>
      <div className="video-bg__veil" />
    </div>
  );
}
