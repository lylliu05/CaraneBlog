# 卡烷 Carane

一个基于 Android 原生开发的多格式视频播放器。

## 功能特性

- **多格式播放**：支持 HLS (m3u8)、DASH (mpd)、SmoothStreaming (ism)、RTSP、MP4、MKV、WEBM、FLV、TS、AVI、MOV 等多种视频格式，按地址自动识别
- **本地视频浏览**：扫描系统所有视频并以缩略图网格预览，作为应用默认主页
- **网络 URL 播放**：右上角加号弹窗输入视频地址，自动识别直播流
- **系统打开方式**：在文件管理器、浏览器、聊天软件等任意场景中点击视频链接或文件，可选用"卡烷"直接打开并播放，支持 mp4 / mkv / flv / avi / mov / webm / ts / 3gp / m3u8 / mpd / ism 等多种格式
- **播放历史**：自动记录播放进度，支持断点续播
- **倍速播放**：0.5x / 0.75x / 1.0x / 1.25x / 1.5x / 2.0x / 3.0x
- **手势控制**：单击显隐控制条（10s 自动隐藏）、双击暂停、长按右半屏倍速快进（默认5x可设置2~10x，静音）、长按左半屏持续快退
- **亮度/音量手势**：左侧上滑/下滑调节屏幕亮度，右侧上滑/下滑调节媒体音量
- **屏幕常亮**：播放时保持屏幕常亮，暂停时取消
- **屏幕锁定**：左侧锁按钮可锁定屏幕，锁定后除返回手势外所有动作失效
- **横屏适配**：进入播放器自动跟随设备旋转，右上角按钮可锁定横屏，离开播放器自动恢复
- **画中画 (PiP)**：切到其他应用时继续观看
- **边播放边下载**：播放页一键下载当前视频，支持 HLS / DASH / SmoothStreaming / 渐进式格式，独立下载列表页管理任务，下载完成后可离线播放
- **深色 / 浅色主题**：跟随系统
- **Splash 启动屏**：Android 12+ 原生 SplashScreen API

## 支持的视频格式

应用通过 `MediaSourceFactory` 根据 URL 协议与扩展名自动选择合适的 ExoPlayer MediaSource：

| 格式类型 | 扩展名 / 协议 | 说明 |
|---------|---------------|------|
| HLS | `.m3u8` / `.m3u` | 自适应流媒体，支持直播与点播 |
| DASH | `.mpd` | MPEG-DASH 自适应流媒体 |
| SmoothStreaming | `.ism` / `.isml` | Silverlight Smooth Streaming |
| RTSP | `rtsp://` / `rtsps://` | 实时流传输协议，常用于摄像头/IPC |
| 渐进式下载 | `.mp4` / `.m4v` / `.mkv` / `.webm` / `.flv` / `.ts` / `.avi` / `.mov` / `.3gp` / `.ogv` 等 | 通过 `DefaultMediaSourceFactory` + FLV/Matroska 抽取器播放 |
| 本地文件 | `content://` / `file://` | 系统分享或文件管理器打开 |

## 技术栈

| 组件 | 版本 / 说明 |
|------|-------------|
| 语言 | Kotlin 1.9.20 |
| 构建 | Gradle 8.5（使用本地全局 Gradle） |
| JDK | 17（编译兼容），运行环境 JDK 21 |
| UI | Jetpack Compose + Material3 |
| 播放器 | androidx.media3 (ExoPlayer) 1.2.1 + HLS / DASH / SmoothStreaming / RTSP / FLV / Matroska |
| 数据库 | Room 2.6.1 + KSP |
| 导航 | Navigation Compose 2.7.7 |
| 最低 Android | 8.0 (API 26) |
| 目标 Android | 14 (API 34) |

## 项目结构

```
app/src/main/java/com/carane/app/
├── CaraneApp.kt              应用入口，初始化数据库与仓库，注册 Coil VideoFrameDecoder
├── MainActivity.kt           唯一 Activity，承载 Compose 与 PiP
├── data/                      数据层
│   ├── db/                    Room 实体、DAO、数据库（历史表 + 下载元数据表）
│   └── repository/            仓库封装（HistoryRepository / SettingsRepository / DownloadRepository）
├── player/                    播放器层
│   ├── PlayerManager.kt       ExoPlayer 封装
│   ├── MediaSourceFactory.kt  多格式媒体源工厂（HLS/DASH/SS/RTSP/渐进式），链式包装下载缓存与播放缓存
│   ├── PlaybackController.kt  串联播放器与历史仓库
│   ├── ExternalVideoHandler.kt 系统打开方式 Intent 解析与标题提取
│   ├── VideoScanner.kt        本地视频 MediaStore 扫描器
│   ├── LocalVideoItem.kt      本地视频数据模型
│   ├── UrlVerifier.kt         地址探测与视频信息提取
│   └── DownloadManagerProvider.kt 下载管理器单例（独立 SimpleCache + DownloadManager）
├── download/                  下载层
│   └── CaraneDownloadService.kt 下载前台服务（通知 + 后台下载 + 重启恢复）
└── ui/
    ├── theme/                主题、颜色、字体
    ├── components/            通用组件（AddVideoSheet 等）
    ├── navigation/            导航路由
    ├── viewmodel/             PiP 状态持有者
    └── screens/               各功能页面
        ├── main/              主界面（底部导航容器：本地视频/历史/下载/设置）
        ├── local/             本地视频预览页（缩略图网格）
        ├── history/           播放历史
        ├── download/          下载列表页（进度展示 + 暂停/恢复/删除/离线播放）
        ├── player/            播放器界面（含手势/控制条/下载按钮）
        ├── verify/            地址验证页
        └── settings/          设置
```

