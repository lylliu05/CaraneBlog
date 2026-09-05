/**
 * 文档 + 安装包 扫描逻辑，供两个数据生成脚本共用：
 *   - scripts/generate-data.cjs      （项目模块：docs/ + downloads/ → js/data.js）
 *   - scripts/generate-recommend.cjs （推荐应用模块：recommend/docs/ + recommend/apps/ → js/recommend-data.js）
 *
 * 配对规则（两个模块一致）：
 *   1. docs/*.md 每个文件生成一张卡片（key = 文件名去扩展名）
 *   2. apps 目录中文件名以 key 开头的均为该项目的安装包，自动取版本号最大的作为下载文件
 *   3. 未配对的安装包文件，生成独立的下载卡片
 *   4. meta 文件可按 key 覆盖 name/icon/version/description/link 等字段（可选）
 *
 * 仅依赖 Node.js 内置模块（fs/path），无需安装任何包。
 */
const fs = require("fs");
const path = require("path");

function listDir(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith(".") && (ext ? f.endsWith(ext) : true))
    .sort();
}

function humanSize(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(bytes / 1048576 >= 10 ? 0 : 1) + " MB";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
  return bytes + " B";
}

function guessPlatform(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".apk") return "Android";
  if (ext === ".exe" || ext === ".msi") return "Windows";
  if (ext === ".dmg") return "macOS";
  if (ext === ".zip" || ext === ".7z" || ext === ".rar") return "跨平台";
  return "";
}

/** 判断下载文件是否属于 key 项目：key 后必须紧跟结尾、版本号或分隔符，
 *  避免 "Carane" 误配 "CaranePlanv0.1.1.apk" 这类前缀包含关系 */
function isPairOf(key, file) {
  const base = path.basename(file, path.extname(file));
  const re = new RegExp(
    "^" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=$|v?\\d|[._\\- ])",
    "i"
  );
  return re.test(base);
}

/** 从文件名提取版本号，如 "Caranev1.0.0.apk" → "v1.0.0"；没有则返回 "" */
function guessVersion(fileName) {
  const m = path.basename(fileName, path.extname(fileName)).match(/v?\d+\.\d+(\.\d+)*/i);
  return m ? (m[0].toLowerCase().startsWith("v") ? m[0].toLowerCase() : "v" + m[0]) : "";
}

/** 比较版本号：a > b 返回 1，a < b 返回 -1，相等返回 0 */
function compareVersions(a, b) {
  const pa = String(a || "0").replace(/^v/i, "").split(".").map(Number);
  const pb = String(b || "0").replace(/^v/i, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/** 从 markdown 提取第一个 "# 标题" 与第一段正文，作为默认 name/description */
function parseMarkdown(file) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  let name = "";
  let description = "";
  let collecting = false;
  let descLines = [];
  for (const line of lines) {
    if (!name && /^#\s+/.test(line)) {
      name = line.replace(/^#\s+/, "").trim();
      collecting = true;
      continue;
    }
    if (collecting) {
      if (line.trim() === "") {
        if (descLines.length) break;
        continue;
      }
      if (/^#{1,6}\s/.test(line) || line.trim().startsWith(">")) continue;
      descLines.push(line.trim());
    }
  }
  description = descLines.join(" ");
  return { name, description };
}

/**
 * 扫描文档与安装包目录，生成卡片数据数组。
 * @param {object} opts
 *   docsDir      文档目录（每个 *.md 一张卡片）
 *   appsDir      安装包目录（文件名以文档 key 开头的自动配对）
 *   metaFile       元数据覆盖文件（可选，不存在时忽略）
 *   defaultIcon    卡片默认图标
 *   appsUrlPrefix  安装包下载链接前缀，如 "downloads/"
 *   docsUrlPrefix  文档链接前缀，如 "docs/"
 * @returns {Array} 卡片数据
 */
function scanProjects(opts) {
  const meta = fs.existsSync(opts.metaFile) ? JSON.parse(fs.readFileSync(opts.metaFile, "utf8")) : {};
  const docs = listDir(opts.docsDir, ".md");
  const downloads = listDir(opts.appsDir);
  const used = new Set();
  const projects = [];

  // 1) 文档卡片
  for (const doc of docs) {
    const key = path.basename(doc, ".md");
    const parsed = parseMarkdown(path.join(opts.docsDir, doc));

    // 在安装包目录中找配对文件：文件名以 key 开头且 key 后紧跟边界
    // 多版本时全部配对（旧版本不再单独出卡片），取版本号最大的作为下载文件
    const candidates = downloads.filter((f) => !used.has(f) && isPairOf(key, f));
    let dlFile = null;
    if (candidates.length) {
      candidates.forEach((f) => used.add(f));
      dlFile = candidates
        .slice()
        .sort((a, b) => compareVersions(guessVersion(a), guessVersion(b)))
        .pop();
    }

    const m = meta[key] || meta[key.toLowerCase()] || {};
    const entry = {
      id: key,
      name: m.name || parsed.name || key,
      icon: m.icon || opts.defaultIcon,
      version: m.version || (dlFile ? guessVersion(dlFile) : ""),
      platform: m.platform || (dlFile ? guessPlatform(dlFile) : ""),
      tagline: m.tagline || "",
      description: m.description || parsed.description || "",
      tags: m.tags || [],
      fileSize: dlFile ? humanSize(fs.statSync(path.join(opts.appsDir, dlFile)).size) : "",
      updateDate: m.updateDate || "",
      downloadUrl: dlFile ? opts.appsUrlPrefix + encodeURIComponent(dlFile) : "",
      docUrl: opts.docsUrlPrefix + encodeURIComponent(doc),
      link: m.link || "",
    };
    projects.push(entry);
  }

  // 2) 未配对的安装包文件 → 独立下载卡片（自动从文件名提取名称与版本号）
  for (const f of downloads) {
    if (used.has(f)) continue;
    const key = path.basename(f, path.extname(f));
    const version = guessVersion(f);
    const nameGuess = version ? key.slice(0, key.toLowerCase().lastIndexOf(version.toLowerCase())) : key;
    const m = meta[key] || {};
    projects.push({
      id: key,
      name: m.name || nameGuess || key,
      icon: m.icon || opts.defaultIcon,
      version: m.version || version,
      platform: m.platform || guessPlatform(f),
      tagline: m.tagline || "",
      description: m.description || "",
      tags: m.tags || [],
      fileSize: humanSize(fs.statSync(path.join(opts.appsDir, f)).size),
      updateDate: m.updateDate || "",
      downloadUrl: opts.appsUrlPrefix + encodeURIComponent(f),
      docUrl: "",
      link: m.link || "",
    });
  }

  return projects;
}

module.exports = { scanProjects, listDir, humanSize, guessPlatform, guessVersion, compareVersions, parseMarkdown };
