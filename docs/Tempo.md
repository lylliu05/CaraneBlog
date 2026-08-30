# Tempo · 黄历

> 天时 + 地利 + 人事 → 专属建议

Tempo 是一款与传统黄历截然不同的 Android 应用。传统黄历仅基于"天时"给出通用宜忌，而 Tempo 在天时之外引入**地利**（节气 / 方位 / 宜忌）与**人事**（精力 / 情绪 / 当日要事）三个维度，生成每日专属简报，让用户获得"被理解"的体验。

## 核心差异

| 维度 | 传统黄历 App | Tempo |
|------|-------------|-------|
| 核心逻辑 | 天时 → 通用建议 | 天时 + 地利 + 人事 → 专属建议 |
| 首页内容 | 宜忌列表 + 运势分数 | 四 Tab 结构：天时 / 地利 / 人和 / 过往 |
| 用户粘性来源 | 习惯（每天查） | 习惯 + 被理解的感受 + 趋势可视化 |
| 数据资产 | 无 | 用户的个人运势日记 + 趋势统计 |
| 竞争壁垒 | 低（数据都一样） | 高（数据 + 算法 + 用户体验） |

## 功能概览

底部导航四 Tab：

### 天时

整页卦象底纹 + 卦象卡。基于梅花易数时间起卦法，由当前农历年月日时算出本卦与动爻，展示卦名、干支日期、时辰、卦辞、象传、今解与动爻爻辞。

### 地利

- **当前节气** — 基于天文算法精确推算，显示当前节气与距下个节气的天数
- **神方位** — 喜神 / 财神 / 福神方位（按日干推算）
- **今日宜** — 卦象基调 × 日干组合推导
- **今日忌** — 同上

### 人和

- **当下状态入口** — 点击弹出 BottomSheet 录入精力 / 情绪 / 事件
- **精力滑块** — 1-10 离散滑块
- **情绪点选** — 😊 愉悦 / 😐 平静 / 😟 低落
- **事件输入** — 一句话写下"今天最重要的一件事"（选填）
- **生成简报** — 结合卦象基调与用户状态生成专属建议（天时解读 + 人事应对 + 事件提示 + 动爻时位）
- **保存到运势日记** — 简报可持久化保存

### 过往

- **摘要卡** — 累计记录天数 + 起始日期
- **情绪趋势热图** — 按月色块强度呈现（色越深越愉悦）
- **精力趋势热图** — 按月色块强度呈现（色越深精力越足）
- **卦象分布** — 水平条形图，按出现次数排序
- **日记列表** — 按时间倒序展示每条日记的卦象与简报标题

## 技术栈

- **Kotlin** + **Jetpack Compose**（Material3）
- **MVVM 架构**：ViewModel + StateFlow 单向数据流
- **DataStore Preferences**：用户状态 + 运势日记持久化
- **手工 DI**：AppContainer 轻量依赖容器，不引入 Hilt
- **协程 Flow**：时辰自动刷新、日记推流订阅
- **最低 SDK 26**（Android 8.0），目标 SDK 34

## 核心算法

### 起卦（梅花易数 · 时间起卦法）

```
上卦 = (年支数 + 农历月数 + 农历日数) % 8     // 0 视作 8
下卦 = (年支数 + 农历月数 + 农历日数 + 时支数) % 8
动爻 = (年支数 + 农历月数 + 农历日数 + 时支数) % 6  // 0 视作 6
```

- 八卦对应先天序：乾 1、兑 2、离 3、震 4、巽 5、坎 6、艮 7、坤 8
- 同一时刻起卦结果确定（deterministic），保证用户当天看到的卦象稳定
- 农历转换覆盖 1900-2099 年，采用紧凑位编码表
- 日柱干支以 2000-01-07（甲子日）为基准，按公历天数累加

### 节气精确计算（寿星天文历简化版）

- 基于 VSOP87 截断级数计算太阳视黄经
- 牛顿迭代法求解太阳黄经达到目标值对应的 JDE
- 修正章动与光行差
- 精度：节气时刻误差通常 < 1 分钟，足以支撑月建判断

### 月柱干支（五虎遁元）

- 月建按节气：立春→寅月、惊蛰→卯月、清明→辰月……
- 年柱以立春为分界
- 月干口诀：甲己之年丙作首，乙庚之岁戊为头，丙辛之岁寻庚上，丁壬壬寅顺水流，戊癸何方发，甲寅之上好推求

### 黄历宜忌与神方位

- 宜忌基于卦象基调（六种）与日柱干支组合推导
- 神方位（喜神 / 财神 / 福神）按日干定方位，采用传统"日干逢神"口诀

### 简报生成

将 64 卦归纳为六种**卦象基调**作为天时与人事的桥接维度：

