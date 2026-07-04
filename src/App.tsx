import { useCallback } from 'react';
import { VideoBackground } from './components/VideoBackground';
import { RippleCanvas } from './components/RippleCanvas';
import { TopBar } from './components/TopBar';
import { BottomControls } from './components/BottomControls';
import { useIdle } from './hooks/useIdle';
import { useAudioStore } from './store/audioStore';

export default function App() {
  const setUiVisible = useAudioStore((s) => s.setUiVisible);
  const uiVisible = useAudioStore((s) => s.uiVisible);

  const onIdle = useCallback(() => setUiVisible(false), [setUiVisible]);
  const onActive = useCallback(() => setUiVisible(true), [setUiVisible]);
  useIdle(30000, onIdle, onActive);

  return (
    <div className={`app ${uiVisible ? '' : 'is-idle'}`}>
      <VideoBackground />
      <RippleCanvas />
      <div className={`ui-layer ${uiVisible ? 'is-visible' : ''}`}>
        <TopBar />
        <BottomControls />
      </div>
      <div className="vignette" />
    </div>
  );
}
