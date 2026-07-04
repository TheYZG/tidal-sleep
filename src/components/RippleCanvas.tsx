import { useEffect, useRef } from 'react';
import { RippleRenderer } from '../render/RippleRenderer';
import { AudioEngine } from '../audio/AudioEngine';

export function RippleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderer = new RippleRenderer(
      canvas,
      ctx,
      () => AudioEngine.getLevel(),
      (nowMs) => AudioEngine.detectOnset(nowMs),
      (spawn) => spawn() // 默认随机位置
    );

    renderer.start();
    const onResize = () => renderer.resize();
    window.addEventListener('resize', onResize);
    return () => {
      renderer.stop();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="ripple-canvas" />;
}
