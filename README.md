# CaraneBlog

个人项目展示与软件下载站点，纯静态 HTML/CSS/JS 构建，托管于 GitHub Pages。

**在线访问**：<https://lylliu05.github.io/CaraneBlog/>

## 目录结构

```
├── index.html                # 网站入口页
├── apps.json                 # App 检查更新用（自动生成，勿手改）
├── css/style.css             # 样式
├── js/data.js                # 项目数据（自动生成，勿手改）
├── js/recommend-data.js      # 推荐应用数据（自动生成，勿手改）
├── js/main.js                # 卡片渲染逻辑
├── docs/                     # 项目文档（每个 md 一张卡片）
├── downloads/                # 安装包（与文档同名配对）
├── recommend/                # 「推荐应用」版块（独立于项目模块）
│   ├── apps/                 #   推荐应用的安装包
│   └── docs/                 #   推荐应用的文档（与安装包同名配对）
├── scripts/generate-data.cjs # 网页数据扫描脚本（Actions 自动运行）
├── scripts/generate-recommend.cjs # 推荐应用扫描脚本，生成 js/recommend-data.js
├── scripts/generate-apps-json.cjs # APK 解析脚本，生成 apps.json（Actions 自动运行）
├── scripts/lib.cjs           # 两个扫描脚本共用的配对/解析逻辑
├── scripts/meta.json         # 可选：覆盖项目的图标/描述等元数据
├── scripts/recommend-meta.json # 可选：覆盖推荐应用的图标/描述/外链等元数据
├── scripts/update-config.json # 可选：各 App 的更新日志/强制更新配置
└── .github/workflows/        # push 时自动重新生成 data.js / recommend-data.js / apps.json 并部署
```

## 如何新增一个展示项目（全自动）

1. 安装包放入 `downloads/`（文件名建议带版本号，如 `MyAppv1.2.0.apk`）；
2. 项目文档放入 `docs/`，文件名与安装包对应（如 `MyApp.md` ↔ `MyAppv1.2.0.apk`，按前缀配对）；
3. `git push` 即可——GitHub Actions 自动扫描两个文件夹、重新生成项目列表并更新网页。

可选：编辑 [scripts/meta.json](scripts/meta.json) 自定义图标、标语、标签等；没有配对文档的文件也会自动生成独立下载卡片。

## 如何新增一个推荐应用（全自动）

1. 安装包放入 `recommend/apps/`，介绍文档放入 `recommend/docs/`（同名配对，规则与项目模块一致）；
2. `git push` 即可自动出现在网页「推荐应用」版块。

也支持只放文档、不放安装包：在 [scripts/recommend-meta.json](scripts/recommend-meta.json) 中为该文档的 key 配置 `link`（外部下载/官网地址），卡片会显示「前往下载」按钮：

```json
{
  "SomeApp": {
    "name": "SomeApp 显示名",
    "icon": "⭐",
    "tagline": "一句话推荐语",
    "tags": ["标签1", "标签2"],
    "link": "https://example.com/download"
  }
}
```

详见 [recommend/README.md](recommend/README.md)。注意：`recommend/` 中的 APK 不会进入 apps.json 更新检查接口（该接口只服务 `downloads/` 下的自有应用）。

## App 内检查更新（全自动）

所有 APK 的版本信息自动汇总到 [apps.json](apps.json)（以**包名**为 key），App 端请求该文件对比 versionCode 即可提示更新：

- **更新地址**：`https://lylliu05.github.io/CaraneBlog/apps.json`
- 新版 APK 放入 `downloads/` 并 push 后，Actions 自动解析每个 APK 的包名 / versionCode / versionName / 大小并重新生成 `apps.json`（约 1-2 分钟后生效）
- 同一包名存在多个 APK 时，自动取 versionCode 最大的那个；旧版本 APK 可留在仓库里继续供网页下载

可选：在 [scripts/update-config.json](scripts/update-config.json) 中为某个 App 配置更新日志、强制更新、最低支持版本（低于该 versionCode 强制更新）：

```json
{
  "baseUrl": "https://lylliu05.github.io/CaraneBlog",
  "apps": {
    "com.anoneapk.timer": {
      "updateLog": "1. 修复若干问题\n2. 新增 XX 功能",
      "forceUpdate": false,
      "minSupportVersion": 3
    }
  }
}
```
