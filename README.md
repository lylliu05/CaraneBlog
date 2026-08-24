# CaraneBlog

个人项目展示与软件下载站点，纯静态 HTML/CSS/JS 构建，托管于 GitHub Pages。

**在线访问**：<https://lylliu05.github.io/CaraneBlog/>

## 项目列表

| 项目 | 平台 | 版本 | 说明 | 下载 |
| --- | --- | --- | --- | --- |
| [Kairos](docs/kairos.md) | Android | v4.9.0 | 纯原生计时与任务管理应用（Jetpack Compose + Kotlin） | [APK 17MB](downloads/app-release.apk) |

## 目录结构

```
├── index.html            # 网站入口页
├── css/style.css         # 样式
├── js/data.js            # 项目数据配置（新增项目在这里加）
├── js/main.js            # 卡片渲染逻辑
├── downloads/            # 存放安装包等下载文件
└── docs/                 # 项目详细文档
    └── kairos.md         # Kairos 使用与开发文档
```

## 如何新增一个展示项目

1. 把安装包放入 `downloads/` 目录；
2. 打开 [js/data.js](js/data.js)，在 `PROJECTS` 数组中照现有格式添加一项（图标、描述、版本、下载路径等）；
3. 提交并推送，GitHub Pages 会自动更新。

## 本地预览

无需构建，直接用浏览器打开 `index.html` 即可。

## 启用 GitHub Pages

仓库 **Settings → Pages → Branch** 选择 `main`、目录选 `/ (root)`，保存后约 1 分钟生效。
