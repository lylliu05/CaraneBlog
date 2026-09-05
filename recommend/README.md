# 推荐应用（recommend/）

网页「推荐应用」版块的数据来源，与「项目」模块（docs/ + downloads/）完全独立，互不影响。

## 目录说明

```
recommend/
├── apps/    # 推荐应用的安装包（apk/exe/dmg/zip 等）
├── docs/    # 每个推荐应用的介绍文档（*.md，一文件一卡片）
└── README.md
```

## 如何新增一个推荐应用

1. 安装包放入 `recommend/apps/`（文件名建议带版本号，如 `SomeAppv1.2.0.apk`）；
2. 介绍文档放入 `recommend/docs/`，文件名与安装包对应（如 `SomeApp.md` ↔ `SomeAppv1.2.0.apk`，按前缀配对，规则与主模块一致）；
3. `git push` 即可——GitHub Actions 自动扫描并更新网页「推荐应用」版块。

也支持**只放文档、不放安装包**（适合推荐外部应用）：在 `scripts/recommend-meta.json` 中为该文档的 key 配置 `link`，卡片上会出现「前往下载」按钮跳转外部地址：

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

## 说明

- 图标默认 ⭐，可在 recommend-meta.json 中按 key 覆盖（name/icon/version/description/tags/updateDate/link 等）；
- 此目录中的 APK **不会**进入 apps.json 更新检查接口（该接口只服务 downloads/ 下的自有应用）；
- 数据由 `scripts/generate-recommend.cjs` 生成到 `js/recommend-data.js`（自动生成，勿手改）。
