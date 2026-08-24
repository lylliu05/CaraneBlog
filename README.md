# CaraneBlog

个人项目展示与软件下载站点，纯静态 HTML/CSS/JS 构建，托管于 GitHub Pages。

**在线访问**：<https://lylliu05.github.io/CaraneBlog/>

## 项目列表

| 项目 | 平台 | 版本 | 说明 | 下载 |
| --- | --- | --- | --- | --- |
| [卡烷 Carane](docs/Carane.md) | Android | v1.0.0 | 多格式视频播放器（HLS/DASH/RTSP/本地） | [APK 3.6MB](downloads/Caranev1.0.0.apk) |
| [Kairos](docs/kairos.md) | Android | v4.9.0 | 纯原生计时与任务管理应用（Jetpack Compose + Kotlin） | [APK 17MB](downloads/kairosv4.9.0.apk) |
| [Tempo](docs/Tempo.md) | Android | - | 输入驱动的黄历（天时+地利+人事） | [APK 10.3MB](downloads/Tempo.apk) |

## 目录结构

```
├── index.html                # 网站入口页
├── css/style.css             # 样式
├── js/data.js                # 项目数据（自动生成，勿手改）
├── js/main.js                # 卡片渲染逻辑
├── docs/                     # 项目文档（每个 md 一张卡片）
├── downloads/                # 安装包（与文档同名配对）
├── scripts/generate-data.cjs # 扫描脚本（Actions 自动运行）
├── scripts/meta.json         # 可选：覆盖项目的图标/描述等元数据
└── .github/workflows/        # push 时自动重新生成 data.js 并部署
```

## 如何新增一个展示项目（全自动）

1. 安装包放入 `downloads/`（文件名建议带版本号，如 `MyAppv1.2.0.apk`）；
2. 项目文档放入 `docs/`，文件名与安装包对应（如 `MyApp.md` ↔ `MyAppv1.2.0.apk`，按前缀配对）；
3. `git push` 即可——GitHub Actions 自动扫描两个文件夹、重新生成项目列表并更新网页。

可选：编辑 [scripts/meta.json](scripts/meta.json) 自定义图标、标语、标签等；没有配对文档的文件也会自动生成独立下载卡片。

## 本地预览

无需构建，直接用浏览器打开 `index.html` 即可。

## 启用 GitHub Pages

仓库 **Settings → Pages → Branch** 选择 `main`、目录选 `/ (root)`，保存后约 1 分钟生效。
