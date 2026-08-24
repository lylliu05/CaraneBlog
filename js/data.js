/**
 * CaraneBlog 项目数据配置
 *
 * 以后要新增展示的项目，在下面 PROJECTS 数组里加一项即可：
 *   - icon:        一个 emoji，作为项目图标
 *   - downloadUrl: 下载文件路径（相对网站根目录，文件放在 downloads/ 文件夹）
 *   - docUrl:      项目文档链接（可指向 GitHub 上的 markdown 文件）
 */
const PROJECTS = [
  {
    id: "kairos",
    name: "Kairos",
    icon: "⏱️",
    version: "v4.9.0",
    platform: "Android",
    tagline: "纯原生 Android 计时与任务管理应用",
    description:
      "采用 Jetpack Compose + Kotlin 原生构建。以 UnifiedTask 统一任务模型为核心，" +
      "支持计时、树形任务管理、思维导图与甘特图，Room 数据库全库加密，" +
      "进程被杀或设备重启后计时状态可自动恢复。",
    tags: ["计时器", "任务管理", "思维导图", "甘特图", "数据加密"],
    fileSize: "17 MB",
    updateDate: "2026-08-17",
    downloadUrl: "downloads/app-release.apk",
    docUrl: "https://github.com/lylliu05/CaraneBlog/blob/main/docs/kairos.md",
  },
];
