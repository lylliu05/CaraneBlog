/**
 * 自动扫描 recommend/docs/ 与 recommend/apps/ 文件夹，
 * 生成 js/recommend-data.js（网页「推荐应用」模块数据）。
 * 扫描与配对规则与「项目」模块一致，见 scripts/lib.cjs：
 *   1. recommend/docs/*.md 每个文件生成一张推荐卡片（key = 文件名去扩展名）
 *   2. recommend/apps/ 中文件名以 key 开头的自动配对为该应用的安装包，取版本号最大的作为下载文件
 *   3. 未配对的安装包文件，生成独立的下载卡片
 *   4. scripts/recommend-meta.json 可按 key 覆盖 name/icon/version/description/link 等字段（可选）
 *      其中 link 为外部下载/官网地址：配置后卡片显示「前往下载」按钮；
 *      没有本地安装包的推荐应用（仅文档 + 外链）也可用。
 *
 * 由 GitHub Actions 在每次 push 时自动运行，也可本地手动执行：node scripts/generate-recommend.cjs
 */
const fs = require("fs");
const path = require("path");
const { scanProjects } = require("./lib.cjs");

const ROOT = path.resolve(__dirname, "..");
const OUT_FILE = path.join(ROOT, "js", "recommend-data.js");

const projects = scanProjects({
  docsDir: path.join(ROOT, "recommend", "docs"),
  appsDir: path.join(ROOT, "recommend", "apps"),
  metaFile: path.join(__dirname, "recommend-meta.json"),
  defaultIcon: "⭐",
  appsUrlPrefix: "recommend/apps/",
  docsUrlPrefix: "recommend/docs/",
});

const banner =
  "/**\n" +
  " * 本文件由 scripts/generate-recommend.cjs 自动生成（GitHub Actions 每次 push 自动更新），请勿手动编辑。\n" +
  " * 新增推荐应用：安装包放入 recommend/apps/、文档放入 recommend/docs/（同名配对），push 即自动出现在网页上。\n" +
  " * 元数据（标题/图标/描述/外部链接等）可在 scripts/recommend-meta.json 中覆盖。\n" +
  " */\n";

const content = banner + "const RECOMMENDED = " + JSON.stringify(projects, null, 2) + ";\n";
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, content, "utf8");
console.log("generated js/recommend-data.js with " + projects.length + " recommended app(s)");
