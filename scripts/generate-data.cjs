/**
 * 自动扫描 docs/ 与 downloads/ 文件夹，生成 js/data.js（网页「项目」模块数据）。
 * 扫描与配对规则见 scripts/lib.cjs。
 *
 * 由 GitHub Actions 在每次 push 时自动运行，也可本地手动执行：node scripts/generate-data.cjs
 */
const fs = require("fs");
const path = require("path");
const { scanProjects } = require("./lib.cjs");

const ROOT = path.resolve(__dirname, "..");
const OUT_FILE = path.join(ROOT, "js", "data.js");

const projects = scanProjects({
  docsDir: path.join(ROOT, "docs"),
  appsDir: path.join(ROOT, "downloads"),
  metaFile: path.join(__dirname, "meta.json"),
  defaultIcon: "📦",
  appsUrlPrefix: "downloads/",
  docsUrlPrefix: "docs/",
});

const banner =
  "/**\n" +
  " * 本文件由 scripts/generate-data.cjs 自动生成（GitHub Actions 每次 push 自动更新），请勿手动编辑。\n" +
  " * 新增项目：安装包放入 downloads/、文档放入 docs/（同名配对），push 即自动出现在网页上。\n" +
  " * 元数据（标题/图标/描述等）可在 scripts/meta.json 中覆盖。\n" +
  " */\n";

const content = banner + "const PROJECTS = " + JSON.stringify(projects, null, 2) + ";\n";
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, content, "utf8");
console.log("generated js/data.js with " + projects.length + " project(s)");
