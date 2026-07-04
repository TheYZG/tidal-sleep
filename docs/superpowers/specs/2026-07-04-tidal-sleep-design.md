# 潮汐眠境 · 睡前白噪音沉浸声景 — 设计文档 V3

> **一句话定义**：玻璃模糊的雨视频打底 + 多白噪音叠加播放 + 雨滴涟漪跟总音量实时联动的睡前沉浸声景。

---

## 0. 版本演进

V1（已废弃）：Three.js 3D 粒子场景，问题出在粒子形态难做好看 + 音频联动不直观。

V2（设计稿）：循环实拍视频打底 + Canvas 2D 叠加层做呼吸滤镜/光晕脉动。

V3（本设计）：在 V2 基础上调整方向——
1. 多音轨叠加播放（借鉴 Moodist），不只单场景雨声
2. 雨滴涟漪作为核心可视化（替代呼吸滤镜/光晕脉动）
3. 视频背景做玻璃模糊处理，雨滴像砸在玻璃上

---

## 1. 整体方案

### 1.1 三层架构

```
┌──────────────────────────────────────────────┐
│  <video> Rain Background.mp4 (铺满全屏)       │  视觉层
│  CSS filter: blur(4px) brightness(0.7)        │  微模糊+压暗
│  ──────────────────────────────────────────  │
│  <canvas> 涟漪层 (pointer-events:none)        │  可视化层
│  跟总音量联动，onset 触发涟漪                 │
│  ──────────────────────────────────────────  │
│  UI: 顶部菜单栏 + 底部音轨控件 + 计时器        │  UI 层
│  借鉴 Moodist 极简暗色风格，30秒无操作淡出     │
└──────────────────────────────────────────────┘
```

三层职责严格分离：
- **视觉层**：`<video loop autoplay muted playsinline>`，CSS 铺满全屏 + `filter: blur(4px) brightness(0.7) saturate(0.9)`，负责"画面好看但退到背景"
- **可视化层**：Canvas 2D 画涟漪，`position: fixed; pointer-events: none`，叠在视频上，负责"看得出声音在动"
- **UI 层**：React 渲染的控件，默认显示，30 秒无操作自动淡出，鼠标/触摸唤醒

### 1.2 音频数据流

```
[Howler.js 多轨] ──→ [Howler.Howl × 10 + 合成 × 3] ──→ Master Gain
                              │
                              ▼
                    [AnalyserNode] (Web Audio)
                              │
                  ┌───────────┴───────────┐
                  ▼                       ▼
          整体音量(RMS)            onset 峰值检测
                  │                       │
                  ▼                       ▼
          涟漪密度/亮度            触发一次涟漪扩散
```

关键点：AnalyserNode 接在 Master Gain 之后，捕获所有音轨混合后的总输出。不管开了哪几轨、各轨音量多少，涟漪响应的都是最终混音。

---

## 2. 技术栈

| 模块 | 选型 | 说明 |
|---|---|---|
| 前端框架 | React 18 + Vite | 组件化拆分，HMR 快 |
| 音频播放 | Howler.js | 多音轨管理（播放/暂停/音量/淡入淡出），跨浏览器稳，比原生 `<audio>` 省心 |
| 音频分析 | Web Audio API (AnalyserNode) | 接在 Howler 的 Master Gain 后，取 RMS 音量 + onset 峰值检测 |
| 可视化渲染 | Canvas 2D API | 只画涟漪同心圆，requestAnimationFrame 驱动 |
| 状态管理 | Zustand | 管理多音轨状态（id/音量/是否播放），避免 props drilling |
| 视频背景 | 原生 `<video>` + CSS filter | blur + brightness 做玻璃模糊 |
| 部署 | Vercel | 静态部署，满足初赛"可公开访问链接"要求 |

**不再需要**：Three.js、WebGL、GLSL shader、依赖注入框架、四层架构、Vitest/Playwright 测试体系。

---

## 3. 功能范围

### P0（必须做出来）

