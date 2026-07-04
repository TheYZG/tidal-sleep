import { create } from 'zustand';
import { AudioEngine } from '../audio/AudioEngine';
import { TRACKS } from '../data/tracks';

// 初始化：每个音轨音量 0.3，未播放
const initialTracks = TRACKS.map((t) => ({
  ...t,
  volume: 0.3,
  isPlaying: false,
}));

export interface TrackState {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  category: 'nature' | 'fire' | 'urban' | 'noise';
  volume: number;
  isPlaying: boolean;
}

interface AudioStore {
  tracks: TrackState[];
  masterVolume: number;
  uiVisible: boolean;
  timerMinutes: number | null; // null = 不计时
  timerEndsAt: number | null;
  toggleTrack: (id: string) => void;
  setTrackVolume: (id: string, vol: number) => void;
  setMasterVolume: (vol: number) => void;
  setUiVisible: (v: boolean) => void;
  setTimer: (minutes: number | null) => void;
  stopAll: () => void;
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  tracks: initialTracks,
  masterVolume: 0.7,
  uiVisible: true,
  timerMinutes: null,
  timerEndsAt: null,

  toggleTrack: (id) => {
    const t = get().tracks.find((x) => x.id === id);
    if (!t) return;
    const nextPlaying = !t.isPlaying;
    AudioEngine.ensureStarted().then(() => {
      AudioEngine.setTrackVolume(id, nextPlaying ? t.volume : 0);
    });
    set((s) => ({
      tracks: s.tracks.map((x) =>
        x.id === id ? { ...x, isPlaying: nextPlaying } : x
      ),
    }));
  },

  setTrackVolume: (id, vol) => {
    set((s) => ({
      tracks: s.tracks.map((x) =>
        x.id === id ? { ...x, volume: vol } : x
      ),
    }));
    const t = get().tracks.find((x) => x.id === id);
    if (t?.isPlaying) AudioEngine.setTrackVolume(id, vol);
  },

  setMasterVolume: (vol) => {
    set({ masterVolume: vol });
    AudioEngine.setMasterVolume(vol);
  },

  setUiVisible: (v) => set({ uiVisible: v }),

  setTimer: (minutes) => {
    if (minutes === null) {
      set({ timerMinutes: null, timerEndsAt: null });
    } else {
      set({
        timerMinutes: minutes,
        timerEndsAt: Date.now() + minutes * 60 * 1000,
      });
    }
  },

  stopAll: () => {
    AudioEngine.stopAll();
    set((s) => ({
      tracks: s.tracks.map((x) => ({ ...x, isPlaying: false })),
      timerMinutes: null,
      timerEndsAt: null,
    }));
  },
}));

// 注册音轨到 AudioEngine（合成器在 ensureStarted 时才创建）
AudioEngine.registerTracks(
  TRACKS.map((t) => ({ id: t.id, syntheticKind: t.kind, src: t.src }))
);
