# 爱日常 CaraneLoveLife

情侣互动 Android 应用:恋爱天数、纪念日倒计时、共同愿望清单与甜甜日记,纯本地存储。

## 技术栈

- Kotlin 1.9.22 / AGP 8.2.2 / Gradle 8.5 / JDK 21(AS 内置 JBR)
- compileSdk 34 / minSdk 26 / targetSdk 34
- Material 3(Theme.Material3.DayNight)+ ViewBinding + 协程
- Room 2.6.1(KSP)+ SharedPreferences 封装(PrefsManager)
- 配色:克莱因蓝 v2.0 规范(明:蓝调灰 #F2F5FA;暗:深蓝黑 #0D1117;强调色:暖铜)

## 功能

| 页面 | 说明 |
|---|---|
| 首页 | 恋爱天数、下一个纪念日倒计时、愿望完成度、日记篇数 |
| 纪念日 | 添加/编辑/删除,支持每年重复,自动计算倒计时/已过天数 |
| 清单 | 共同愿望打卡,未完成在前 |
| 日记 | 按日期倒序记录,点击编辑 |
| 我的 | 情侣昵称、恋爱起始日期、明/暗/跟随系统主题 |

## 编译

### 依赖源(强制镜像)

`settings.gradle.kts` 已强制阿里云镜像优先(google/public/central/gradle-plugin),官方源仅兜底;
Gradle wrapper 发行版同样走阿里云镜像(`gradle/wrapper/gradle-wrapper.properties`)。

### 本机环境说明(重要)

本机 AS 内置 jbr 已升级为 **JDK 25**、系统 JDK 为 23,均超出 AGP 8.2.2 支持范围(17~21)。
构建必须使用本机现存的 **JDK 21**:`C:\Users\l\.jdks\jbr-21.0.11`。

### 命令行构建(全局 Gradle 8.5 + JDK 21)

```powershell
$env:JAVA_HOME='C:\Users\l\.jdks\jbr-21.0.11'
& 'D:\Androidstudio\gradle\gradle-8.5\bin\gradle.bat' assembleDebug --console=plain
```

备选:全局 8.14.5 实测可用(`D:\Androidstudio\gradle\gradle-8.14.5`);wrapper 兜底(发行版走阿里云镜像,已缓存)

APK 输出:`app/build/outputs/apk/debug/app-debug.apk`(已验证可构建)

或直接用 Android Studio 打开工程构建(请在 AS 中将 Gradle JDK 指向上述 JDK 21)。

## 工程结构

```
app/src/main/java/com/caranelovelife/
├── App.kt                  # 全局单例(数据库/仓库/偏好)
├── core/
│   ├── data/               # PrefsManager + 三个仓库
│   └── db/                 # Room 实体/DAO/数据库
├── ui/
│   ├── main/               # 底部导航主界面
│   ├── home/               # 首页
│   ├── anniversary/        # 纪念日
│   ├── wish/               # 愿望清单
│   ├── diary/              # 日记
│   └── mine/               # 我的
└── util/                   # DateUtils
```

## 备注

- `gradle.properties`、命名规范等遵循《项目基础要求》
- 配色 Token 全量落地 `values/colors.xml` + `values-night/colors.xml`
- 字符串全量中文,英文放 `values-en/`
- Release 已开启混淆(`proguard-rules.pro`);签名 keystore 按规范单独交付,不入库