1. **玻璃模糊视频背景**：用户提供的 `Background/Rain Background.mp4`，`<video>` 铺满全屏 + `filter: blur(4px) brightness(0.7) saturate(0.9)`，视频本身静音（`muted`）
2. **多音轨白噪音播放**：10-15 个音轨，每个可独立开关 + 音量调节 + 多轨叠加
3. **雨滴涟漪可视化**：Canvas 涟漪跟所有音轨总音量联动，onset 触发涟漪扩散
4. **计时器**：15/30/60 分钟可选，到点淡出停止
5. **UI 控件**：顶部菜单栏 + 底部全部音轨控件（默认铺开，不折叠）
6. **UI 自动隐藏**：30 秒无操作淡出，鼠标/触摸唤醒
7. **部署上线**：Vercel 拿到公开链接

### P1（有余力再加）

8. 雷声/鸟鸣等场景专属音轨扩展
9. 真实天气联动（Open-Meteo 调整涟漪基准强度）
10. 同心圆波纹等附加可视化形态

### 明确不做

- 3D 渲染、粒子物理
- 声音日历
- 多语言
- 移动端专项适配（基础响应式即可）
- PWA/离线缓存
- 多场景切换（雨/篝火/海浪作为独立"场景"不做，但作为可叠加的音轨存在）

---

## 4. 音轨清单

10-15 个音轨，从 Freesound(CC0) / Pixabay 找。白噪音类用 Web Audio 合成（零版权风险 + 技术亮点）。

### 自然类（6 个，下载录音）
- 雨（rain）
- 雷（thunder）
- 海浪（ocean waves）
- 风（wind）
- 溪流（stream）
- 鸟鸣（birds）

### 火类（1 个，下载录音）
- 篝火（campfire）

### 都市类（3 个，下载录音）
- 咖啡馆（café）
- 键盘（keyboard）
- 火车（train）

### 合成白噪音类（3 个，Web Audio 合成）
- 白噪音（white noise）
- 粉噪音（pink noise）
- 褐噪音（brown noise）

**实现方式**：启动时用 Web Audio 生成 2 秒 AudioBuffer，用 BufferSourceNode 的 `loop: true` 循环播放。不实时逐样本生成（性能差且没必要，2 秒循环听不出接缝）。

**合计 13 个音轨**。

**素材合规**：
- 每个录音素材下载时截图保存授权说明页面到 `src/assets/sounds/LICENSES/`
- 优先选 CC0 / Pixabay License
- 作品帖列出所有素材来源链接
- 白噪音类用 Web Audio 合成，从根源规避风险

---

## 5. 核心模块设计

### 5.1 音轨状态管理（Zustand Store）

```typescript
interface TrackState {
  id: string;
  name: string;
  icon: string;
  volume: number;       // 0-1
  isPlaying: boolean;
  src?: string;         // 录音音轨的文件路径；合成音轨为 undefined
  type: 'recorded' | 'synthetic';
  syntheticKind?: 'white' | 'pink' | 'brown';  // 仅合成音轨
}

interface AudioStore {
  tracks: TrackState[];
  masterVolume: number;
  toggleTrack: (id: string) => void;   // 带 300ms 淡入淡出
  setTrackVolume: (id: string, vol: number) => void;
  setMasterVolume: (vol: number) => void;
  stopAll: () => void;                  // 计时器到点调用
}
```

### 5.2 音频引擎（AudioEngine 单例）

职责：管理所有 Howler 音轨 + Web Audio 分析节点。

```
AudioEngine
├── howls: Map<id, Howler.Howl>          // 录音音轨
├── syntheticNodes: Map<id, AudioNodes>  // 合成音轨（BufferSource + Filter + Gain）
├── masterGain: GainNode                 // Master 输出
├── analyser: AnalyserNode               // 接在 masterGain 之后
├── timeData: Uint8Array                 // analyser 时域数据
└── getLevel(): number                   // 返回当前 RMS 音量 0-1
    detectOnset(): boolean               // onset 峰值检测
```

**onset 检测算法**：
- 维护过去 1 秒的 RMS 均值 `avg`
- 当前帧 RMS `cur`
- 若 `cur > avg * 1.5 && cur > 0.05`，判定为 onset
- 防抖：每次触发后 80ms 内不再触发

