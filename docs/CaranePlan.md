# Kairos 原生 Android 应用框架

> 版本：v4.9.0 | 日期：2026-08-17
>
> 纯原生 Android 计时与任务管理应用，采用 Jetpack Compose + Kotlin 原生技术栈从零构建。

***

## 目录

1. [项目概述](#1-项目概述)
2. [安装指南](#2-安装指南)
3. [使用说明](#3-使用说明)
4. [核心功能](#4-核心功能)
5. [配置方法](#5-配置方法)
6. [常见问题 FAQ](#6-常见问题-faq)
7. [技术选型](#7-技术选型)
8. [架构设计](#8-架构设计)
9. [完整项目结构](#9-完整项目结构)
10. [关键实现细节](#10-关键实现细节)
11. [后续扩展路线](#11-后续扩展路线)
12. [附录：注释规范](#12-附录注释规范)

***

## 1. 项目概述

Kairos 是一个**纯原生 Android 计时与任务管理应用**，在技术实现上完全采用 Android 原生生态：

- **UI 层**：Jetpack Compose 声明式 UI
- **数据层**：Room 本地数据库 + SQLCipher 全库加密
- **网络层**：Retrofit + OkHttp
- **状态管理**：ViewModel + StateFlow
- **依赖注入**：Hilt
- **后台保活**：前台 Service + AlarmManager 精确闹钟 + BootReceiver 自启动，确保进程被杀或设备重启后计时状态可恢复
- **HTML 解析**：Jsoup 抓取链接标题，支撑任务关联链接的自动标题获取

应用以 **UnifiedTask 统一任务模型**为核心：所有任务既可计时（timerType + durationSeconds），又可进行层级管理（taskType + priority + 树形结构）。计时视图通过日期过滤当天任务，思维导图与甘特图复用同一数据源，跨视图同步由 Room Flow 自动驱动，无需额外的跨模块同步机制。任务支持软删除（回收站）、模式切换（休闲/计划/工作/生活）、重复任务（完成时滚动生成下一周期）与艾宾浩斯复习计划。

***

## 2. 安装指南

### 2.1 前置依赖

| 工具                | 版本要求                    | 用途                   |
| ----------------- | ----------------------- | -------------------- |
| JDK               | 17+                     | Kotlin 编译与 Gradle 运行 |
| Android Studio    | Hedgehog (2023.1.1) 或更高 | IDE 与调试              |
| Android SDK       | compileSdk 35 / minSdk 24 | 编译目标与最低支持            |
| Gradle            | 8.9（由 wrapper 自动下载）      | 构建工具                 |
| Kotlin            | 2.0.21                  | 主语言                  |
| KSP               | 2.0.21-1.0.28（KSP1 模式）  | 注解处理                 |

### 2.2 获取源码与初始化

```bash
# 1. 克隆或解压项目后进入根目录
cd kairos_apk

# 2. 复制本地 SDK 路径模板
copy local.properties.sample local.properties
```

编辑 `local.properties`，填入本机 SDK 路径：

```properties
sdk.dir=D\:\\Android\\Sdk
```

> Windows 路径需转义反斜杠；macOS / Linux 使用正斜杠即可。

### 2.3 KSP 配置

项目使用 KSP1（KSP2 因 Unit 返回类型 bug 暂不兼容），在 `gradle.properties` 中已声明：

```properties
ksp.useKSP2=false
```

### 2.4 命令行构建

```bash
# Windows PowerShell
.\gradlew.bat assembleDebug

# macOS / Linux
./gradlew assembleDebug
```

产物：`app/build/outputs/apk/debug/app-debug.apk`（debug 后缀 `.debug`）

安装到设备：

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

### 2.5 Android Studio 构建

1. File → Open → 选择 `kairos_apk/` 根目录
2. 等待 Gradle Sync 完成
3. Build → Build APK(s) 或 Build → Generate Signed Bundle / APK

### 2.6 签名配置（Release）

Release 构建的签名信息从 `app/keystore.properties` 文件读取，`app/build.gradle.kts` 在构建时加载：

```kotlin
val keystorePropertiesFile = rootProject.file("app/keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

signingConfigs {
    create("release") {
        keyAlias = keystoreProperties["keyAlias"] as String
        keyPassword = keystoreProperties["keyPassword"] as String
        storeFile = file(keystoreProperties["storeFile"] as String)
        storePassword = keystoreProperties["storePassword"] as String
    }
}
```

`keystore.properties` 文件示例（**不应提交到版本库**）：

```properties
storeFile=anone_release.jks
storePassword=********
keyAlias=anone
keyPassword=********
```

***

## 3. 使用说明

### 3.1 端到端使用流程

```
首次启动
   │
   ▼
注册账号（用户名 + 密码，PBKDF2 哈希存储）
   │
   ▼
登录 → 进入主界面（底部导航栏：计时 / 任务 / 导图 / 甘特 / 数据）
   │
   ├── 计时模块（Timer）
   │     ├── 查看当天可计时任务（按 startDate 过滤，按 mode 过滤）
   │     ├── 启动计时（倒计时 / 正计时，支持循环）
   │     ├── 暂停 / 恢复 / 停止 / 终止（终止累加 elapsedSeconds）
   │     ├── 后台运行：前台 Service 持续显示剩余时间
   │     ├── 到点触发：精确闹钟唤醒 + 蜂鸣 + 震动 + 完成通知
   │     ├── 查看已完成历史
   │     └── 顶部下拉 > 120dp 进入备忘录页面（与备忘录页下拉返回对称）
   │
   ├── 备忘录模块（Memo）
   │     ├── 从计时页下拉进入，列表页下拉返回计时页
   │     ├── 列表页套用任务页模板（TopAppBar + LazyColumn + FAB + 左滑删除）
   │     ├── 新建备忘：标题留空 + 自动聚焦 + 800ms 防抖自动保存 + 无时间字段
   │     ├── 块编辑器：7 种块类型（段落/标题/列表/待办/图片/链接/内部链接），"+" 按钮选块类型
   │     ├── 待办列表：- [ ] / - [x] 语法，Checkbox + 文本（勾选加删除线）
   │     ├── 内部链接（wikilink）：[[target]] 引用型可点击跳转 + ![[target#heading]] 嵌入型真嵌入渲染目标笔记对应内容
   │     ├── 键盘适配：imePadding + verticalScroll，键盘弹起时光标处文本自动可见
   │     ├── 底部工具栏（Obsidian 风格）：键盘上方横向滚动，行内格式（B/I/S/Code/Highlight）+ 块级（H1/H2/H3/List/Task）+ 插入（图片/链接/内部链接）+ 工具（缩进/收起键盘），pointerInput 检测避免抢焦点
   │     ├── 块间距紧凑：spacedBy 0dp，避免编辑时视觉割裂
   │     ├── 标题作为文件名：title 变化时自动 renameMemoByTitle，避免大量"未命名.md"
   │     ├── 存储双后端可切换：默认 app 私有目录 .md 文件，可切换 Obsidian vault 子目录（自动迁移）
   │     └── 图片附件：多选批量插入，Obsidian wikilink 语法 ![[xxx.png]]
   │
   ├── 任务模块（TaskFlow）
   │     ├── 创建任务（标题、类型、优先级、起止日期、嵌套子任务、模式、重复）
   │     ├── 合并展示项目任务 / 习惯养成 / 普通任务 / 重复任务 / 艾宾浩斯复习等可执行任务类型
   │     ├── 模式切换（休闲 / 计划 / 工作 / 生活，全局过滤）
   │     ├── 排序、折叠/展开、完成统计
   │     └── 设置（排序规则、显示已完成任务开关）
   │
   ├── 思维导图模块（MindMap）
   │     ├── 水平树形可视化（左→右展开，支持双指缩放与拖拽）
   │     ├── 节点折叠/展开（与任务页共享状态）
   │     ├── 长按节点：添加子任务 / 添加父任务 / 编辑 / 删除
   │     ├── 添加父任务：新建父任务 或 从已有任务中选择
   │     └── 节点状态色（已完成 / 进行中 / 待开始）
   │
   ├── 甘特图模块（Gantt）
   │     ├── 本周任务排期可视化
   │     ├── 任务条按起止日期横向排布
   │     ├── 点击任务条查看详情
   │     └── 空态引导
   │
   └── 数据模块（Dashboard）
         ├── 周报卡片（今日推荐：完成 X/Y 任务 · 计时 X/Y 分钟，点击进入历史报告）
         ├── 月份切换器 + 两条热力色带（任务完成 + 计时时长）
         ├── 任务分类区域（项目任务 / 习惯养成 / 目标设定，可折叠，快速完成）
         ├── 入口卡片：未完成 / 归档 / 回收站
         └── 三点菜单：数据管理（导出/导入/清空）/ 设置 / 退出登录
   │
   ▼
二级页面
   ├── 未完成（Uncompleted）：未完成任务树形列表
   ├── 归档（Completed）：已完成任务列表与重新激活
   ├── 回收站（Trash）：软删除任务恢复 / 永久删除
   ├── 项目任务（ProjectTask）：PROJECT_TASK 类型任务管理，按周计划模板筛选（周日期范围切换）
   ├── 习惯养成（HabitTask）：HABIT_TRACKER 类型任务管理
   └── 历史报告（HistoryReport）：周报详情与历史趋势
```

### 3.2 后台保活与设备重启恢复

| 场景           | 行为                                                                                |
| ------------ | --------------------------------------------------------------------------------- |
| App 切到后台     | 前台 Service 持续运行，通知栏显示剩余时间                                                       |
| 系统杀进程        | TimerSession 持久化到 Room（`timer_session` 表），下次启动通过 `computeRecovery` 逆推恢复      |
| 屏幕熄灭 / Doze  | AlarmManager `setExactAndAllowWhileIdle` 在到点时刻唤醒                                |
| 设备重启         | `TimerBootReceiver` 接收 `BOOT_COMPLETED`，重新调度未触发的精确闹钟                            |
| 用户手动停止蜂鸣     | 点击完成通知"停止"按钮 → 发送 `ACTION_STOP_BEEP` 广播 → `TimerAlarmReceiver` 停止震动与铃声并取消通知       |

### 3.3 模块切换与导航

- **底部导航栏**：在 Timer / TaskFlow / MindMap / Gantt / Dashboard 五个主页面显示，使用 `popUpTo + saveState + restoreState + launchSingleTop` 保留各模块状态。
- **二级页面**：通过数据页（Dashboard）入口进入（未完成 / 归档 / 回收站 / 项目任务 / 习惯养成 / 历史报告），按系统返回键回到数据页，避免返回栈混乱。

***

## 4. 核心功能

### 4.1 已实现功能模块

| 模块           | 实现文件                                                                       | 功能说明                                                                  |
| ------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 用户认证         | `AuthRepositoryImpl`、`LoginViewModel`、`PasswordHasher`                     | 注册/登录/登出，PBKDF2 120K 迭代 + 版本前缀 + 自动升级                                  |
| 统一任务管理       | `UnifiedTaskRepositoryImpl`、`UnifiedTaskRepository`、`UnifiedTaskMapper`    | CRUD、批量排序、完成/重新激活、树形结构、折叠状态、统计、导入导出；合并原 Plan 与 Task 仓库 |
| 软删除与回收站      | `UnifiedTaskRepositoryImpl`、`TrashScreen`、`TrashViewModel`                | deleted + deletedAt 软删除标记，回收站恢复 / 永久删除 / 清空                      |
| 计时器          | `TimerViewModel`、`TimerSession`                                            | 倒计时/正计时状态机，所有任务可计时，循环支持，终止累加 elapsedSeconds，每秒 tick 驱动 UI 刷新        |
| 计时会话持久化      | `TimerSessionEntity`、`TimerSessionDao`、`TimerSessionRepositoryImpl`、`TimerRecoveryCalculator` | 单例表存储运行中状态，进程被杀或设备重启后基于绝对时间戳逆推恢复 |
| 计时历史         | `TimerHistoryEntity`、`TimerHistoryDao`、`TimerHistoryRepositoryImpl`       | 多行表持久化每次计时完成记录，支撑数据页热力色带按日分组统计                                     |
| 后台计时         | `TimerForegroundService`、`NotificationHelper`                             | 前台 Service 保活，双渠道通知（IMPORTANCE_HIGH 完成 + IMPORTANCE_LOW 前台持续）       |
| 计时完成提醒       | `NotificationHelper`、`VibrationHelper`、`AlarmPlayer`                       | 到点通知 → 10s 后持续震动 → 20s 后循环铃声，通知"停止"按钮取消震动与铃声                          |
| 精确闹钟         | `AlarmScheduler`、`TimerAlarmReceiver`                                     | `setExactAndAllowWhileIdle` 到点唤醒，支持 Doze 模式                          |
| 开机自启         | `TimerBootReceiver`                                                       | 接收 `BOOT_COMPLETED`，恢复未触发的精确闹钟                                       |
| 本地存储         | `AnoneDatabase`（v22）、`UserPreferences`                                     | Room 数据库（7 实体表）+ DataStore 会话持久化与用户偏好                                |
| 数据库加密        | `DatabaseKeyManager`、`DatabaseModule`、`SecurePreferences`                  | SQLCipher AES-256 加密，密钥由 Android Keystore 保护；文件头检测旧未加密库               |
| 任务模板         | `PlanTemplate`                                                            | 6 种预设模板（番茄钟/会议/学习/运动/午休/循环训练），一键创建                                    |
| 统一任务表单       | `UnifiedTaskFormDialog`、`WheelDurationPicker`                             | 统一任务创建/编辑表单（标题/类型/优先级/起止日期/模式/重复/时长/链接），滚轮时长选择器                      |
| TaskFlow 任务管理 | `TaskFlowScreen`、`TaskFlowViewModel`、`TaskSortUtil`                       | 任务 CRUD、层级嵌套、排序、完成统计、可滑动卡片、可拖拽排序；合并展示项目任务 / 习惯养成 / 普通任务等可执行类型                                  |
| 模式切换         | `ModeSwitchBar`、`ModeViewModel`、`TaskMode`                                | 休闲/计划/工作/生活四模式切换，全局过滤所有页面任务，持久化到 Room + DataStore                   |
| 重复任务         | `RecurringTaskGenerator`、`RecurrenceCalculator`、`RecurringFrequency`      | 重复任务新建时批量预生成 10 个周期；任意任务勾选"重复"后完成时滚动生成下一实例（天/周/月/年/自定义）             |
| 艾宾浩斯复习       | `RecurringTaskGenerator`                                                  | 按 0/1/2/4/7/15/30/60 天间隔生成 8 个复习任务实例                                 |
| 父子时间约束       | `ParentChildTimeConstraint`                                               | 子任务 startDate 须 >= 所有祖先 startDate（允许同一天）；父任务时间变更后递归级联调整子孙；事务保护            |
| 链接标题抓取       | `LinkInsertDialog`、`LinkTitleFetcher`、`Jsoup`                             | 任务关联链接新增时异步抓取页面标题，缓存显示                                                |
| 任务图片         | `TaskImageEntity`、`TaskImageDao`、`TaskImageStore`、`TaskImageRepository`、`TaskEditScreen`、`TaskEditViewModel`、`TaskImageThumbnailRow` | 单任务最多 9 张图片，3 列方格网格编辑，卡片缩略图预览（3 张+余数），文件存储 `filesDir/task_images/<taskId>/`，ForeignKey CASCADE 自动清理数据库记录，递归删除任务时清理图片文件，全屏查看支持双指缩放与删除 |
| 思维导图         | `MindMapScreen`、`MindMapViewModel`、`MindMapLayout`、`MindMapNode`、`ParentTaskPickerDialog` | 任务树形可视化、双指缩放、展开/折叠、长按添加父/子任务、状态色、已完成任务过滤                              |
| 甘特图          | `GanttScreen`、`GanttViewModel`、`GanttChart`、`GanttTaskBar`、`GanttDetailSheet`、`GanttEmptyState`、`GanttAutoScroll` | 本周任务排期可视化、任务条点击查看详情、空态引导、自动滚动到今日 |
| 数据页（Dashboard）| `DashboardScreen`、`DashboardViewModel`、`DataViewModel`、`WeeklyReportViewModel`、`TaskTypeSection` | 周报卡片（今日推荐）、月份切换器、双热力色带（任务完成 + 计时时长）、任务分类区域（项目/习惯/目标，可折叠快速完成）、入口卡片（未完成/归档/回收站）、三点菜单（数据管理/设置/退出） |
| 应用使用统计     | `AppUsageFetcher`、`AppUsageLifecycleObserver`、`AppUsageRepositoryImpl`、`AppUsageRingChart` | ON_RESUME 拉取 UsageStatsManager 数据，按应用分类聚合，环形图展示当日使用占比 |
| 桌面小组件       | `TimerLauncherWidget`、`TimerLauncherReceiver`、`WidgetActionReceiver`、`WidgetEntryPoint`、`WidgetTimerController` | Glance 实现桌面快捷启动/停止计时与模板预设，一键操作无需进入 App |
| 周/月计划页      | `PlanScreen`、`PlanTaskViewModel`、`PlanParentPickerDialog`、`ProjectParentPickerDialog` | 周/月计划管理，普通任务通过 planParentId 关联到周/月计划或项目任务（跨类型关联复用同一字段） |
| 任务详情/编辑     | `TaskEditScreen`、`TaskEditViewModel`、`FullscreenImageViewer` | 任务详情查看与编辑，图片全屏查看（双指缩放、删除） |
| 历史报告        | `HistoryReportScreen`、`HistoryReportViewModel`、`AppUsageTab`、`AppUsageViewModel` | 周报详情与历史趋势，含应用使用 Tab |
| 预测与连续打卡    | `ForecastCalculator`、`ForecastLineChart`、`StreakCalendarChart`、`HourHeatmapChart`、`CliffCountdownCard` | 趋势预测折线图、连续打卡日历图、小时热力图、悬崖倒计时卡片 |
| 未完成页         | `UncompletedScreen`、`UncompletedViewModel`                                | 未完成任务树形列表                                                             |
| 已完成历史        | `CompletedScreen`、`CompletedViewModel`                                    | 已完成任务列表与重新激活                                                          |
| 回收站          | `TrashScreen`、`TrashViewModel`                                            | 软删除任务恢复 / 永久删除 / 清空                                                   |
| 项目任务页        | `ProjectTaskScreen`、`ProjectTaskViewModel`                                | PROJECT_TASK 类型任务专项管理，套用周计划模板（按周日期范围筛选，前后翻页/回到本周）                          |
| 习惯养成页        | `HabitTaskScreen`、`HabitTaskViewModel`                                    | HABIT_TRACKER 类型任务专项管理                                                |
| 设置弹窗         | `SettingsDialog`                                                           | 显示已完成任务开关、左滑/右滑操作配置（删除/完成/开始计时），从 ProfileScreen 迁移                |
| 备忘录          | `MemoScreen`、`MemoViewModel`、`MemoEditScreen`、`MemoEditViewModel`、`MemoTrashScreen`、`MemoTrashViewModel`、`MemoCard`、`PullDownReturnBar`、`VaultPickerDialog`、`MemoBlockEditor`、`MemoEditToolbar`、`MemoRepositoryImpl`、`PrivateMemoStorageBackend`、`ObsidianMemoStorageBackend`、`MemoMarkdownParser` | 计时页下拉进入，列表页下拉返回；块编辑器（段落/标题/列表/图片/链接 5 种块）；800ms 防抖自动保存；双后端可切换（app 私有目录 .md ↔ Obsidian vault 子目录，自动迁移）；图片附件用 `![[xxx.png]]` wikilink 语法；底部工具栏（Obsidian 风格，键盘上方，行内格式 + 块级 + 插入 + 工具）；软删除到 .trash 子目录，回收站支持单条恢复/彻底删除/清空；全文搜索匹配标题与正文文本块；标题块右侧显示 H1~H3 级别标签；`- [ ]` / `- [*]` 解析为列表项，`- [x]` 才触发待办块；内部链接点击带 heading 锚点跳转定位 |
| 数据管理         | `DataManagementDialog`                                                     | 任务数据导出（JSON）/ 导入 / 清空，四态弹窗（菜单/导出结果/导入输入/清空确认），IO 线程导出防闪退      |
| 今日推荐算法       | `RecommendationCalculator`、`WeeklyReportViewModel`                       | 基于过去 30 天历史，按工作日/周末分类 + 指数衰减加权平均，计算今日推荐任务数与计时时长               |
| 滑动操作偏好       | `SwipeAction`、`UserPreferences`                                           | 左滑/右滑可配置为删除/完成/开始计时，持久化到 DataStore                                 |
| 导航           | `AnoneNavHost`、`Destinations`、`BottomNavBar`、`AuthViewModel`              | 登录守卫、路由跳转、底部导航栏（Timer / TaskFlow / MindMap / Gantt / Dashboard 五模块切换） |
| 日期工具         | `DateUtil`、`GanttDateUtils`                                               | "yyyy-MM-dd" 格式化/解析（存储）+ "yyyy/MM/dd" 显示转换，UTC/本地时区分离，甘特图日期范围计算      |
| 输入校验         | `InputValidator`                                                           | 统一输入安全校验（长度限制、控制字符检测）                                                 |
| 可复用组件        | `ReorderableList`、`SwipeableTaskCard`、`HeatmapStrip`、`WeeklyReportCard`、`DateRangeToolbar`、`TaskTreeComponents`、`TaskRelationChips`、`TaskDateRangePickerSheet` | 可拖拽排序列表、可滑动任务卡片、热力色带、周报卡片、日期范围工具栏（支持 leading/trailing 插槽）、任务树组件（含 `PlanParentBadge` 跨类型关联胶囊）、任务关系标签、起止日期周/月/自定义选择器 |

### 4.2 规划中模块

| 模块      | 规划说明                        | 优先级 |
| ------- | --------------------------- | --- |
| 任务到期提醒  | 复用 AlarmScheduler，任务 dueDate 到期触发通知 | 高   |
| 任务搜索    | 按标题/描述/指派人关键词搜索            | 高   |
| 远程同步    | Retrofit + WorkManager 后台同步 | 高   |
| 主题切换    | Material3 动态取色 + 浅色/深色/跟随系统 | 中   |
| 国际化     | strings.xml 多语言             | 中   |
| Wear OS | 计时器通知 + 简易控制                | 低   |

***

## 5. 配置方法

### 5.1 数据库加密密钥派生路径

```
首次启动
   │
   ▼
SecureRandom 生成 32 字节随机密钥
   │
   ▼
Base64 编码 → EncryptedSharedPreferences（AES256-GCM，由 Android Keystore 保护）
   │
   ▼
后续启动：从 EncryptedSharedPreferences 读取 Base64 → 解码为 ByteArray
   │
   ▼
SupportFactory(ByteArray) → Room.databaseBuilder.openHelperFactory()
   │
   ▼
SQLCipher 全库 AES-256 加密
```

**关键文件**：
- `util/DatabaseKeyManager.kt`：密钥生成、存储、读取
- `util/SecurePreferences.kt`：EncryptedSharedPreferences 封装
- `di/DatabaseModule.kt`：SQLCipher 集成、`ensureFreshEncryptedDatabase` 旧库文件头检测

### 5.2 通知渠道配置

`util/NotificationHelper.kt` 在 `init` 块创建双渠道（API 26+ 才创建，低版本跳过）：

| 渠道 ID                  | 名称         | Importance      | 用途                |
| ---------------------- | ---------- | --------------- | ----------------- |
| `timer_completion`     | 计时完成通知     | IMPORTANCE_HIGH | heads-up 弹出，到点提醒  |
| `timer_foreground`     | 计时器运行中     | IMPORTANCE_LOW  | 前台 Service 持续通知   |

> `NotificationChannel` 直接引用在 API 24/25 会触发 `NoClassDefFoundError`，必须用 `Build.VERSION.SDK_INT >= Build.VERSION_CODES.O` 包裹。

### 5.3 前台服务配置

`AndroidManifest.xml`：

```xml
<service
    android:name=".util.TimerForegroundService"
    android:exported="false"
    android:foregroundServiceType="specialUse" />
```

权限声明：

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
```

### 5.4 精确闹钟权限

`AndroidManifest.xml`：

```xml
<!-- 计时器符合豁免条件，USE_EXACT_ALARM 声明即可免授权 -->
<uses-permission android:name="android.permission.USE_EXACT_ALARM" />
<!-- AlarmManager.RTC_WAKEUP 触发时保证 CPU 唤醒 -->
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

`AlarmScheduler` 在 Android 12+（API 31+）会先调用 `canScheduleExactAlarms()` 检查权限。

### 5.5 开机自启权限

```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

```xml
<receiver android:name=".receiver.TimerBootReceiver" android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED" />
    </intent-filter>
</receiver>
```

### 5.6 通知权限（Android 13+）

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

`MainActivity` 在启动时自动请求 `POST_NOTIFICATIONS` 权限（Android 13+ 需要，Android 12 及以下只需 Manifest 声明）。

### 5.7 关键构建配置

`app/build.gradle.kts`：

```kotlin
android {
    namespace = "com.anoneapk.timer"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.anoneapk.timer"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

room {
    schemaDirectory("$projectDir/schemas")  // Room 2.6+ 强制要求声明
}
```

`gradle.properties`：

```properties
ksp.useKSP2=false  # KSP2 有 Unit 返回类型 bug，暂用 KSP1
```

### 5.8 混淆规则

`proguard-rules.pro` 已配置：

- Room 实体保留（`@Entity` 注解类不混淆）
- Retrofit 接口保留（`@Retention` 注解类不混淆）
- kotlinx.serialization（`@Serializable` 注解类保留）
- Hilt 自动生成类排除

***

## 6. 常见问题 FAQ

### Q1：为什么 SQLCipher 集成时需要文件头检测？

**A**：启用 SQLCipher 后，首次升级时本地可能存在未加密的旧版数据库。直接用 SQLCipher 密钥打开会抛 `File is not a database`，若误处理为"密码错误 → 删除数据库"会丢失用户数据。

`DatabaseModule.ensureFreshEncryptedDatabase()` 读取 db 文件前 16 字节：
- 明文 SQLite 以 `"SQLite format 3\0"` 开头 → 识别为旧未加密库，安全删除后重建
- SQLCipher 加密后为随机盐值 → 正常打开

> **重要教训**：早期实现曾将 `ByteArray` 密钥转为 `String(UTF-8)` 后调用 `openDatabase`，但随机密钥中的无效 UTF-8 字节会被替换为 U+FFFD，导致每次启动密码验证失败，误删已加密数据库。文件头检测彻底消除此问题。

### Q2：PBKDF2 SHA1 fallback 在什么条件下触发？

**A**：`PasswordHasher` 优先使用 `PBKDF2WithHmacSHA256`（API 26+），API 24/25（Android 7.0/7.1）不支持 SHA256 算法时回退至 `PBKDF2WithHmacSHA1`。

实现采用懒初始化 + `NoSuchAlgorithmException` fallback：

```kotlin
private val algorithm by lazy {
    try { SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256") }
    catch (e: NoSuchAlgorithmException) { SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1") }
}
```

哈希输出格式 `v2:algorithm:iterations:salt:hash` 保存所用算法名，校验时按相同算法比对，避免 SHA256 哈希与 SHA1 哈希不匹配。

### Q3：为什么将 Plan/Task 合并为 UnifiedTask？

**A**：早期架构采用 Plan（计时计划）与 Task（任务管理）分离的两表模型，通过 `link_plan_task` 关联表和一套跨模块共享内核（事件总线、联动协调器、冲突解决、锁池）保证双向联动。实践发现：

- 共享内核引入大量样板代码（DomainEvent / DomainEventBus / CrossModuleSyncCoordinator / WriteLockManager / LwwConflictResolver / SharedResult 等 10+ 类）
- 联动场景实际上很有限（主要是完成状态同步），却要承担并发控制、幂等保护、事件多播等复杂度
- 同步 Bug 难以定位（如 `planDate` 未设置导致计时页查不到当天任务）

v3.0 将三表合并为单一 `unified_tasks` 表，所有任务既可计时又可管理，跨视图同步由 Room Flow 自动驱动，**彻底消除跨模块同步复杂度**。领域枚举 `PlanType` 独立成文件保留，`timerType` 字段继续支撑倒计时/正计时区分。

### Q4：设备重启后计时如何恢复？

**A**：恢复链路：

```
设备重启
   │
   ▼
TimerBootReceiver 接收 BOOT_COMPLETED
   │
   ▼
App 启动 / MainActivity 创建
   │
   ▼
TimerViewModel 读取 TimerSession（timer_session 单例表）
   │
   ▼
computeRecovery(session, now) 逆推：
   - 运行中：elapsedMs = now - startedAt - accumulatedPausedMs
   - 暂停中：elapsedMs = pausedAt - startedAt - accumulatedPausedMs（冻结）
   │
   ▼
COUNTDOWN：remaining = duration - elapsedSec
   - remaining > 0：恢复显示，重新调度 AlarmScheduler
   - remaining ≤ 0：直接触发完成流程
STOPWATCH：remaining = elapsedSec（已用秒数）
```

由于 `startedAt / accumulatedPausedMs / pausedAt` 均为持久化值，恢复误差为 0，不受进程死亡时长影响。

### Q5：登录态如何持久化？

**A**：`UserPreferences` 基于 DataStore Preferences 存储 `userId`。`AuthRepository.isSessionValid()` 检查 DataStore 中 userId 是否仍存在于 User 表（防止数据库迁移后引用失效）。`AnoneNavHost` 在导航时校验，失效则跳转登录页。

> SQLite 外键约束在 `fallbackToDestructiveMigration` 后可能失效，因此采用应用层校验而非依赖外键。

### Q6：计时页为什么能显示当天任务？

**A**：`UnifiedTaskDao.observeActiveByDate` 查询使用 `REPLACE(startDate, '/', '-') = :date` 兼容历史斜杠格式数据。`DateUtil.today()` 返回 `yyyy-MM-dd` 格式的当天日期。新建任务在 `UnifiedTaskFormDialog` 中以 `yyyy-MM-dd` 格式存储 `startDate`，UI 显示时通过 `toDisplayDate()` 扩展转为 `yyyy/MM/dd`，保证存储格式与查询条件一致。

***

## 7. 技术选型

### 7.1 核心技术栈

| 类别     | 技术                          | 版本              | 选型理由                               |
| ------ | --------------------------- | --------------- | ---------------------------------- |
| 语言     | Kotlin                      | 2.0.21          | Android 官方首选语言，协程 + Flow 异步模型      |
| UI 框架  | Jetpack Compose             | BOM 2024.12.01  | 声明式 UI，编译期类型安全，免去 XML findViewById |
| 构建     | Android Gradle Plugin       | 8.7.3           | 支持 KSP、配置缓存                        |
| Gradle | Gradle                      | 8.9             | 配合 AGP 8.x，启用配置缓存                  |
| 注解处理   | KSP                         | 2.0.21-1.0.28   | KSP1 模式（KSP2 有 Unit 返回类型 bug）       |
| 依赖注入   | Hilt                        | 2.52            | 基于 Dagger，编译期生成，Android 官方推荐       |
| 数据库    | Room                        | 2.6.1           | 编译期 SQL 校验，自动生成实现，支持 Flow          |
| 数据库加密  | SQLCipher                   | 4.5.4           | 全库 AES-256 加密                      |
| 安全存储   | androidx.security.crypto    | 1.1.0-alpha06   | EncryptedSharedPreferences（AES256-GCM） |
| 网络     | Retrofit + OkHttp           | 2.11.0 / 4.12.0 | 类型安全 HTTP 客户端，拦截器机制                |
| 序列化    | kotlinx.serialization       | 1.7.3           | 编译期生成，无反射，Kotlin 原生                |
| 异步     | Coroutines                  | 1.9.0           | 结构化并发，取代回调地狱                       |
| 偏好存储   | DataStore                   | 1.1.1           | 取代 SharedPreferences，支持 Flow       |
| 导航     | Navigation Compose          | 2.8.5           | 单 Activity + NavHost               |
| 日志     | Timber                      | 5.0.1           | 自动填充类名，Release 自动裁剪                |
| 启动屏    | core-splashscreen           | 1.0.1           | Android 12+ 原生启动屏                  |
| HTML 解析 | Jsoup                       | 1.18.1          | 抓取任务关联链接的页面标题                     |
| 图表     | Vico                        | 2.0.0-beta.7    | Compose 历史数据页折线图                  |
| 图片加载   | Coil                        | 2.7.0           | 任务图片加载与缓存                          |
| 文件访问   | DocumentFile                | 1.0.1           | Obsidian vault 目录访问（DocumentFile + ContentResolver） |
| 桌面小组件 | Glance                      | 1.1.1           | Jetpack 桌面小组件实现                    |

> 版本号统一由 `gradle/libs.versions.toml`（Version Catalog）管理，修改时需保持同步。

***

## 8. 架构设计

### 8.1 架构模式：MVVM + Clean Architecture

采用 Google 推荐的**单向数据流 + 分层架构**：

```
┌──────────────────────────────────────────────────────────────┐
│                    UI 层 (presentation)                      │
│   Composable 屏幕 ←→ ViewModel (StateFlow)                  │
└──────────────────────┬───────────────────────────────────────┘
                       │ StateFlow 订阅 / 事件回调
┌──────────────────────▼───────────────────────────────────────┐
│                 Domain 层 (domain)                           │
│   Repository 接口 ←→ Model                                  │
└──────────────────────┬───────────────────────────────────────┘
                       │ 依赖倒置（接口由 data 层实现）
┌──────────────────────▼───────────────────────────────────────┐
│                  Data 层 (data)                              │
│   Repository 实现 ←→ Room DAO / Retrofit API / DataStore    │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 分层职责

| 层            | 包路径                  | 职责                            | 依赖方向                |
| ------------ | -------------------- | ----------------------------- | ------------------- |
| presentation | `presentation.*`     | UI 渲染、用户交互、ViewModel          | → domain            |
| domain       | `domain.*`           | 业务模型、仓库接口                     | 无外部依赖               |
| data         | `data.*`             | 数据源实现、模型映射                    | → domain（实现接口）      |
| di           | `di.*`               | Hilt 模块，组装依赖                  | → data, domain      |

> v3.0 已移除原 `domain.shared.*` / `data.shared.*` 共享内核子包。合并后所有任务通过 `UnifiedTaskRepository` 统一访问，跨视图同步由 Room Flow 自动驱动，无需事件总线或联动协调器。

### 8.3 数据流向（单向数据流）

```
用户操作 → ViewModel 调用 Repository 接口
        → Repository 实现操作 Room/Retrofit
        → Room 通过 Flow 通知数据变更
        → ViewModel 的 StateFlow 自动更新
        → Composable 重组渲染新状态
```

### 8.4 跨视图数据同步

计时、任务、导图、甘特四个视图共享同一 `UnifiedTaskRepository`，任一视图修改任务数据后，Room Flow 自动通知所有订阅者刷新：

```
TimerViewModel 修改任务完成状态
        │
        ▼
UnifiedTaskRepositoryImpl.updateTask / toggleComplete
        │
        ▼
UnifiedTaskDao 更新 unified_tasks 表
        │
        ▼ Room Flow 自动发射
        ├── TimerViewModel.observeActiveTasksByDate → 计时页刷新
        ├── TaskFlowViewModel.observeAllTasks → 任务页刷新
        ├── MindMapViewModel.getTree → 导图页刷新
        └── GanttViewModel.observeTasks → 甘特页刷新
```

无需事件总线、无需联动协调器、无需锁池，数据一致性由 Room 事务 + Flow 订阅天然保证。

***

## 9. 完整项目结构

```
kairos_apk/                                 # 项目根目录
├── settings.gradle.kts                     # 项目设置，仅包含 :app
├── build.gradle.kts                        # 顶层构建文件
├── gradle.properties                       # Gradle 全局配置（ksp.useKSP2=false）
├── local.properties.sample                 # 本地 SDK 路径示例
├── keystore.properties                     # Release 签名配置（不提交版本库）
├── .gitignore                              # 顶层忽略规则
├── README.md                               # 本文档
│
├── gradle/
│   ├── libs.versions.toml                  # Version Catalog（统一依赖版本）
│   └── wrapper/
│       └── gradle-wrapper.properties        # Gradle 版本配置
│
└── app/                                    # 唯一应用模块
    ├── build.gradle.kts                    # 模块构建配置
    ├── proguard-rules.pro                  # R8 混淆规则
    ├── schemas/                            # Room schema JSON 导出目录
    ├── .gitignore                          # 模块忽略规则
    │
    └── src/main/
        ├── AndroidManifest.xml             # 应用清单
        │
        ├── res/                            # 资源目录
        │   ├── values/
        │   │   ├── strings.xml            # 字符串资源
        │   │   ├── colors.xml              # 颜色资源
        │   │   └── themes.xml              # 主题资源
        │   ├── drawable/                   # 矢量图标
        │   ├── mipmap-anydpi-v26/         # 自适应图标
        │   └── xml/
        │       └── file_paths.xml         # FileProvider 路径
        │
        └── java/com/anoneapk/timer/        # 源码根包
            ├── AnoneApp.kt                 # Application 入口
            │
            ├── data/                       # Data 层
            │   ├── local/                  # 本地数据源
            │   │   ├── entity/             # Room 实体（7 张表）
            │   │   │   ├── UserEntity.kt
            │   │   │   ├── UnifiedTaskEntity.kt       # 统一任务表 (v9 合并，v10-v17 扩展)
            │   │   │   ├── TimerSessionEntity.kt      # 计时会话实体 (v5)
            │   │   │   └── TimerHistoryEntity.kt      # 计时历史记录 (v12)
            │   │   ├── dao/                 # Room DAO
            │   │   │   ├── UserDao.kt
            │   │   │   ├── UnifiedTaskDao.kt          # 统一任务 DAO
            │   │   │   ├── TimerSessionDao.kt         # 会话表 DAO
            │   │   │   └── TimerHistoryDao.kt         # 历史记录 DAO
            │   │   ├── converter/          # 类型转换器与映射
            │   │   │   ├── Converters.kt              # Room TypeConverters
            │   │   │   └── UnifiedTaskMapper.kt       # Entity ↔ Domain 映射
            │   │   ├── migration/          # 数据库迁移（v4→v22）
                │   │   │   ├── Migration4To5.kt            # v4→v5 新增 timer_session 表
                │   │   │   ├── Migration5To6.kt            # v5→v6 tasks 新增 links 字段
                │   │   │   ├── Migration6To7.kt            # v6→v7 plans 新增 planDate 字段
                │   │   │   ├── Migration7To8.kt            # v7→v8 补建 planDate 索引
                │   │   │   ├── Migration8To9.kt            # v8→v9 合并为 unified_tasks
                │   │   │   ├── Migration9To10.kt           # v9→v10 删除 endDate 列
                │   │   │   ├── Migration10To11.kt          # v10→v11 新增软删除字段
                │   │   │   ├── Migration11To12.kt          # v11→v12 新增 timer_history 表
                │   │   │   ├── Migration12To13.kt          # v12→v13 新增 mode 字段
                │   │   │   ├── Migration13To14.kt          # v13→v14 新增 elapsedSeconds
                │   │   │   ├── Migration14To15.kt          # v14→v15 新增提升快照字段
                │   │   │   ├── Migration15To16.kt          # v15→v16 新增重复任务字段
                │   │   │   ├── Migration16To17.kt          # v16→v17 新增重复频率字段
                │   │   │   ├── Migration17To18.kt          # v17→v18 新增 app_category + app_usage_record 表
                │   │   │   ├── Migration18To19.kt          # v18→v19 新增 task_image 表
                │   │   │   ├── Migration19To20.kt          # v19→v20 新增 planParentId 字段与索引
                │   │   │   ├── Migration20To21.kt          # v20→v21 删除 links 列（重建表）
                │   │   │   └── Migration21To22.kt          # v21→v22 新增 goalMetric/goalTargetValue/goalLinkedTaskId
                │   │   └── AnoneDatabase.kt    # Room Database (v22)
            │   ├── datastore/              # 偏好存储
            │   │   ├── UserPreferences.kt  # DataStore 会话状态与用户偏好（含 current_mode、memo_backend、memo_vault_uri）
            │   │   └── WidgetTemplateStore.kt # 桌面小组件预设模板持久化
            │   ├── mapper/                # 模型映射
            │   │   └── TimerSessionMapper.kt # TimerSession ↔ Entity
            │   ├── parser/                # 解析器
            │   │   └── MemoMarkdownParser.kt # 备忘录块 ↔ Markdown 双向转换（含 YAML front matter）
            │   └── repository/            # Repository 实现
            │       ├── AuthRepositoryImpl.kt
            │       ├── UnifiedTaskRepositoryImpl.kt   # 统一任务仓库实现
            │       ├── TimerSessionRepositoryImpl.kt  # 会话仓库
            │       ├── TimerHistoryRepositoryImpl.kt  # 计时历史仓库
            │       ├── AppCategoryRepositoryImpl.kt   # 应用分类仓库（包名 → 分类映射）
            │       ├── AppUsageRepositoryImpl.kt      # 应用使用记录仓库
            │       ├── TaskImageRepositoryImpl.kt     # 任务图片仓库
            │       ├── EnvironmentSyncHelper.kt       # 多设备环境同步辅助
            │       ├── MemoRepositoryImpl.kt          # 备忘录仓库（双后端切换 + flatMapLatest 响应式）
            │       ├── MemoStorageBackend.kt          # 备忘录存储后端接口
            │       ├── PrivateMemoStorageBackend.kt   # app 私有目录后端（File API）
            │       └── ObsidianMemoStorageBackend.kt  # Obsidian vault 后端（DocumentFile + ContentResolver）
            │   └── usage/                  # 应用使用统计采集
            │       ├── AppUsageFetcher.kt          # UsageStatsManager 数据拉取
            │       ├── AppUsageLifecycleObserver.kt # Activity 生命周期监听触发采集
            │       ├── AppUsageSyncCoordinator.kt  # 采集任务调度协调
            │       ├── DefaultCategoryResolver.kt  # 默认应用分类推断
            │       └── DeviceIdProvider.kt         # 设备唯一标识提供（多设备同步预留）
            │
            ├── domain/                    # Domain 层（纯 Kotlin）
            │   ├── model/                 # 领域模型
            │   │   ├── UnifiedTask.kt     # 统一任务领域模型（合并原 Plan + Task）
            │   │   ├── PlanType.kt        # 计时类型枚举（COUNTDOWN / STOPWATCH）
            │   │   ├── PlanTemplate.kt    # 任务模板 + 预设常量
            │   │   ├── TaskType.kt        # 任务类型枚举
            │   │   ├── TaskPriority.kt    # 任务优先级枚举
            │   │   ├── TaskMode.kt        # 任务模式枚举（LEISURE/PLAN/WORK/LIFE）
            │   │   ├── RecurringFrequency.kt # 重复频率枚举（DAILY/WEEKLY/MONTHLY/YEARLY/CUSTOM）
            │   │   ├── TimerSession.kt    # 计时会话模型
            │   │   ├── Memo.kt            # 备忘录领域模型（fileName/title/blocks/createdAt/updatedAt）
            │   │   ├── MemoBlock.kt       # 备忘录块 sealed class（Paragraph/Heading/List/TaskList/Image/Link/WikiLink）
            │   │   └── User.kt            # 用户领域模型
            │   ├── repository/            # 仓库接口
            │   │   ├── AuthRepository.kt
            │   │   ├── UnifiedTaskRepository.kt       # 统一任务仓库接口
            │   │   ├── TimerSessionRepository.kt     # 会话仓库接口
            │   │   ├── TimerHistoryRepository.kt     # 计时历史仓库接口
            │   │   └── MemoRepository.kt             # 备忘录仓库接口 + MemoBackend 枚举
            │   └── usecase/              # 用例
            │       └── task/
            │           └── ParentChildTimeConstraint.kt # 父子任务时间约束与级联调整
            │
            ├── di/                        # 依赖注入
            │   ├── DatabaseModule.kt      # Room + SQLCipher 提供者
            │   └── RepositoryModule.kt    # 接口绑定
            │
            ├── presentation/              # UI 层
            │   ├── MainActivity.kt        # 单 Activity 入口（含通知权限请求）
            │   ├── theme/                 # Compose 主题
            │   │   ├── Color.kt
            │   │   └── KairosTheme.kt
            │   ├── navigation/            # 导航
            │   │   ├── Destinations.kt    # 路由常量（含 13 个目的地）
            │   │   ├── AnoneNavHost.kt    # NavHost（含底部导航栏集成）
            │   │   ├── BottomNavBar.kt    # 底部导航栏（5 Tab）
            │   │   └── AuthViewModel.kt   # 全局认证状态
            │   ├── components/            # 可复用组件
            │   │   ├── UnifiedTaskFormDialog.kt    # 统一任务创建/编辑表单
            │   │   ├── WheelDurationPicker.kt     # 滚轮时长选择器
            │   │   ├── ReorderableList.kt          # 可拖拽排序列表
            │   │   ├── SwipeableTaskCard.kt        # 可滑动任务卡片
            │   │   ├── HeatmapStrip.kt             # 热力色带（数据页）
            │   │   ├── WeeklyReportCard.kt         # 周报卡片（数据页）
            │   │   ├── DateRangeToolbar.kt         # 日期范围工具栏
            │   │   ├── TaskTreeComponents.kt       # 任务树组件
            │   │   ├── TaskRelationChips.kt       # 任务关系标签
            │   │   ├── LinkInsertDialog.kt         # 链接插入弹窗（含标题抓取）
            │   │   ├── ModeSwitchBar.kt            # 模式切换栏
            │   │   ├── ModeScrollBehavior.kt       # 模式切换滚动行为
            │   │   ├── ModeViewModel.kt            # 模式切换 ViewModel
            │   │   ├── SettingsDialog.kt           # 设置弹窗
            │   │   ├── DataManagementDialog.kt     # 数据管理弹窗（导入导出）
            │   │   ├── TaskDateRangePickerSheet.kt # 起止日期周/月/自定义选择器（BottomSheet）
            │   │   └── memo/                       # 备忘录组件
            │   │       ├── MemoCard.kt             # 备忘录卡片（套用 TaskTreeItem 样式 + 左滑删除）
            │   │       ├── PullDownReturnBar.kt    # 顶部下拉返回区 + pullDownReturnModifier
            │   │       ├── VaultPickerDialog.kt    # Obsidian vault 授权弹窗（OpenDocumentTree）
            │   │       ├── MemoEditToolbar.kt      # 底部编辑工具栏（Obsidian 风格，键盘上方，行内格式 + 块级 + 插入 + 工具）
            │   │       └── MemoBlockEditor.kt      # 块编辑器（5 种块类型 + "+" 添加块按钮 + 行内格式响应）
            │   └── screens/              # 屏幕组件
            │       ├── login/
            │       │   ├── LoginScreen.kt
            │       │   └── LoginViewModel.kt
            │       ├── timer/
            │       │   ├── TimerScreen.kt          # 计时页（顶部下拉 > 120dp 进入备忘录）
            │       │   ├── TimerViewModel.kt
            │       │   └── CircleTimerDisplay.kt    # 圆形计时显示
            │       ├── memo/              # 备忘录模块
            │       │   ├── MemoScreen.kt            # 列表页（TopAppBar + 下拉返回区 + LazyColumn + FAB）
            │       │   ├── MemoViewModel.kt         # 列表 VM（observeMemos / deleteMemo / switchBackend / searchMemos）
            │       │   ├── MemoEditScreen.kt        # 块编辑页（TopAppBar 内嵌标题 + 块列表 + 自动保存）
            │       │   ├── MemoEditViewModel.kt     # 编辑 VM（loadMemo / updateBlock / addBlock / saveDebounced 800ms / heading 锚点定位）
            │       │   ├── MemoTrashScreen.kt       # 回收站页面（列表 + 恢复 + 彻底删除 + 清空 + 二次确认）
            │       │   └── MemoTrashViewModel.kt    # 回收站 VM（listTrashedMemos / restore / permanentDelete / emptyTrash）
            │       ├── taskflow/          # TaskFlow 任务管理
            │       │   ├── TaskFlowScreen.kt
            │       │   ├── TaskFlowSettingsScreen.kt # 设置页面
            │       │   ├── TaskFlowViewModel.kt
            │       │   └── TaskTypeFilter.kt        # 任务类型筛选
            │       ├── mindmap/           # 思维导图模块
            │       │   ├── MindMapScreen.kt
            │       │   ├── MindMapViewModel.kt
            │       │   ├── MindMapLayout.kt          # 水平树形布局算法与连线绘制
            │       │   ├── MindMapNode.kt            # 节点 Composable 与长按菜单
            │       │   └── ParentTaskPickerDialog.kt # 已有父任务树形选择器
            │       ├── gantt/             # 甘特图模块
            │       │   ├── GanttScreen.kt             # 甘特图主页面
            │       │   ├── GanttViewModel.kt          # 视图模型
            │       │   ├── GanttChart.kt              # 甘特图绘制
            │       │   ├── GanttTaskBar.kt            # 任务条组件
            │       │   ├── GanttDetailSheet.kt        # 任务详情底部弹窗
            │       │   ├── GanttColors.kt             # 甘特图配色
            │       │   ├── GanttAutoScroll.kt         # 自动滚动到今日
            │       │   └── GanttEmptyState.kt         # 空态组件
            │       ├── dashboard/         # 数据页（含周报、统计与任务分类）
            │       │   ├── DashboardScreen.kt         # 数据主页（周报+热力色带+任务分类+入口卡片）
            │       │   ├── DashboardViewModel.kt      # 月份切换、热力数据、设置项、导入导出
            │       │   ├── DataViewModel.kt           # 按任务类型分类查询（项目/习惯/目标）
            │       │   ├── WeeklyReportViewModel.kt   # 今日推荐计算（30天历史+指数衰减加权）
            │       │   └── TaskTypeSection.kt         # 任务类型分区组件（项目/习惯/目标可折叠卡片）
            │       ├── completed/
            │       │   ├── CompletedScreen.kt
            │       │   └── CompletedViewModel.kt
            │       ├── uncompleted/        # 未完成页
            │       │   ├── UncompletedScreen.kt
            │       │   └── UncompletedViewModel.kt
            │       ├── trash/             # 回收站
            │       │   ├── TrashScreen.kt
            │       │   └── TrashViewModel.kt
            │       ├── project/           # 项目任务页
            │       │   ├── ProjectTaskScreen.kt
            │       │   └── ProjectTaskViewModel.kt
            │       ├── habit/             # 习惯养成页
            │       │   ├── HabitTaskScreen.kt
            │       │   └── HabitTaskViewModel.kt
            │       └── profile/           # 个人中心（保留）
            │           ├── ProfileScreen.kt
            │           └── ProfileViewModel.kt
            │
            ├── receiver/                 # 广播接收器
            │   ├── TimerAlarmReceiver.kt # 闹钟触发 + 停止蜂鸣
            │   └── TimerBootReceiver.kt   # 开机自启恢复
            │
            ├── widget/                    # 桌面小组件（Glance）
            │   ├── TimerLauncherWidget.kt # Widget 入口与 UI
            │   ├── TimerLauncherReceiver.kt # Widget 宿主 Receiver
            │   ├── WidgetActionReceiver.kt  # Widget 点击事件 Receiver
            │   ├── WidgetEntryPoint.kt    # Widget 与 App 通信入口
            │   ├── WidgetTimerController.kt # Widget 计时控制
            │   └── WidgetUpdateNotifier.kt  # Widget 更新通知
            │
            └── util/                      # 工具类
                ├── AlarmPlayer.kt              # 计时完成蜂鸣音效
                ├── AlarmScheduler.kt           # AlarmManager 精确闹钟调度
                ├── AppConstants.kt             # 全局常量
                ├── DatabaseKeyManager.kt       # 数据库加密密钥管理
                ├── DateUtil.kt                 # 日期格式化与显示转换
                ├── GanttDateUtils.kt           # 甘特图日期工具
                ├── InputValidator.kt           # 统一输入安全校验
                ├── LinkTitleFetcher.kt         # 链接标题抓取（Jsoup）
                ├── NotificationHelper.kt       # 双渠道通知
                ├── PasswordHasher.kt           # 密码哈希（PBKDF2 + 版本前缀）
                ├── RecommendationCalculator.kt # 任务推荐计算
                ├── RecommendedTaskCalculator.kt # 推荐任务计算
                ├── RecurrenceCalculator.kt     # 重复任务下次周期日期计算
                ├── RecurringTaskGenerator.kt   # 重复任务/艾宾浩斯任务批量生成
                ├── SecurePreferences.kt        # EncryptedSharedPreferences 封装
                ├── TaskImageStore.kt           # 任务图片文件存储
                ├── DismissedTaskRegistry.kt    # 已忽略任务登记
                ├── ForecastCalculator.kt       # 预测计算
                ├── TaskSortUtil.kt             # 任务排序工具
                ├── TimeFormatter.kt            # 时间格式化
                ├── TimerForegroundService.kt   # 前台 Service 保活
                ├── TimerRecoveryCalculator.kt  # 计时状态恢复算法
                └── VibrationHelper.kt          # 震动功能封装
```

***

## 10. 关键实现细节

### 10.1 密码哈希（PBKDF2 + 版本前缀 + 自动升级）

`util/PasswordHasher.kt` 采用 `PBKDF2WithHmacSHA256`（API 26+），低版本回退至 `PBKDF2WithHmacSHA1`：

```kotlin
private val secretKeyFactory by lazy {
    try {
        SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
    } catch (e: NoSuchAlgorithmException) {
        SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1")
    }
}
```

- 迭代次数：120000 次
- 盐长度：16 字节
- 密钥长度：256 位
- 输出格式：`v2:algorithm:iterations:salt:hash`
- 校验：常量时间比较（`MessageDigest.isEqual`）防时序攻击
- 自动升级：旧版本哈希在登录成功后自动用新参数重新哈希

### 10.2 Room 数据库迁移（v1 → v22）

当前数据库版本 **v22**，采用显式 `Migration` 对象替代 `fallbackToDestructiveMigration`：

```kotlin
@Database(
    entities = [
        UserEntity::class,
        UnifiedTaskEntity::class,
        TimerSessionEntity::class,
        TimerHistoryEntity::class,
        AppCategoryEntity::class,
        AppUsageRecordEntity::class,
        TaskImageEntity::class
    ],
    version = 22,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class AnoneDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun unifiedTaskDao(): UnifiedTaskDao
    abstract fun timerSessionDao(): TimerSessionDao
    abstract fun timerHistoryDao(): TimerHistoryDao
    abstract fun appCategoryDao(): AppCategoryDao
    abstract fun appUsageRecordDao(): AppUsageRecordDao
    abstract fun taskImageDao(): TaskImageDao
    companion object {
        const val DATABASE_NAME = "anone_timer.db"
    }
}
```

版本演进：

- v1：UserEntity + PlanEntity
- v2：新增 TaskEntity
- v3：移除 PlanEntity 外键约束（修复迁移后插入崩溃）
- v4：新增 LinkPlanTaskEntity（跨模块关联表）
- v5：新增 TimerSessionEntity（计时会话持久化），由 `Migration4To5` 显式迁移
- v6：TaskEntity 新增 `links` 字段（任务链接 JSON 数组），由 `Migration5To6` 显式迁移
- v7：PlanEntity 新增 `planDate` 字段（计划归属日期 "yyyy-MM-dd"），由 `Migration6To7` 显式迁移
- v8：补建 `planDate` 索引，由 `Migration7To8` 显式迁移
- **v9**：合并 `plans + tasks + link_plan_task` 三表为单一 `unified_tasks` 表，由 `Migration8To9` 显式迁移，消除跨模块同步复杂度
- **v10**：删除 `unified_tasks.endDate` 列（与 dueDate 语义重叠），由 `Migration9To10` 重建表
- **v11**：新增 `deleted` + `deletedAt` 软删除字段，支撑回收站功能，由 `Migration10To11`
- **v12**：新增 `timer_history` 表，持久化计时完成记录，支撑数据页热力色带，由 `Migration11To12`
- **v13**：新增 `unified_tasks.mode` 字段（LEISURE/PLAN/WORK/LIFE），支撑任务模式切换，由 `Migration12To13`
- **v14**：新增 `unified_tasks.elapsedSeconds` 字段，存储任务已计时累计秒数（终止时累加），由 `Migration13To14`
- **v15**：新增 `originalParentId/originalStartDate/originalDueDate` 提升快照字段，支撑子任务提升到祖父任务后可恢复，由 `Migration14To15`
- **v16**：新增 `isRecurring/groupId` 重复任务标记与关联组字段，由 `Migration15To16`
- **v17**：新增 `recurrenceFrequency/recurrenceInterval` 重复频率与自定义间隔字段，支撑任意任务类型勾选"重复"后按天/周/月/年/自定义周期滚动生成下一实例，由 `Migration16To17`
- **v18**：新增 `app_category` + `app_usage_record` 表，支撑数据页"应用使用环形图"，每次应用 ON_RESUME 拉取系统 UsageStatsManager 数据并去重写入，由 `Migration17To18`
- **v19**：新增 `task_image` 表，存储任务关联的图片记录（filePath + sortOrder），外键 CASCADE 跟随任务删除，图片文件存 `filesDir/task_images/<taskId>/`，由 `Migration18To19`
- **v20**：新增 `unified_tasks.planParentId` 字段与 `index_unified_tasks_planParentId` 索引，存储"普通任务 → 周/月计划/项目任务"的跨类型关联关系，与 parentId 平行互不干扰，由 `Migration19To20`
- **v21**：删除 `unified_tasks.links` 列，链接功能统一改用描述内 Markdown `[title](url)` 语法，消除与基础链接功能的重复，由 `Migration20To21` 重建表清理 links 列并恢复索引
- **v22**：新增 `unified_tasks.goalMetric/goalTargetValue/goalLinkedTaskId` 三列，支撑 GOAL_SETTING 类型任务的目标配置（指标类型 + 目标值 + 关联任务 ID），由 `Migration21To22` 使用 ALTER TABLE ADD COLUMN 添加

**v9 合并迁移要点**：

- `Migration8To9` 将三表数据 union 后插入 `unified_tasks`，字段映射：`plans.name → title`、`plans.type → timerType`、`tasks.type → taskType`、`plans.planDate → startDate`
- `PlanType` 枚举 rawValue 使用小写（`countdown` / `stopwatch`），与 SQL 字面量保持一致；`fromRaw` 方法提供默认回退值（`COUNTDOWN`）以容错历史脏数据
- 合并后 `TimerSessionEntity` 冗余字段命名为 `currentTaskId/Name/Duration/Type`，恢复时无需 join `unified_tasks` 表

**v12 计时历史表要点**：

- `timer_history` 为多行表（与 `timer_session` 单例表区分），每次计时完成写入一条记录
- 冗余 `taskName` 字段，历史记录不随任务改名而变
- `dateStr` 字段（"yyyy-MM-dd"）用于按日分组统计，支撑热力色带
- 写入时机（v4.8.3 修复后）：
  - 倒计时到点：`TimerForegroundService.handleCompletion` 同步写入一条记录（duration = 原时长），保证用户即使不主动点"完成"也能进入热力色带统计
  - 用户主动"完成"：`completeTask` / `handleNotificationComplete` 写入一条记录，超时模式下仅含超时秒数（原时长已在到点时单独写入），避免重复累加
  - 用户主动"终止"：`terminateTask` 写入一条记录（duration = 已用秒数或超时秒数）
  - 虚拟计时（stopwatch/preset_/recommended_/widget_）也写入 history（跳过 markCompleted/addElapsedSeconds），保证"未关联任务的计时"也能被统计

### 10.3 通知渠道兼容

`util/NotificationHelper.kt` 在 `init` 块创建双渠道（API 26+ 才创建）：

```kotlin
init {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val timerChannel = NotificationChannel(
            CHANNEL_TIMER_COMPLETION,
            "计时完成通知",
            NotificationManager.IMPORTANCE_HIGH
        )
        val foregroundChannel = NotificationChannel(
            CHANNEL_TIMER_FOREGROUND,
            "计时器运行中",
            NotificationManager.IMPORTANCE_LOW
        ).apply { setShowBadge(false) }
        // ...
    }
}
```

> 直接引用 `NotificationChannel` 会在 API 24/25 触发 `NoClassDefFoundError`，必须用版本检查包裹。

### 10.4 会话失效守卫

`AuthRepository.isSessionValid()` 检查 DataStore 中 userId 是否仍存在于 User 表，`AnoneNavHost` 在导航时校验，失效则跳转登录页。

> SQLite 外键约束在 `fallbackToDestructiveMigration` 后可能失效，因此采用应用层校验。

### 10.5 Room Schema 导出

`app/build.gradle.kts` 配置 schema 目录，Room 编译期生成 JSON 校验文件：

```kotlin
room {
    schemaDirectory("$projectDir/schemas")
}
```

### 10.6 数据库加密与密钥管理

`DatabaseKeyManager.kt` 联合 `DatabaseModule.kt` 与 `SecurePreferences.kt` 实现 SQLCipher 全数据库加密：

- **密钥生成**：首次启动由 `SecureRandom` 生成 32 字节随机密钥，Base64 编码后通过 `EncryptedSharedPreferences`（AES256-GCM）加密存储
- **密钥恢复**：后续启动从 Keystore 加密的 SharedPreferences 中读取
- **加密集成**：`SupportFactory(byte[])` 接收原始字节密钥，通过 `Room.databaseBuilder.openHelperFactory()` 集成
- **旧库识别**：`ensureFreshEncryptedDatabase()` 通过文件头检测（SQLite 明文以 `"SQLite format 3\0"` 开头，SQLCipher 加密后为随机盐值），无需密码即可区分，避免 `ByteArray` → `String(UTF-8)` 转换导致随机密钥字节丢失而误删已加密数据库

### 10.7 计时会话恢复算法

`util/TimerRecoveryCalculator.kt` 的 `computeRecovery` 函数基于绝对时间戳逆推计时状态：

```
核心公式：
- 运行中：elapsedMs = now - startedAt - accumulatedPausedMs
- 暂停中：elapsedMs = pausedAt - startedAt - accumulatedPausedMs（冻结在 pausedAt 瞬间）

四种情况：
1. COUNTDOWN running: remaining = duration - elapsedSec，到 0 触发 shouldComplete
2. COUNTDOWN paused:  remaining = duration - elapsedSec（冻结）
3. STOPWATCH running:  remaining = elapsedSec（已用秒数）
4. STOPWATCH paused:   remaining = elapsedSec（冻结）
```

由于 `startedAt / accumulatedPausedMs / pausedAt` 均为持久化值，恢复误差为 0，不受进程死亡时长影响。

### 10.8 精确闹钟调度链路

```
启动计时序列
   │
   ▼
AlarmScheduler.scheduleAlarm(endTimestamp)
   │
   ▼
setExactAndAllowWhileIdle(RTC_WAKEUP, endTimestamp, pendingIntent)
   │
   ▼  (即使进程被杀，到点也会被唤醒)
TimerAlarmReceiver.onReceive (ACTION_TIMER_FIRED)
   │
   ├── 启动 TimerForegroundService
   ├── NotificationHelper.showCompletionWithStop (带"停止"按钮)
   └── AlarmPlayer.startLoopBeep (循环蜂鸣)
   │
   ▼  (用户点击通知"停止"按钮)
TimerAlarmReceiver.onReceive (ACTION_STOP_BEEP)
   │
   ├── AlarmPlayer.stopBeep
   ├── VibrationHelper.stop
   └── NotificationHelper.cancelCompletion
```

设备重启时由 `TimerBootReceiver` 接收 `BOOT_COMPLETED` 重新调度未触发的闹钟。

### 10.9 计时完成提醒链路

`TimerForegroundService` 在计时到点后启动分阶段提醒，用户可随时通过通知"停止"按钮取消：

```
计时到点 (ACTION_TIMER_FIRED)
   │
   ▼  T+0s
NotificationHelper.showCompletionWithStop()
   → 弹出 IMPORTANCE_HIGH heads-up 通知（带"停止"按钮）
   │
   ▼  T+10s（vibrationJob 延迟启动）
VibrationHelper.startVibration()
   → 400ms 震动 / 600ms 暂停 循环，持续到用户停止
   │
   ▼  T+20s（alarmJob 延迟启动）
AlarmPlayer.startLoopBeep()
   → 循环蜂鸣音，持续到用户停止
   │
   ▼  用户点击通知"停止"按钮
ACTION_STOP_ALERTS 广播
   → TimerForegroundService 取消 vibrationJob + alarmJob
   → vibrationHelper.stopVibration() + alarmPlayer.stopBeep()
```

### 10.10 底部导航栏（BottomNavBar）

`presentation/navigation/BottomNavBar.kt` 基于 Material3 `NavigationBar` 实现 Timer / TaskFlow / MindMap / Gantt / Dashboard 五个模块的切换。

**设计要点**：

| 维度   | 实现策略                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 模块映射 | 五个 `NavigationBarItem` 分别绑定 `Destinations.TIMER`、`Destinations.TASKFLOW`、`Destinations.MINDMAP`、`Destinations.GANTT`、`Destinations.DASHBOARD` 路由                          |
| 视觉反馈 | 选中态使用 `Icons.Filled.Timer` / `Icons.Filled.Checklist` / `Icons.Filled.AccountTree` / `Icons.Filled.BarChart` / `Icons.Filled.AccountCircle` + 主题色胶囊指示器；未选中态使用 `Icons.Outlined.*` 弱化权重 |
| 显隐规则 | 仅在 TIMER / TASKFLOW / MINDMAP / GANTT / DASHBOARD 路由显示；登录页与各二级页（COMPLETED / UNCOMPLETED / TRASH / PROJECT\_TASK / HABIT\_TASK / HISTORY\_REPORT / TASKFLOW\_SETTINGS）隐藏，避免返回栈混乱 |
| 状态保留 | 切换时使用 `popUpTo(graph.findStartDestination()) { saveState = true }` + `launchSingleTop = true` + `restoreState = true`，保留各模块的滚动位置与 ViewModel 状态 |
| 屏幕适配 | `NavigationBar` 内置 `WindowInsets.navigationBars` 适配，自动避让系统手势条；标签 `maxLines = 1` + `TextOverflow.Ellipsis` 避免截断                                 |
| 无障碍  | 每个项附加 `contentDescription` 语义，支持 TalkBack 朗读                                                                                                   |

> 五个主模块通过底部导航栏平级切换；二级页面（未完成 / 归档 / 回收站 / 项目任务 / 习惯养成 / 历史报告 / 任务设置）通过数据页（Dashboard）入口进入，按系统返回键回到数据页，与底部导航栏的平级切换形成层次区分。

### 10.11 UnifiedTask 统一模型

`domain/model/UnifiedTask.kt` 合并原 Plan（计时计划）与 Task（任务管理）为单一领域模型。所有任务既可计时又可进行层级管理。

**字段映射**（原 → 新）：

| 原 Plan 字段   | UnifiedTask 字段      | 说明                 |
| ------------- | ------------------- | ------------------ |
| name          | title               | 统一为 title          |
| type          | timerType           | 计时类型（COUNTDOWN/STOPWATCH） |
| durationSeconds | durationSeconds    | 计时时长（秒）            |
| sortOrder     | sortOrder           | 排序序号               |
| loop          | loop                | 是否循环计时             |
| planDate      | startDate           | 开始日期（计时视图按此过滤）     |

| 原 Task 字段 | UnifiedTask 字段 | 说明                 |
| ----------- | --------------- | ------------------ |
| title       | title           | 与 Plan.name 统一     |
| type        | taskType        | 任务类型               |
| priority    | priority        | 优先级                |
| parentId    | parentId        | 父任务 ID             |
| children    | children        | 子任务 ID 列表          |
| completed   | completed       | 完成状态               |

**v10-v17 新增字段**：

| 字段                     | 版本  | 说明                                                          |
| ---------------------- | --- | ----------------------------------------------------------- |
| elapsedSeconds         | v14 | 已计时累计秒数（"终止"时累加，"完成"时清零；下次倒计时仍从 durationSeconds 开始）          |
| deleted / deletedAt    | v11 | 软删除标记与删除时间戳，支撑回收站                                           |
| mode                   | v13 | 任务模式（LEISURE/PLAN/WORK/LIFE），模式切换时全局过滤                      |
| originalParentId       | v15 | 提升快照：子任务被提升到祖父任务前的原父任务 ID                                   |
| originalStartDate      | v15 | 提升快照：提升前的原开始日期                                              |
| originalDueDate        | v15 | 提升快照：提升前的原截止日期                                              |
| isRecurring            | v16 | 是否为重复任务（完成时自动生成新记录，原记录归档）                                   |
| groupId                | v16 | 重复任务关联组 ID（同一重复任务的不同实例共享 groupId）                           |
| recurrenceFrequency    | v17 | 重复频率（daily/weekly/monthly/yearly/custom）                     |
| recurrenceInterval     | v17 | 自定义重复间隔天数（仅 frequency=custom 时有效）                            |

**设计要点**：

- `childrenNodes` / `collapsed` 不持久化，由 Repository 构建 / DataStore 管理
- `PlanType` 枚举独立成文件（`domain/model/PlanType.kt`），避免与模型文件耦合
- `TaskMode` 枚举（`domain/model/TaskMode.kt`）持久化到 Room `mode` 列与 DataStore `current_mode` key
- `RecurringFrequency` 枚举（`domain/model/RecurringFrequency.kt`）持久化到 Room `recurrenceFrequency` 列
- 计时视图通过 `observeActiveTasksByDate(userId, date)` 按 `startDate` 过滤当天任务
- 任务视图通过 `observeAllTasks(userId)` 获取全部任务
- 思维导图通过 `getTree(userId)` 获取树形结构
- 甘特图通过 `getTreeByDateRange(userId, start, end)` 按日期范围获取本周任务

### 10.12 思维导图模块（MindMap）

`presentation/screens/mindmap/` 目录下实现任务的层级化可视化，复用 `UnifiedTaskRepository.getTree()` 数据源，与任务页保持实时同步，无需新增数据表。

**设计要点**：

| 维度     | 实现策略                                                                                                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 布局算法   | `MindMapLayout.calculateMindMapLayout(roots)` 纯函数实现水平树形布局（根节点在左，子节点向右展开）；递归计算子树高度，折叠节点高度计为 0；节点位置自动排布                                                                    |
| 节点尺寸   | `NODE_WIDTH = 150f`、`NODE_HEIGHT = 56f`（内部常量，dp）；水平间距 `HORIZONTAL_GAP = 48f`，垂直间距 `VERTICAL_GAP = 16f`                                                                              |
| 连线绘制   | `DrawScope.drawMindMapConnections()` 在 `Modifier.drawBehind` 中绘制三次贝塞尔曲线（cubic bezier），从父节点右侧中点到子节点左侧中点，由 `Density` 完成像素换算                                                                        |
| 手势交互   | `MindMapScreen` 使用 `detectTransformGestures` 实现双指缩放（0.3x ~ 3x）与单指拖拽平移，`graphicsLayer` 应用 scaleX/scaleY/translationX/translationY，transformOrigin 设为 (0,0)                                  |
| 节点交互   | `MindMapNode` 使用 `combinedClickable`：单击在有子节点时切换折叠/展开（与任务页共享 `isCollapsed` 状态）；长按弹出 `DropdownMenu`，包含「添加子任务 / 添加父任务 / 编辑 / 删除」四项                                                                  |
| 状态色    | `taskStatusColor(task)`：已完成 → 绿色（`0xFF4CAF50`），进行中（progress > 0）→ 蓝色（`0xFF2196F3`），待开始 → 灰色（`0xFF9E9E9E`）；作为节点 `Card` 边框色                                                              |
| 添加父任务  | 两步交互：长按选择「添加父任务」→ 二级选择「新建父任务」或「从已有任务中选择」。<br>• **新建父任务**（`addNewParentTask`）：新父任务 P 占据子任务 C 的原位置，原父任务 G 的 children 中 C 被替换为 P，C 的 parentId 改为 P，P 的 children = [C]。<br>• **从已有任务选择**（`attachToExistingParent`）：C 从原父任务解绑，附加到所选任务 P 之下；附带环路检测（`getDescendantIds` 排除自身及后代） |
| 数据一致性  | 两个父任务操作均封装在 `database.withTransaction` 中，避免循环引用与孤儿节点                                                                                                       |
| 弹窗状态机  | `MindMapScreen` 使用 `sealed interface MindMapDialog` 表达 5 种弹窗状态（AddChild / Edit / AddParentChoice / AddParentNew / AddParentExisting），通过 `when` 穷举管理，避免状态泄漏                                                                          |
| 已完成过滤  | `MindMapViewModel` 通过 `combine(rawTree, userPreferences.showCompletedTasks)` 组合原始树数据与用户偏好，递归过滤已完成节点（及其子树），行为与任务页一致                                                                                       |
| 数据同步   | `MindMapViewModel.taskTree` 与 `TaskFlowViewModel.taskTree` 同源（均通过 `UnifiedTaskRepository.getTree(userId)` 订阅 Flow），任何一端修改任务层级，另一端自动刷新                                                                                       |
| 空态     | 无任务时显示「暂无任务 / 请先在任务页创建任务」文案，引导用户先到任务模块创建数据                                                                                                                                                     |

> 思维导图模块不持有独立数据，所有读写均通过 `UnifiedTaskRepository` 完成；折叠状态、任务层级、完成进度等均与任务页保持一致，跨模块联动由 Room Flow 自动驱动。

### 10.13 甘特图模块（Gantt）

`presentation/screens/gantt/` 目录下实现本周任务的甘特图排期可视化，复用 `UnifiedTaskRepository` 数据源。

**设计要点**：

| 维度     | 实现策略                                                                 |
| ------ | -------------------------------------------------------------------- |
| 数据来源   | `GanttViewModel` 通过 `UnifiedTaskRepository` 按日期范围查询本周任务                |
| 图表绘制   | `GanttChart` 绘制日期表头与任务条，`GanttTaskBar` 按起止日期横向排布                      |
| 日期工具   | `GanttDateUtils` 提供本周日期范围计算与刻度生成                                      |
| 详情查看   | `GanttDetailSheet` 底部弹窗显示任务详情                                        |
| 空态     | `GanttEmptyState` 在无任务时显示引导文案                                         |

> 甘特图与任务页、计时页、导图页共享同一 `UnifiedTaskRepository`，任一视图修改任务后甘特图自动刷新。

### 10.13.1 任务起止日期选择器（TaskDateRangePickerSheet）

`presentation/components/TaskDateRangePickerSheet.kt` 把任务表单（`UnifiedTaskFormDialog`）与甘特图详情弹窗（`GanttDetailSheet`）原有的「两个 DatePicker 分别选起止日」交互改造为「单字段 + ModalBottomSheet + 周/月/自定义三模式」。

**交互结构**：

| 维度     | 实现策略                                                                 |
| ------ | -------------------------------------------------------------------- |
| 外层字段   | 合并为单个 `OutlinedButton`，显示「2026/7/13 - 2026/7/19」格式；点击触发 BottomSheet |
| 模式切换   | Sheet 顶部 `SingleChoiceSegmentedButtonRow`：周 \| 月 \| 自定义            |
| 周模式    | 单滚轮 `LazyColumn` 列出今天前后各 12 周的周范围（如「6/29-7/5」），滚动停顿后第一可见项作为选中项 |
| 月模式    | 双滚轮 `LazyColumn`：左选年（当前年前后各 5 年），右选月（1-12），选中后取该月月初~月末 |
| 自定义模式  | 保留原两个 `DatePickerDialog` 分别选开始日与截止日，互拉约束（开始日不大于截止日）      |
| 模式切换行为 | 从自定义切到周/月时清空已选起止日，等用户在滚轮中选具体周/月                       |
| 自动识别模式 | `DateRangePickerModeDetector.detect(startDate, dueDate)` 根据起止日特征推断：周一~周日 → 周模式；月初~月末 → 月模式；其他 → 自定义 |
| TIMER 模式 | `showMode = false` 隐藏模式切换，仅保留自定义（归属日单选场景）                |

**应用范围**：
- `UnifiedTaskFormDialog` 的 TASK 模式起止日字段
- `UnifiedTaskFormDialog` 的 TIMER 模式归属日字段（`showMode = false`）
- `GanttDetailSheet` 的起止日编辑字段

> 起止日数据格式不变（`UnifiedTask.startDate` / `dueDate` 仍是 "yyyy-MM-dd"），甘特图、导图、计时视图无需任何改动即可自然跟随。

### 10.14 数据页模块（Dashboard）

`presentation/screens/dashboard/` 目录下实现数据统计与任务快捷管理，作为底部导航栏第五个 Tab。

**页面布局**（自上而下）：

| 区域       | 组件                   | 说明                                                         |
| ---------- | ------------------- | ---------------------------------------------------------- |
| 顶栏       | `TopAppBar`         | 标题"数据" + 三点菜单（数据管理 / 设置 / 退出登录）                            |
| 周报卡片     | `WeeklyReportCard`  | primaryContainer 背景，单行展示"完成 X/Y 任务 · 计时 X/Y 分钟"，点击进入历史报告 |
| 月份切换器    | `Row` + `IconButton` | ‹ 2026年7月 ›，左右切换月份                                         |
| 任务完成热力色带 | `HeatmapStrip`      | 按日分组统计已完成任务数，连续色带渐变                                        |
| 计时时长热力色带 | `HeatmapStrip`      | 按日分组统计计时秒数，连续色带渐变                                          |
| 项目任务区域   | `ProjectTaskSection` | 可折叠卡片，展开显示全部 PROJECT_TASK 任务，带"查看全部"入口                     |
| 习惯养成区域   | `HabitTaskSection`  | 可折叠卡片，只显示当前一个未完成 HABIT_TRACKER 任务，完成后自动显示下一个                |
| 目标设定区域   | `GoalTaskSection`   | 可折叠卡片，只显示当前一个未完成 GOAL_SETTING 任务                            |
| 入口卡片     | `Card`              | 未完成 / 归档 / 回收站 三个入口行                                      |

**三个 ViewModel 职责划分**：

| ViewModel               | 职责                                                                 |
| ----------------------- | ------------------------------------------------------------------ |
| `DashboardViewModel`    | 月份切换、热力色带数据（响应式）、设置项（显示已完成/滑动操作）、退出登录、数据导入导出清空               |
| `DataViewModel`         | 按任务类型分类查询（项目任务全量、习惯/目标仅当前一个），切换完成状态                                |
| `WeeklyReportViewModel` | 查询过去 30 天历史，调用 `RecommendationCalculator` 计算今日推荐值（一次性 flow，非持续观察） |

**热力色带算法**（`HeatmapStrip` + `calculateIntensities`）：

| 策略       | 说明                                                        |
| ---------- | --------------------------------------------------------- |
| 百分位数截断    | 用 p95 作为 maxValue，忽略最高 5% 异常值                              |
| 对数压缩       | `ln(value+1)/ln(p95+1)`，将指数级差距压缩为线性                        |
| 3 日滚动平均    | 取前后各 1 日窗口平均值，平滑日间波动，突出趋势                                 |
| 渲染天数      | 当月=今天日期，过往月份=整月，未来月份=0；未渲染部分以 30% 透明背景色填充                  |

**今日推荐算法**（`RecommendationCalculator`）：

| 步骤 | 说明                                                                 |
| -- | ------------------------------------------------------------------ |
| 1  | 聚合过去最多 30 天的每日统计（任务完成数 + 计时秒数）                                      |
| 2  | 按日期类型（工作日/周末）筛选，只参考与今天同类型的历史                                         |
| 3  | 同类日按日期降序，取从最近开始连续的同类日序列（相邻同类日间隔 ≤ 7 天）                               |
| 4  | 指数衰减加权平均（衰减系数 λ=0.2，越近权重越高）                                         |
| 5  | 同类日数据不足 3 个时返回默认推荐值（任务 3 个、计时 90 分钟）                                |

**设置弹窗**（`SettingsDialog`，从 ProfileScreen 迁移）：

- 显示已完成任务开关（持久化到 DataStore）
- 左滑操作配置：删除 / 完成 / 开始计时（`SwipeAction` 枚举）
- 右滑操作配置：删除 / 完成 / 开始计时

**数据管理弹窗**（`DataManagementDialog`，从 TaskFlowSettingsScreen 迁移）：

- 四态弹窗：主菜单 → 导出结果 / 导入输入 / 清空确认
- 导出：在 IO 线程执行数据库读取 + JSON 构建，避免阻塞主线程导致闪退
- 导入：粘贴 JSON 字符串，调用 `UnifiedTaskRepository.importData`
- 清空：二次确认，不可撤销

***

## 11. 后续扩展路线

### 11.1 已完成版本

| 阶段               | 内容                                           | 状态 |
| ---------------- | -------------------------------------------- | -- |
| v1.0 框架搭建        | 项目结构、Hilt、Room、Retrofit、Compose 导航           | ✅  |
| v1.0 核心功能        | 用户认证、计划 CRUD、计时器、已完成历史                       | ✅  |
| v1.0 兼容性修复       | API 24/25 通知渠道与 PBKDF2 回退                    | ✅  |
| v1.0 数据迁移修复      | 移除外键、会话失效守卫、数据库 v3                           | ✅  |
| v1.1 TaskFlow 模块 | 任务 CRUD、层级嵌套、排序、设置                           | ✅  |
| v1.2 后台计时        | 前台 Service 保活，通知栏实时显示剩余时间                    | ✅  |
| v1.2 计划模板        | 6 种预设模板，一键创建计划                               | ✅  |
| v1.3 安全增强        | PBKDF2 120K 迭代 + 自动升级、SQLCipher 数据库加密、统一输入校验 | ✅  |
| v1.3.1 加密修复     | `ensureFreshEncryptedDatabase` 改用文件头检测         | ✅  |
| v2.0 计时会话持久化     | TimerSession 单例表（v5）、AlarmScheduler 精确闹钟、BootReceiver 自启动、`computeRecovery` 恢复算法 | ✅  |
| v2.0 UI 完善      | ProfileScreen 个人中心、PlanFormDialog 表单弹窗、底部导航栏 | ✅  |
| v2.1 MindMap 模块  | 思维导图可视化（水平树布局、贝塞尔连线、节点状态色、长按菜单、父任务添加含防环、双指缩放） | ✅  |
| v2.2 任务日期过滤    | plans 表新增 `planDate` 字段 + `Migration6To7` + `DateUtil` + 计时页日期跳转按钮 | ✅  |
| v2.3 计时完成提醒    | 到点通知 → 10s 震动 → 20s 铃声循环，通知"停止"按钮取消；`VibrationHelper` 封装 | ✅  |
| v2.4 甘特图模块      | 本周任务甘特图排期可视化（GanttChart / GanttTaskBar / GanttDetailSheet） | ✅  |
| v2.5 任务表单重构    | 基础区（标题/优先级/起止日期）+ 可展开高级区（类型/进度/环境标签/链接/描述/指派人） | ✅  |
| v3.0 UnifiedTask 统一模型重构 | 三表合并为 `unified_tasks`（Room v9）、移除跨模块共享内核、所有任务可计时、领域枚举独立成文件 | ✅  |
| v3.1 软删除与回收站    | `deleted/deletedAt` 字段（v11）、TrashScreen 回收站恢复/永久删除/清空 | ✅  |
| v3.2 计时历史与数据页   | `timer_history` 表（v12）、DashboardScreen 周报卡片 + 双热力色带 + 任务分类区域 + 入口卡片 + 设置/数据管理弹窗 | ✅  |
| v3.3 任务模式切换     | `mode` 字段（v13）、ModeSwitchBar 四模式（休闲/计划/工作/生活）全局过滤 | ✅  |
| v3.4 终止累加计时     | `elapsedSeconds` 字段（v14），终止时累加本次计时秒数 | ✅  |
| v3.5 子任务提升快照    | `originalParentId/originalStartDate/originalDueDate`（v15），提升后可恢复 | ✅  |
| v3.6 重复任务       | `isRecurring/groupId`（v16）+ `recurrenceFrequency/recurrenceInterval`（v17），完成时滚动生成下一周期 | ✅  |
| v3.7 艾宾浩斯复习     | `RecurringTaskGenerator` 按 0/1/2/4/7/15/30/60 天间隔生成 8 个复习任务 | ✅  |
| v3.8 父子时间约束     | `ParentChildTimeConstraint` 子任务须等于或晚于祖先，级联调整子孙 | ✅  |
| v3.9 链接标题抓取     | `LinkTitleFetcher` + Jsoup 异步抓取页面标题 | ✅  |
| v3.10 统一表单与组件   | `UnifiedTaskFormDialog` 替代 Plan/Task 表单、`WheelDurationPicker` 滚轮时长选择 | ✅  |
| v3.11 项目/习惯专项页  | ProjectTaskScreen / HabitTaskScreen 按任务类型专项管理 | ✅  |
| v3.12 未完成页      | UncompletedScreen 未完成任务树形列表 | ✅  |
| v3.13 数据页完善     | 今日推荐算法（RecommendationCalculator 指数衰减加权）、热力色带算法（p95截断+对数压缩+滚动平均）、任务分类区域（项目/习惯/目标可折叠）、设置弹窗（滑动操作偏好）、数据管理弹窗（四态IO线程导出）、历史报告路由 | ✅  |
| v3.14 起止日期三模式选择器 | `TaskDateRangePickerSheet` 单字段 + ModalBottomSheet + 周/月/自定义 SegmentedButton，滚轮选周/月，自动识别模式；改造 `UnifiedTaskFormDialog`（TIMER/TASK）与 `GanttDetailSheet` 起止日字段 | ✅  |
| v4.2 备忘录模块      | 计时页下拉进入、列表页下拉返回、块编辑器（段落/标题/列表/待办/图片/链接/内部链接）、800ms 防抖自动保存、双后端可切换（app 私有目录 .md ↔ Obsidian vault 子目录自动迁移）、图片附件 wikilink 语法 | ✅  |
| v4.3 备忘录编辑器增强  | 待办列表 `- [ ]` / `- [x]` 语法、内部链接 wikilink（[[target]] 引用 + ![[target#heading]] 嵌入真渲染）、标题自动重命名文件、imePadding 键盘适配、块间距 0dp 紧凑布局 | ✅  |
| v4.4 应用使用统计   | `app_category` + `app_usage_record` 表（v18）、`AppUsageFetcher` ON_RESUME 采集、环形图展示、历史报告 Tab | ✅  |
| v4.5 桌面小组件     | Glance 实现 `TimerLauncherWidget`，模板预设 + 一键启动/停止，无需进入 App | ✅  |
| v4.6 周/月计划与跨类型关联 | `planParentId` 字段（v20）、`PlanScreen` 周/月计划页、普通任务反查关联展示 | ✅  |
| v4.7 历史报告与预测  | `HistoryReportScreen` 历史趋势、`ForecastCalculator` 预测、连续打卡日历图、小时热力图、悬崖倒计时 | ✅  |
| v4.8 主任务页合并与项目任务关联 | TaskFlow 主任务页合并展示 PROJECT_TASK / HABIT_TRACKER / 普通任务等可执行类型；`ProjectTaskScreen` 改造为周计划模板（按周筛选 + 前后翻页）；新增 `ProjectParentPickerDialog` 支持普通任务关联到项目任务（复用 `planParentId`）；`PlanParentBadge` 扩展为根据父任务 `taskType` 显示"周计划/月计划/项目任务"标签与配色；`DateRangeToolbar` 新增 `leading` 插槽支持二级页面返回按钮 | ✅  |
| v4.8.1 项目任务页关联展示与时间移除 | `ProjectTaskViewModel` 新增 `linkedTasksMap` StateFlow（收集 PROJECT_TASK ID → 关联的普通任务列表）与 `setPlanParent` 方法；`ProjectTaskScreen` 调用 `TaskTreeItem` 时传入 `linkedTasksMap` 与 `onUnlinkPlanParent`，使待办任务（DAILY_TASK 等）以折叠区形式显示在所关联项目任务卡片下方，与计划页面 PLAN_TASK 的展示方式保持一致；`TaskTreeComponents` 中 `TaskTreeItem` / `SimpleTaskTreeItem` 对 PROJECT_TASK 类型跳过日期范围渲染（项目任务卡片移除"开始-结束"时间显示） | ✅  |
| v4.8.2 项目任务页移除时间筛选与关联不限时段 | `ProjectTaskScreen` 顶部 `DateRangeToolbar`（周模式 + 前后翻页）替换为简单 `TopAppBar`（返回 + "项目任务"标题）；`ProjectTaskViewModel` 改用 `getTree` 查询全部 PROJECT_TASK（不再按 `weekRange` 过滤）、移除 `anchorDate/goToPrevWeek/goToNextWeek/goToThisWeek`；FAB 新建项目任务默认起止日期改为今天（不再预填本周一~周日）；`TaskFlowViewModel.projectTaskCandidates` 同样改用 `getTree` 拉取全量未完成 PROJECT_TASK（不再按当前周过滤且排除已完成任务），`UnifiedTaskFormDialog` 移除 `filterProjectCandidatesByDate` 二次日期过滤调用，`ProjectParentPickerDialog` 删除 `filterProjectCandidatesByDate` 函数与 `LocalDate` 导入——普通任务可关联到任意时间段的未完成项目任务 | ✅  |
| v4.8.3 项目任务编辑弹窗新增"完成"按钮与全局 Gradle 升级 | `UnifiedTaskFormDialog` 新增可选回调 `onComplete: ((UnifiedTask) -> Unit)?`，编辑模式 + 非 null 时在"取消"和"保存"按钮之间显示"完成"按钮（OutlinedButton，校验通过后通过回调传出任务对象）；`ProjectTaskScreen` 调用弹窗时传入 `onComplete`，回调内执行 `updateTask` + `toggleComplete` 完成保存并标记完成；环境配置：全局 Gradle 从 8.5 升级到 8.9（匹配 AGP 8.7.3 最低要求），安装路径 `C:\Users\Administrator\gradle\gradle-8.9`，用户 PATH 已更新指向新版本 | ✅  |
| v4.8.3 计时完成记录修复 | 修复"倒计时到点后未主动点完成导致计时未被统计"与"未关联任务的计时无历史记录"两个问题：`TimerForegroundService.handleCompletion` 到点时同步写入 `timer_history`（duration = 原时长）并对真实任务累加 `elapsedSeconds`；`TimerViewModel.completeTask` / `terminateTask` 与 `TimerAlarmReceiver.handleNotificationComplete` 对虚拟计时（stopwatch/preset_/recommended_/widget_）也写入 `timer_history`（跳过 `markCompleted`/`addElapsedSeconds`），userId 取当前登录用户；`computeActualDuration` 在超时模式下仅返回超时秒数（原时长已在到点时单独写入），避免与到点记录重复累加 | ✅  |
| v4.8.4 历史报告热力图与标签弹窗调整 | 三项改动：① `EnvironmentTagDetailDialog` 数据源从"历史出现过的标签"改为 `labelRatios.keys`（用户配置的全部环境标签），今日未完成的标签也显示（数量 0），按合理比例降序排序；② `HistoryReportViewModel.hourHeatmap` 从"选中自然月 + 周一~周日聚合"改为"过去 7 天 + 最近 7 天行布局"（新增 `heatmapDays`/`dayMs` 常量与 `pastDaysRangeMillis` 方法），与手机使用热力图保持一致，不再随月份切换变化；③ `HourHeatmapChart` 左侧标签从"一/三/五/日"改为动态日期（M/d），高产时段格式从 24 小时制（`9-11`）改为 12 小时制带 am/pm（`9am-12pm`），新增 `hourTo12Label` 函数处理边界（24 → 12am） | ✅  |
| v4.8.5 环境标签合理值双模式 | 新增 `LabelQuota`（mode + value）数据模型与 `LabelQuotaMode`（PERCENTAGE / WEEKLY_COUNT）枚举（`domain/model/LabelQuota.kt`）；`UserPreferences` 用 `labelQuotaFlow`/`saveLabelQuotas`/`resetLabelQuotas`/`DEFAULT_LABEL_QUOTAS` 替代原 `labelRatioFlow` 系列（DataStore key 从 `label_ratio` 改为 `label_quota`），默认值中社交从 4% 改为每周固定 2 个（WEEKLY_COUNT 模式），其余标签保持百分比模式；`DashboardViewModel`/`HistoryReportViewModel` 转发 `labelQuotas`；`AccountSettingsScreen` 原 `LabelRatioEditDialog` 重构为 `LabelQuotaEditDialog`，每个标签可用 `FilterChip` 切换"百分比/每周"模式并输入对应数值，底部仅统计百分比模式合计；`EnvironmentTagDetailDialog` 支持双模式：PERCENTAGE 沿用今日占比逻辑，WEEKLY_COUNT 显示"本周 X/N 个"并按本周一到今天累计（新增 `calcWeekDaysElapsed` 函数）计算状态（本周还需 / 超额 / 已达标） | ✅  |
| v4.8.6 归档/回收站甘特图化 | 归档页与回收站页改用甘特图页面模板（新增 `ArchiveTrashGanttTemplate.kt`）：归档页按 `completedAt` 定位任务条、回收站页按 `deletedAt` 定位（新增 `GanttItemBuilder.kt`，支持自定义 `dateExtractor` 构建单日锚点甘特条）；`GanttChart` / `GanttTaskBar` / `GanttDetailSheet` 的拖拽回调改为可空（`onTaskDragEnd` / `onDragEnd` 为 null 时禁用拖拽，归档/回收只读）；移除两页的 FAB 新建按钮，保留顶栏"清空"操作；详情弹窗复用 `GanttDetailSheet`，新增 `onReactivate`（归档页"重新激活"按钮）与 `onRestore`（回收站页"恢复"按钮）可选回调；回收站永久删除带二次确认弹窗；`CompletedViewModel` / `TrashViewModel` 重写为基于 `observeCompletedTasks` / `observeTrashedTasks` + 月份锚点 + 折叠状态生成甘特任务条列表 | ✅ |
| v4.9.0 思维导图图谱视图 | 思维导图新增 Obsidian Graph 风格图谱视图并支持双视图切换：`ForceGraphCanvas.kt` 实现径向树布局（`GraphRadialSim`，子任务按叶节点比例瓜分父节点角度扇区、逐层向外、连线零交叉，节点半径随子孙数增长 7→15dp，环间距 80dp，动画平滑过渡）；`MindMapScreen.kt` 顶栏新增"树形/图谱"视图切换，长按节点折叠子树在两种视图下通用 | ✅ |

### 11.2 未来扩展

| 优先级 | 模块      | 说明                                      |
| --- | ------- | --------------------------------------- |
| 高   | 任务到期提醒  | 复用 AlarmScheduler，任务 dueDate 到期触发通知      |
| 高   | 任务搜索    | 按标题/描述/指派人关键词搜索                         |
| 高   | 远程同步    | WorkManager 后台同步，Retrofit API 对接        |
| 高   | 测试覆盖    | 单元测试 Repository，UI 测试 Compose           |
| 中   | 主题系统    | 动态取色 + 浅色/深色/跟随系统                       |
| 中   | 国际化     | strings.xml 多语言                         |
| 低   | Wear OS | 计时器通知 + 简易控制                            |

***

## 12. 附录：注释规范

本规范是项目所有 `.kt` 文件的注释基线，源代码 KDoc 可通过 `@see README#附录：注释规范` 引用本节。

### 12.1 KDoc 三段式格式

```kotlin
/**
 * 首句：一句话概括职责，陈述句式，不以"这个类"开头。
 *
 * 详述段：复杂逻辑用要点列表，强调"为什么这样设计"而非"做了什么"。
 * - 设计权衡点 1
 * - 设计权衡点 2
 *
 * @param taskId 任务 ID
 * @return 修改后的实体，若冲突放弃则返回 null
 * @see UnifiedTaskRepository
 */
```

### 12.2 三级注释要求

| 层级  | 要求                                                                          |
| --- | --------------------------------------------------------------------------- |
| 类级  | 必加：职责 + 关键不变式（Invariant）                                                  |
| 方法级 | public 方法必加；私有方法仅当逻辑非平凡时加。需说明输入约定、返回语义、副作用（开事务/发 Flow）                      |
| 属性级 | 仅当类型/语义不明显时加（如状态标记字段、加密密钥字节）                                                |

### 12.3 行内注释使用时机

**应使用**（解释"为什么"）：

```kotlin
// 幂等检查：Room Flow 多次发射可能导致同一操作被重复执行
if (existingLinks.isNotEmpty()) return
```

**不应使用**（复述字面语义）：

```kotlin
// 不要写这种注释
val taskId = entity.taskId  // 获取 taskId
```

### 12.4 中英文策略

- **中文为主**：所有 KDoc 正文、行内注释使用中文（与现有代码一致）
- **专有名词保留英文**：PBKDF2、Mutex、SharedFlow、Room、Hilt、AlarmManager、SQLCipher 等
- **算法格式串保留英文**：`v2:algorithm:iterations:salt:hash`、`"SQLite format 3\0"`
- **代码标识符用英文**：类名、方法名、变量名均为英文，注释引用时直接使用，无需翻译

### 12.5 禁止事项

- ❌ 注释掉的代码块（dead code）—— 应直接删除
- ❌ 解释显而易见代码的废话注释 —— 删除
- ❌ 与代码实现不一致的注释 —— 修改代码时同步更新
- ❌ `TODO`/`FIXME` 不带 issue 链接 —— 应改为带链接或直接实现
- ❌ 嵌套块注释包含 `/*` —— Kotlin 不支持嵌套块注释

***

> 本文档由项目维护者按代码实际状态同步更新。修改代码时若涉及架构/模块/构建配置变更，请同步更新对应章节，避免再次脱节。
