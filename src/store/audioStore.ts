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

// 背景类型
export type BackgroundKind = 'default' | 'custom';
export interface BackgroundState {
  kind: BackgroundKind;
  src: string; // 自定义背景的 ObjectURL 或 DataURL
  isVideo: boolean; // true=视频，false=图片
  name: string; // 文件名（用于显示）
}

// localStorage 持久化的自定义背景（只存类型和 DataURL）
const STORAGE_KEY = 'tidal-sleep-bg';
const loadStoredBg = (): BackgroundState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BackgroundState;
      if (parsed.kind === 'custom' && parsed.src) {
        return parsed;
      }
    }
  } catch {
    /* 忽略损坏的存储 */
  }
  return { kind: 'default', src: '', isVideo: false, name: '' };
};

interface AudioStore {
  tracks: TrackState[];
  masterVolume: number;
  uiVisible: boolean;
  timerMinutes: number | null;
  timerEndsAt: number | null;
  background: BackgroundState;
  toggleTrack: (id: string) => void;
  setTrackVolume: (id: string, vol: number) => void;
  setMasterVolume: (vol: number) => void;
  setUiVisible: (v: boolean) => void;
  setTimer: (minutes: number | null) => void;
  stopAll: () => void;
  setBackground: (bg: BackgroundState) => void;
  resetBackground: () => void;
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  tracks: initialTracks,
  masterVolume: 0.7,
  uiVisible: true,
  timerMinutes: null,
  timerEndsAt: null,
  background: loadStoredBg(),

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

  setBackground: (bg) => {
    set({ background: bg });
    // 持久化到 localStorage（只持久化自定义背景）
    try {
      if (bg.kind === 'custom' && bg.src) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bg));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // 存储失败（可能是 DataURL 太大），静默忽略
    }
  },

  resetBackground: () => {
    set({ background: { kind: 'default', src: '', isVideo: false, name: '' } });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* */
    }
  },
}));

// 注册音轨到 AudioEngine（合成器在 ensureStarted 时才创建）
AudioEngine.registerTracks(
  TRACKS.map((t) => ({ id: t.id, syntheticKind: t.kind, src: t.src }))
);