### 5.3 涟漪渲染器（RippleRenderer）

```
RippleRenderer
├── canvas, ctx
├── ripples: Ripple[]                    // 当前活跃涟漪
├── spawn(x?, y?)                        // 触发一个涟漪，位置默认随机
├── update(dt)                           // 每帧更新所有涟漪
└── draw()                               // 重绘
```

**Ripple 结构**：
```typescript
interface Ripple {
  x: number;
  y: number;
  radius: number;        // 当前半径，0 → 80px
  maxRadius: number;     // 80px（初始值，需反复调）
  alpha: number;         // 0.6 → 0
  age: number;           // ms
  duration: number;      // 800ms（初始值，需反复调）
}
```

**渲染循环**：requestAnimationFrame，每帧：
1. 调用 `audioEngine.getLevel()` 取 RMS，根据音量动态调整涟漪最大半径/亮度
2. 调用 `audioEngine.detectOnset()`，若触发则 `rippleRenderer.spawn()`
3. 更新所有涟漪的 age/radius/alpha，淘汰 age > duration 的
4. 清屏 + 重绘

**涟漪上限**：同时存在的涟漪最多 20 个，超出淘汰最早的。

### 5.4 UI 组件树

```
<App>
  <VideoBackground />          // <video> + CSS filter
  <RippleCanvas />             // <canvas>，单例 RippleRenderer
  <TopBar>                     // 30s 淡出
    <MenuButton />
    <Title>潮汐眠境</Title>
    <Timer />                  // 15/30/60 分钟
  </TopBar>
  <BottomControls>             // 30s 淡出
    <TrackList>                // 默认全部铺开
      <TrackCard × 13>         // 图标+名称+滑块+开关
    </TrackList>
    <MasterVolumeSlider />
  </BottomControls>
</App>
```

**自动隐藏逻辑**：根组件用 `useIdle(30000)` hook，30 秒无 mousemove/touchstart 触发 `setUiVisible(false)`，UI 容器加 opacity 过渡。涟漪层和视频层不隐藏。

---

## 6. UI 布局

```
┌──────────────────────────────────────────────┐
│  ☰ 潮汐眠境                          ⏱ 30:00 │  ← 顶部栏
├──────────────────────────────────────────────┤
│                                              │
│                                              │
│         [玻璃模糊的雨视频背景 + 涟漪]         │
│                                              │
│                                              │
├──────────────────────────────────────────────┤
│  🌧雨 ▮▮▮▮▮▮▢▢▢▢  🔥篝火 ▮▮▢▢▢▢▢▢▢▢  🌊海浪... │  ← 底部音轨控件
│  🌬风 ▮▮▢▢▢▢▢▢▢▢  ⚡雷 ▮▢▢▢▢▢▢▢▢▢  ...        │  ← 全部铺开
│  🔊 总音量 ▮▮▮▮▮▮▢▢▢▢                        │
└──────────────────────────────────────────────┘
```

**视觉风格**（借鉴 Moodist）：
- 暗色背景（视频本身已压暗）
- 控件半透明深色玻璃质感（`backdrop-filter: blur(12px)` + `background: rgba(0,0,0,0.4)`）
- 文字白色/浅灰，强调色用低饱和蓝灰
- 滑块细线 + 圆点手柄
- 全局 `font-family` 走系统无衬线字体栈
- 所有过渡动画 300ms ease

**响应式**：
- 桌面：音轨卡片横向排列，自动换行
- 移动端：音轨卡片纵向列表（基础适配，不做专项优化）

---

## 7. 核心交互

| 操作 | 行为 |
|---|---|
| 点击音轨开关 | 该音轨 300ms 淡入开始播放 / 300ms 淡出停止 |
| 拖动音轨音量滑块 | 实时调整该轨音量，Master 不变 |
| 拖动 Master 音量 | 等比例调整所有音轨 |
| 多轨叠加 | 总音量自然增大，涟漪触发频率提高 |
| 计时器到点 | 所有音轨 1s 淡出停止 |
| 30 秒无操作 | 顶部栏 + 底部控件淡出 |
| 鼠标移动/触摸 | UI 淡入显示 |

