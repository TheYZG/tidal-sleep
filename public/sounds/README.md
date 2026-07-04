# 录音素材目录

把下载的白噪音录音文件放到这里，**文件名必须和音轨 id 一致**：

```
public/sounds/
├── rain.mp3
├── thunder.mp3
├── ocean.mp3
├── wind.mp3
├── stream.mp3
├── birds.mp3
├── campfire.mp3
├── cafe.mp3
├── keyboard.mp3
└── train.mp3
```

## 行为说明

- 文件**存在**：播放录音（更真实）
- 文件**不存在**：自动回退到 Web Audio 合成（始终有声）
- 白/粉/褐噪音始终用合成，不需要文件

## 素材来源（按推荐顺序）

1. **Freesound.org**（注册账号，搜索时左侧筛选 License = CC0）
   - `rain ambient` / `thunder roll` / `wind howling` / `campfire` / `cafe ambience` / `keyboard typing`
2. **Pixabay Audio**（不用注册，https://pixabay.com/sound-effects/）
   - `ocean waves` / `birds morning` / `train interior`

## 下载后处理

用 ffmpeg 裁 10-20 秒稳定段循环：

```bash
ffmpeg -i input.mp3 -ss 00:00:05 -t 15 -c:a libmp3lame -b:a 128k output.mp3
```

## 合规留证

每个素材下载时**截图保存授权说明页面**到 `public/sounds/LICENSES/`，作品帖列出所有来源链接。
