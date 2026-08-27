#!/usr/bin/env node
/**
 * 扫描 downloads/*.apk，自动解析每个安装包的
 *   包名（package）/ versionCode / versionName / 文件大小，
 * 并结合 scripts/update-config.json 中的可选配置（更新日志、强制更新等），
 * 生成根目录 apps.json —— 供所有 App 内「检查更新」使用。
 *
 * 规则：
 *   1. apps.json 以「包名」为 key，与 App 的 packageName 一一对应
 *   2. 同一包名存在多个 APK 时，自动取 versionCode 最大的那个
 *   3. 解析失败时用文件名中的版本号兜底；versionCode 等字段可在 update-config.json 强制覆盖
 *
 * 由 GitHub Actions 在每次 push 时自动运行；本地手动执行：
 *   node scripts/generate-apps-json.cjs
 *
 * 仅依赖 Node.js 内置模块（fs/path/zlib），无需安装任何包。
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DL_DIR = path.join(ROOT, "downloads");
const CONFIG_FILE = path.join(__dirname, "update-config.json");
const OUT_FILE = path.join(ROOT, "apps.json");

const U32_MAX = 0xffffffff;

// ---------- 通用工具 ----------

function humanSize(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(bytes / 1048576 >= 10 ? 0 : 1) + " MB";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
  return bytes + " B";
}

/** 从文件名提取版本号（兜底用），如 "kairosv4.9.0.apk" → "4.9.0" */
function versionFromName(fileName) {
  const m = path.basename(fileName, path.extname(fileName)).match(/v?(\d+\.\d+(\.\d+)*)/i);
  return m ? m[1] : "";
}

/** 比较版本号：a > b 返回 1，a < b 返回 -1，相等返回 0 */
function compareVersions(a, b) {
  const pa = String(a || "0").split(".").map(Number);
  const pb = String(b || "0").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/** info 是否比 prev 新（versionCode 优先，其次 versionName，最后文件名） */
function isNewer(info, prev) {
  const a = info.versionCode == null ? -1 : info.versionCode;
  const b = prev.versionCode == null ? -1 : prev.versionCode;
  if (a !== b) return a > b;
  const v = compareVersions(info.versionName, prev.versionName);
  if (v !== 0) return v > 0;
  return info.file > prev.file;
}

/** 从 git remote 推断 GitHub Pages 地址（update-config.json 未配置 baseUrl 时使用） */
function detectBaseUrl() {
  try {
    const remote = execSync("git config --get remote.origin.url", {
      cwd: ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    }).toString().trim();
    const m = remote.match(/github\.com[\/:]([^\/]+)\/([^\/]+?)(?:\.git)?$/i);
    if (m) return `https://${m[1].toLowerCase()}.github.io/${m[2]}`;
  } catch (_) {
    /* 无 git 或无 remote 时忽略 */
  }
  return "";
}

// ---------- ZIP 解析（用于提取 AndroidManifest.xml，零依赖） ----------

/** 定位 End of Central Directory 记录 */
function findEocd(buf) {
  const min = Math.max(0, buf.length - 65557); // EOCD 22 字节 + 注释最长 65535
  let lenient = -1;
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) !== 0x06054b50) continue;
    if (i + 22 + buf.readUInt16LE(i + 20) === buf.length) return i; // 注释长度吻合，精确命中
    if (lenient < 0) lenient = i;
  }
  return lenient;
}