---

## 8. 项目结构

```
e:\Code\White Noise\
├── Background\
│   └── Rain Background.mp4          # 用户提供
├── src\
│   ├── assets\
│   │   └── sounds\
│   │       ├── recorded\             # 下载的录音
│   │       │   ├── rain.mp3
│   │       │   ├── thunder.mp3
│   │       │   └── ...
│   │       └── LICENSES\             # 授权截图
│   ├── components\
│   │   ├── VideoBackground.tsx
│   │   ├── RippleCanvas.tsx
│   │   ├── TopBar.tsx
│   │   ├── Timer.tsx
│   │   ├── BottomControls.tsx
│   │   ├── TrackCard.tsx
│   │   └── MasterVolumeSlider.tsx
├── src\
│   ├── audio\
│   │   ├── AudioEngine.ts            # Howler + Web Audio 单例
│   │   ├── SyntheticNoise.ts         # 白/粉/褐噪音合成
│   │   └── OnsetDetector.ts          # onset 峰值检测
│   ├── render\
│   │   └── RippleRenderer.ts         # Canvas 涟漪渲染
│   ├── store\
│   │   └── audioStore.ts             # Zustand
│   ├── hooks\
│   │   └── useIdle.ts                # 30s 无操作检测
│   ├── data\
│   │   └── tracks.ts                 # 音轨清单定义
│   ├── App.tsx
│   ├── main.tsx
│   └── styles\
│       └── global.css
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 9. 调参清单（需要反复试）

以下参数是初始值，实施过程中需反复调试直到效果满意：

| 参数 | 初始值 | 调参方向 |
|---|---|---|
| 视频模糊半径 | `blur(4px)` | 太清晰抢戏→加大，太糊看不出雨→减小 |
| 视频亮度 | `brightness(0.7)` | 睡前太亮→压低，太暗压抑→调高 |
| 涟漪最大半径 | 80px | 太小看不出→加大，太大喧宾夺主→减小 |
| 涟漪持续时长 | 800ms | 太快闪退→加长，拖沓→缩短 |
| 涟漪初始透明度 | 0.6 | 太弱→加大，太强抢眼→减小 |
| 涟漪同时上限 | 20 个 | 太稀疏→加大，太密集→减小 |
| onset 阈值倍数 | 1.5 | 触发太频繁→加大，触发不出→减小 |
| onset 防抖 | 80ms | 涟漪连成串→加大 |
| onset 最小 RMS | 0.05 | 静音时误触发→加大 |
| UI 淡出时长 | 30s | 太快→加长，太慢→缩短 |
| 淡入淡出时长 | 300ms | 切换突兀→加长，拖沓→缩短 |

**调参优先级**：涟漪参数 > onset 参数 > 视频滤镜 > UI 时长。

---

## 10. 开发计划

1. **第 1 步**：搭项目骨架（Vite + React + TS），VideoBackground 跑通视频铺满 + 玻璃模糊
2. **第 2 步**：AudioEngine + Zustand store，单音轨（雨声）能播放/暂停/调音量
3. **第 3 步**：扩展到 13 音轨，下载录音素材 + 实现合成噪音
4. **第 4 步**：RippleCanvas + OnsetDetector，涟漪跟雨声联动
5. **第 5 步**：UI 组件（TopBar / BottomControls / Timer），30s 自动隐藏
6. **第 6 步**：反复调参（第 9 节清单）
7. **第 7 步**：部署 Vercel，整理 TRAE Session ID 和开发截图

---

## 11. 作品帖技术亮点

1. **多轨白噪音叠加架构**：Howler.js 管理多轨 + Web Audio AnalyserNode 接在 Master Gain 取总音量，任何组合都能正确联动
2. **雨滴涟漪跟总音量 onset 联动**：onset 检测算法（RMS 峰值 + 1 秒均值比较 + 防抖）的具体调参过程
3. **白噪音用 Web Audio 实时合成**：白/粉/褐噪音算法实现，零版权风险 + 技术亮点
4. **玻璃模糊视频背景 + 涟漪叠加**：视觉决策过程（为什么放弃 3D 粒子改用视频+Canvas）