## 构建方法

### 前置条件

- Android SDK（Android Studio 自带或独立安装）
- JDK 17 或更高（推荐 JDK 21）
- Gradle 8.5（建议使用系统全局 Gradle）

### 命令行构建

```bash
# Debug 版本（用于开发调试）
gradle :app:assembleDebug
# 输出：app/build/outputs/apk/debug/app-debug.apk

# Release 发行版（已配置正式签名）
gradle :app:assembleRelease
# 输出：app/build/outputs/apk/release/app-release.apk
```

### 签名配置（仅 Release）

项目使用正式 keystore 签名，凭据保存在两个本地文件中（已在 `.gitignore` 中忽略）：

- `keystore/carane.jks` — PKCS12 格式 keystore，25 年有效期，RSA 2048 位
- `keystore.properties` — keystore 凭据（storePassword/keyAlias/keyPassword）

如需重新生成 keystore（例如证书过期、需要更换密钥）：

```bash
keytool -genkeypair -v \
  -keystore keystore/carane.jks \
  -storetype PKCS12 \
  -keyalg RSA -keysize 2048 \
  -validity 9125 \
  -alias carane \
  -storepass <你的密码> \
  -keypass <你的密码> \
  -dname "CN=Carane, OU=App, O=Carane, L=Beijing, ST=Beijing, C=CN"
```

并将密码写入 `keystore.properties`：

```properties
storeFile=keystore/carane.jks
storePassword=<你的密码>
keyAlias=carane
keyPassword=<你的密码>
```

验证签名：

```bash
apksigner verify --verbose --print-certs app/build/outputs/apk/release/app-release.apk
```


### 在 Android Studio 中打开

1. File → Open 选择 `d:\Desktop\Carane` 目录
2. 等待 Gradle Sync 完成（Studio 会自动创建 `local.properties` 指向 SDK 路径）
3. 点击 Run 按钮

## 使用说明

### 浏览本地视频（默认主页）

1. 打开应用，默认进入"本地视频" Tab
2. 首次进入会显示"点击授权扫描本地视频"按钮，点击后请求权限（Android 13+ 为 `READ_MEDIA_VIDEO`，更低版本为 `READ_EXTERNAL_STORAGE`）
3. 授权后自动扫描系统中所有视频，按添加时间倒序以缩略图网格展示
4. 点击任一条目进入地址验证页，确认后即可播放
5. 顶栏右上角刷新按钮可重新扫描

### 通过加号弹窗播放网络地址

1. 任意 Tab 顶栏右上角的 + 按钮可弹出 BottomSheet
2. 输入视频地址（m3u8 / mpd / ism / mp4 / mkv / flv / rtsp 等）
3. 直播流由应用按 URL 自动识别，无需手动开关
4. 点击"播放"进入验证页，验证通过后即可播放

### 通过系统打开方式播放

在文件管理器、浏览器、聊天软件等任意场景中点击视频文件或链接，系统会弹出"打开方式"列表，选择"卡烷"即可：

1. 文件管理器中点击 mp4 / mkv / flv / avi / mov / webm / ts / 3gp 等视频文件
2. 浏览器中点击 m3u8 / mpd / ism 等流媒体链接
3. 聊天软件中接收到的视频文件，通过"分享"选择"卡烷"

应用会自动跳转到地址验证页面，验证通过后即可播放。

> 首次使用时，可在系统"打开方式"对话框勾选"始终"以将卡烷设为默认视频播放器。

### 倍速播放

进入播放界面后，点击底部的倍速图标，选择对应速度。

### 画中画

播放中按 Home 键（或切到其他应用）会自动进入 PiP 模式（需系统支持）。

### 快进 / 快退

- **长按右半屏**：倍速快进（默认 5x，可在「设置 → 长按快进倍速」中调整 2~10x），快进期间自动静音，松手恢复原速
- **长按左半屏**：持续快退（每 100ms 回退 1 秒），松手停止
- **双击**：切换播放/暂停
- **单击**：显隐控制条（10s 后自动隐藏）
- **左侧锁按钮**：锁定屏幕，锁定后除返回手势外所有动作失效

### 亮度 / 音量手势

- **左侧上滑/下滑**：调节屏幕亮度（上滑变亮，下滑变暗），滑动时屏幕中央显示亮度指示器
- **右侧上滑/下滑**：调节媒体音量（上滑变大，下滑变小），滑动时屏幕中央显示音量指示器
- 播放时屏幕保持常亮，暂停时自动取消常亮
- 锁定状态下所有手势失效（返回手势除外）

### 边播放边下载

支持在播放视频时同步下载到本地，下载完成后可离线播放。

- **下载入口**：播放页右上角下载按钮（已下载显示为完成图标），或底部导航「下载」Tab 进入下载列表页
- **支持格式**：HLS (m3u8) / DASH (mpd) / SmoothStreaming (ism) / 渐进式 (mp4 / mkv / webm / flv 等)
- **下载列表**：底部导航「下载」Tab 查看所有下载任务
  - 下载中：显示进度百分比与进度条，可暂停/恢复
  - 已完成：点击播放按钮直接离线播放，可删除
  - 失败：可恢复重试
- **后台下载**：应用切到后台后下载服务以前台服务形式继续运行，通知栏显示进度
- **存储位置**：应用私有缓存目录 `cacheDir/carane_downloads`，卸载应用时自动清除

## 备注

- 本应用使用 `usesCleartextTraffic="true"`，允许 HTTP 明文传输，便于测试内网或非加密直播源
- 进度、断点续播通过 Room 数据库本地存储，不上传任何服务器
- 历史记录最多保留 100 条
