import type { SyntheticKind } from '../audio/SyntheticNoise';

export interface TrackDef {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  kind: SyntheticKind; // 合成类型（始终有，作为兜底）
  category: 'nature' | 'fire' | 'urban' | 'noise';
  src?: string; // 录音文件路径（public/sounds/xxx.mp3）；为空则纯合成
}

// 若 public/sounds/<id>.mp3 存在则用录音，否则用合成
// 文件命名约定：rain.mp3 / thunder.mp3 / ocean.mp3 / wind.mp3 / stream.mp3 / birds.mp3
// campfire.mp3 / cafe.mp3 / keyboard.mp3 / train.mp3
// 白/粉/褐噪音始终合成
const withSrc = (id: string): string | undefined => {
  // 简单约定：所有非 noise 类音轨都尝试加载同名 mp3
  // 文件不存在时 fetch 会 404，AudioEngine 会静默回退到合成
  return `/sounds/${id}.mp3`;
};

export const TRACKS: TrackDef[] = [
  // 自然
  { id: 'rain', name: '雨', nameEn: 'rain', icon: '🌧', kind: 'rain', category: 'nature', src: withSrc('rain') },
  { id: 'thunder', name: '雷', nameEn: 'thunder', icon: '⚡', kind: 'thunder', category: 'nature', src: withSrc('thunder') },
  { id: 'ocean', name: '海浪', nameEn: 'ocean', icon: '🌊', kind: 'ocean', category: 'nature', src: withSrc('ocean') },
  { id: 'wind', name: '风', nameEn: 'wind', icon: '🌬', kind: 'wind', category: 'nature', src: withSrc('wind') },
  { id: 'stream', name: '溪流', nameEn: 'stream', icon: '💧', kind: 'stream', category: 'nature', src: withSrc('stream') },
  { id: 'birds', name: '鸟鸣', nameEn: 'birds', icon: '🐦', kind: 'birds', category: 'nature', src: withSrc('birds') },
  // 火类
  { id: 'campfire', name: '篝火', nameEn: 'campfire', icon: '🔥', kind: 'campfire', category: 'fire', src: withSrc('campfire') },
  // 都市
  { id: 'cafe', name: '咖啡馆', nameEn: 'café', icon: '☕', kind: 'cafe', category: 'urban', src: withSrc('cafe') },
  { id: 'keyboard', name: '键盘', nameEn: 'keyboard', icon: '⌨', kind: 'keyboard', category: 'urban', src: withSrc('keyboard') },
  { id: 'train', name: '火车', nameEn: 'train', icon: '🚂', kind: 'train', category: 'urban', src: withSrc('train') },
  // 合成白噪音（无 src，始终合成）
  { id: 'white', name: '白噪音', nameEn: 'white', icon: '◻', kind: 'white', category: 'noise' },
  { id: 'pink', name: '粉噪音', nameEn: 'pink', icon: '◇', kind: 'pink', category: 'noise' },
  { id: 'brown', name: '褐噪音', nameEn: 'brown', icon: '◆', kind: 'brown', category: 'noise' },
];

export const CATEGORY_LABELS: Record<TrackDef['category'], string> = {
  nature: '自然',
  fire: '火',
  urban: '都市',
  noise: '白噪',
};