/** 读取 ZIP 中央目录，返回全部条目（含 ZIP64 支持） */
function listZipEntries(buf) {
  const eocd = findEocd(buf);
  if (eocd < 0) throw new Error("不是有效的 ZIP/APK 文件");
  let count = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);

  // ZIP64：条目数或目录偏移为占位最大值时，从 ZIP64 EOCD 读取真实值
  if (count === 0xffff || cdOffset === U32_MAX) {
    const loc = eocd - 20;
    if (loc >= 0 && buf.readUInt32LE(loc) === 0x07064b50) {
      const z64 = Number(buf.readBigUInt64LE(loc + 8));
      if (z64 + 56 <= buf.length && buf.readUInt32LE(z64) === 0x06064b50) {
        if (count === 0xffff) count = Number(buf.readBigUInt64LE(z64 + 32));
        if (cdOffset === U32_MAX) cdOffset = Number(buf.readBigUInt64LE(z64 + 48));
      }
    }
  }

  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < count && p + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    let compSize = buf.readUInt32LE(p + 20);
    const uncompSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    let localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");

    // ZIP64 扩展字段：占位值在中央目录条目的 extra 中按序出现
    if (compSize === U32_MAX || localOffset === U32_MAX) {
      let q = p + 46 + nameLen;
      const qEnd = q + extraLen;
      while (q + 4 <= qEnd) {
        const id = buf.readUInt16LE(q);
        const size = buf.readUInt16LE(q + 2);
        if (id === 0x0001) {
          let r = q + 4;
          if (uncompSize === U32_MAX) r += 8; // 跳过未占位的 uncompressed size
          if (compSize === U32_MAX) { compSize = Number(buf.readBigUInt64LE(r)); r += 8; }
          if (localOffset === U32_MAX) { localOffset = Number(buf.readBigUInt64LE(r)); }
          break;
        }
        q += 4 + size;
      }
    }

    entries.push({ name, method, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** 解压某个 ZIP 条目 */
function extractEntry(buf, entry) {
  const nameLen = buf.readUInt16LE(entry.localOffset + 26);
  const extraLen = buf.readUInt16LE(entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + entry.compSize);
  if (entry.method === 0) return data; // STORED
  if (entry.method === 8) return zlib.inflateRawSync(data); // DEFLATED
  throw new Error("不支持的压缩方式：" + entry.method);
}

// ---------- AndroidManifest 二进制 XML（AXML）解析 ----------

/** 读取 UTF-8 字符串的长度前缀（1 或 2 字节） */
function readLen8(buf, p) {
  const b = buf.readUInt8(p);
  return b & 0x80 ? { value: ((b & 0x7f) << 8) | buf.readUInt8(p + 1), size: 2 } : { value: b, size: 1 };
}

/** 读取 UTF-16 字符串的长度前缀（2 或 4 字节） */
function readLen16(buf, p) {
  const b = buf.readUInt16LE(p);
  return b & 0x8000
    ? { value: ((b & 0x7fff) << 16) | buf.readUInt16LE(p + 2), size: 4 }
    : { value: b, size: 2 };
}

/** 解析字符串池（ResStringPool），返回全部字符串 */
function parseStringPool(buf, chunkStart) {
  const stringCount = buf.readUInt32LE(chunkStart + 8);
  const flags = buf.readUInt32LE(chunkStart + 16);
  const stringsStart = buf.readUInt32LE(chunkStart + 20);
  const isUtf8 = (flags & 0x100) !== 0;
  const strings = [];
  for (let i = 0; i < stringCount; i++) {
    const off = buf.readUInt32LE(chunkStart + 28 + i * 4);
    let p = chunkStart + stringsStart + off;
    if (p < 0 || p >= buf.length) { strings.push(""); continue; }
    if (isUtf8) {
      p += readLen8(buf, p).size; // 跳过「字符数」前缀
      const byteLen = readLen8(buf, p);
      p += byteLen.size;
      strings.push(buf.subarray(p, p + byteLen.value).toString("utf8"));
    } else {
      const head = readLen16(buf, p);
      p += head.size;
      strings.push(buf.subarray(p, p + head.value * 2).toString("utf16le"));
    }
  }
  return strings;
}

/** 从 AndroidManifest 的二进制 XML 中提取 package / versionCode / versionName */
function parseManifest(axml) {
  const strings = [];
  const result = {};
  let p = 8; // 跳过文件级头（u16 type + u16 headerSize + u32 size）
  while (p + 8 <= axml.length) {
    const type = axml.readUInt16LE(p);
    const size = axml.readUInt32LE(p + 4);
    if (size <= 0 || p + size > axml.length) break;

    if (type === 0x0001) {
      // RES_STRING_POOL_TYPE
      strings.push(...parseStringPool(axml, p));
    } else if (type === 0x0102) {
      // RES_XML_START_ELEMENT_TYPE
      const nameIdx = axml.readUInt32LE(p + 20);
      if (strings[nameIdx] === "manifest") {
        const attrStart = axml.readUInt16LE(p + 24) || 20;
        const attrSize = axml.readUInt16LE(p + 26) || 20;
        const attrCount = axml.readUInt16LE(p + 28);
        // attributeStart 相对于 attrExt 结构体起点（chunk 内 +16），属性数组实际从 p + 16 + attrStart 开始
        for (let i = 0; i < attrCount; i++) {
          const a = p + 16 + attrStart + i * attrSize;
          if (a + 20 > p + size) break;
          const attrName = strings[axml.readUInt32LE(a + 4)] || "";
          const rawIdx = axml.readUInt32LE(a + 8);
          const dataType = axml.readUInt8(a + 15);
          const data = axml.readUInt32LE(a + 16);
          if (attrName === "package") {
            const idx = rawIdx !== U32_MAX ? rawIdx : data;
            if (idx !== U32_MAX && strings[idx]) result.package = strings[idx];
          } else if (attrName === "versionCode") {
            result.versionCode = data; // 整型属性，真实值在 data 中
          } else if (attrName === "versionName") {
            const idx = rawIdx !== U32_MAX ? rawIdx : dataType === 0x03 ? data : U32_MAX;
            if (idx !== U32_MAX && strings[idx]) result.versionName = strings[idx];
          }
        }
        break; // 只需要 manifest 元素的属性
      }
    }
    p += size;
  }
  if (!result.package) throw new Error("未能解析出包名");
  return result;
}

/** 解析单个 APK，返回 { package, versionCode, versionName } */
function parseApk(file) {
  const buf = fs.readFileSync(file);
  const entry = listZipEntries(buf).find((e) => e.name === "AndroidManifest.xml");
  if (!entry) throw new Error("APK 中找不到 AndroidManifest.xml");
  return parseManifest(extractEntry(buf, entry));
}

// ---------- 主流程 ----------

function main() {
  const config = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) : {};
  const apkFiles = fs.existsSync(DL_DIR)
    ? fs.readdirSync(DL_DIR).filter((f) => !f.startsWith(".") && f.toLowerCase().endsWith(".apk")).sort()
    : [];

  const candidates = new Map(); // package -> 选中的 APK 信息
  for (const file of apkFiles) {
    const full = path.join(DL_DIR, file);
    const info = { file, size: fs.statSync(full).size, pkg: "", versionCode: null, versionName: "" };
    try {
      const m = parseApk(full);
      info.pkg = m.package;
      info.versionCode = m.versionCode;
      info.versionName = m.versionName;
    } catch (e) {
      console.warn(`[警告] ${file}：解析失败（${e.message}），尝试用文件名兜底`);
    }
    // versionName 是资源引用（如 "@2131951697"）时读不到字面量，用文件名兜底
    if (!info.versionName || /^[@?]/.test(info.versionName)) {
      info.versionName = versionFromName(file) || info.versionName || "";
    }
    if (!info.pkg) {
      console.warn(`[跳过] ${file}：无法确定包名（apps.json 以包名为 key，必须有包名）`);
      continue;
    }
    const prev = candidates.get(info.pkg);
    if (!prev || isNewer(info, prev)) candidates.set(info.pkg, info);
  }

  const baseUrl = String(config.baseUrl || detectBaseUrl() || "").replace(/\/+$/, "");
  const apps = {};
  for (const pkg of [...candidates.keys()].sort()) {
    const info = candidates.get(pkg);
    const cfg = (config.apps && config.apps[pkg]) || {};
    const versionCode = cfg.versionCode != null ? cfg.versionCode : info.versionCode != null ? info.versionCode : 0;
    if (!versionCode) {
      console.warn(`[警告] ${pkg}：versionCode 为 0，App 端将检测不到更新；可在 update-config.json 中手动指定`);
    }
    apps[pkg] = {
      versionCode,
      versionName: cfg.versionName || info.versionName || "",
      updateLog: cfg.updateLog || "",
      forceUpdate: !!cfg.forceUpdate,
      apkUrl: baseUrl ? `${baseUrl}/downloads/${encodeURIComponent(info.file)}` : "downloads/" + encodeURIComponent(info.file),
      fileSize: humanSize(info.size),
      minSupportVersion: cfg.minSupportVersion != null ? cfg.minSupportVersion : 0,
    };
    console.log(`  ${pkg} → ${apps[pkg].versionName} (versionCode ${versionCode})，${info.file}`);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify({ apps }, null, 2) + "\n", "utf8");
  console.log(`已生成 apps.json（${Object.keys(apps).length} 个应用）`);
  if (baseUrl) console.log(`App 检查更新地址：${baseUrl}/apps.json`);
}

module.exports = { listZipEntries, extractEntry, parseStringPool, parseManifest, parseApk, main };

if (require.main === module) main();