| 基调 | 含义 |
|------|------|
| 进取 | 主动出击 |
| 守成 | 静养待时 |
| 变革 | 破旧立新 |
| 通达 | 沟通协作 |
| 化解 | 舒解困局 |
| 警慎 | 谨慎从事 |

简报由四段组成：
- **【天时】** 卦象的现代释义
- **【人事】** 精力 × 情绪 × 卦象基调的组合建议
- **【今日之事】** 基于关键词匹配的事件提示（会议/面试/约会/运动/创作/决策/休整）
- **【动爻】** 动爻时位（事初/事中/事末）对应的行为倾向

### 时辰自动刷新

- 每 5 分钟检查一次时辰变化
- 同日跨时辰：仅更新时辰显示
- 跨日：自动重新起卦并刷新地利信息

## 项目结构

```
app/src/main/java/com/tempo/app/
├── data/
│   ├── local/
│   │   └── HexagramDataSet.kt          # 64 卦静态数据
│   ├── model/
│   │   ├── Hexagram.kt                 # 卦象/八卦/爻 数据模型
│   │   ├── Emotion.kt                  # 情绪枚举
│   │   ├── UserState.kt                # 用户输入状态
│   │   ├── DailyBriefing.kt            # 每日简报
│   │   └── DiaryEntry.kt               # 日记条目
│   └── repository/
│       ├── HexagramRepository.kt       # 卦象数据仓库
│       ├── DiaryRepository.kt          # 运势日记仓库（DataStore）
│       └── UserStateRepository.kt      # 用户状态仓库（DataStore）
├── domain/
│   ├── LunarCalendar.kt                # 公历转农历 + 干支推算
│   ├── SolarTerms.kt                   # 二十四节气精确计算
│   ├── HexagramEngine.kt               # 起卦引擎
│   ├── BriefingGenerator.kt            # 简报生成算法
│   ├── AlmanacEngine.kt                # 黄历宜忌 + 神方位引擎
│   └── DiaryStats.kt                   # 历史日记统计
├── di/
│   └── AppContainer.kt                 # 依赖容器
├── ui/
│   ├── theme/
│   │   ├── Color.kt                    # 水墨纸本配色
│   │   ├── Theme.kt                    # 主题入口
│   │   └── Type.kt                     # 字体规格
│   └── home/
│       ├── HomeScreen.kt               # 首页（Scaffold + 底部导航）
│       ├── HomeViewModel.kt            # 首页 ViewModel
│       ├── HomeUiState.kt              # 首页 UI 状态
│       └── components/
│           ├── BottomNav.kt            # 底部导航栏
│           ├── TabPages.kt             # 天时/地利/人和页
│           ├── HistoryPage.kt          # 过往页（数据可视化）
│           ├── HexagramCard.kt         # 卦象卡片
│           ├── HexagramFigure.kt       # 六爻图绘制
│           ├── PersonalInputSheet.kt   # 个人状态录入弹窗
│           ├── EnergyInputSection.kt   # 精力滑块
│           ├── EmotionSelector.kt      # 情绪点选
│           ├── EventInputField.kt      # 事件输入
│           └── BriefingResult.kt       # 简报展示
├── MainActivity.kt
└── TempoApplication.kt
```

## 设计语言

**水墨极简**：纸色背景 + 墨色文字 + 朱砂一抹作为强调色。

- 全局低饱和度，避免视觉噪声
- 朱砂红仅在"选中/激活/重要"状态出现
- 不使用渐变与装饰色块
- 四 Tab 底部导航，低认知负荷
- 天时页整页卦象底纹（不透明度 0.12），前景透明卡片

## 构建与运行

### 环境要求

- Android Studio Hedgehog (2023.1) 或更高版本
- JDK 17
- Android SDK 34（compileSdk）
- Gradle 8.2（已包含 wrapper）

### 构建命令

```bash
# Windows
.\gradlew.bat assembleDebug

# macOS / Linux
./gradlew assembleDebug
```

生成的 APK 位于：`app/build/outputs/apk/debug/app-debug.apk`

### 发行版构建

```bash
# Windows
.\gradlew.bat assembleRelease

# macOS / Linux
./gradlew assembleRelease
```

生成的 APK 位于：`app/build/outputs/apk/release/app-release.apk`

### 在 Android Studio 中运行

1. 用 Android Studio 打开项目根目录
2. 等待 Gradle 同步完成
3. 连接 Android 设备或启动模拟器（API 26+）
4. 点击 Run 按钮

## 数据说明

- **64 卦数据**：卦辞、象传取自《周易》通行本；今解为面向 Tempo 用户的白话简释
- **用户状态**：使用 DataStore Preferences 存储，按 dateKey 覆盖，防抖 1 秒写盘
- **运势日记**：使用 DataStore Preferences 存储，同日覆盖，Base64 编码字段以 `|` 分隔
- **节气数据**：实时天文计算，无内置查表，精度 < 1 分钟
