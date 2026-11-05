param(
    [Parameter(HelpMessage = "版本号，默认读 PC 工程 tauri.conf.json 里的 version")]
    [string]$Version,

    [Parameter(HelpMessage = "更新日志（支持多行）；不填用默认文案")]
    [string]$Notes,

    [Parameter(HelpMessage = "强制更新：客户端不给「稍后」")]
    [switch]$Force,

    [Parameter(HelpMessage = "最低支持版本，例如 0.1.0；低于它的客户端强制更新")]
    [string]$MinSupport,

    [Parameter(HelpMessage = "PC 工程目录")]
    [string]$PcRoot = "E:\Project\CaranePlan\CaranePcPlan",

    [Parameter(HelpMessage = "GitHub 仓库 owner/repo")]
    [string]$Repo = "lylliu05/CaraneBlog",

    [Parameter(HelpMessage = "GitHub Token（需 repo 权限），默认取环境变量 GITHUB_TOKEN")]
    [string]$Token = $env:GITHUB_TOKEN,

    [Parameter(HelpMessage = "只建本地 tag，不推送、不建 release")]
    [switch]$NoPush,

    [Parameter(HelpMessage = "只打印将要执行的动作，不改任何东西")]
    [switch]$DryRun
)

# ============================================================
# PC 端发版脚本（GitHub Releases）
#
# 客户端（CaranePcPlan/src-tauri/src/update.rs）检查的是：
#   https://api.github.com/repos/<Repo>/releases
# 过滤 tag 前缀 pc-v，取语义化版本最大的一个，下载名字含 setup 的 .exe。
#
# 用法：
#   $env:GITHUB_TOKEN = "ghp_xxx"                  # 只需配一次（新终端要重配）
#   .\publish-pc.ps1 -Notes "1.修复XX 2.新增XX"
#   .\publish-pc.ps1 -Notes "..." -Force           # 强制更新
#   .\publish-pc.ps1 -Notes "..." -MinSupport 0.1.0
#   .\publish-pc.ps1 -DryRun                       # 先看看会做什么
#
# 注意：发版前先把 PC 工程版本号改好并重新打包：
#   cd E:\Project\CaranePlan\CaranePcPlan
#   npm run tauri build
# ============================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "    $msg" -ForegroundColor Green }

# ---------- 1. 版本号 ----------
if (-not $Version) {
    $confPath = Join-Path $PcRoot "src-tauri\tauri.conf.json"
    if (-not (Test-Path $confPath)) { throw "找不到 $confPath，请用 -Version 指定版本号" }
    $Version = (Get-Content $confPath -Raw -Encoding UTF8 | ConvertFrom-Json).version
}
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "版本号格式应为 x.y.z，当前：$Version"
}
$tag = "pc-v$Version"
Write-Step "版本 $Version，tag $tag"

# ---------- 2. 找安装包 ----------
$nsisDir = Join-Path $PcRoot "src-tauri\target\x86_64-pc-windows-gnu\release\bundle\nsis"
$expected = Join-Path $nsisDir "卡烷计划PC_${Version}_x64-setup.exe"
if (Test-Path $expected) {
    $setup = Get-Item $expected
} else {
    # 版本号没跟着改时，退回取最新构建的安装包（并提醒）
    $setup = Get-ChildItem $nsisDir -Filter "*_x64-setup.exe" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $setup) { throw "没有找到安装包，请先执行：cd $PcRoot; npm run tauri build" }
    Write-Warning "没找到 $($expected | Split-Path -Leaf)，改用最新构建：$($setup.Name)"
    Write-Warning "如果你刚改了版本号，请重新打包，否则安装包内容与版本号不一致"
}
$sizeMB = [math]::Round($setup.Length / 1MB, 2)
Write-Ok "安装包：$($setup.FullName)（$sizeMB MB）"

# ---------- 3. 规范化附件名 ----------
$assetName = "CaranePlanPC-$Version-x64-setup.exe"
$stageDir = Join-Path $root "release-assets"
$assetPath = Join-Path $stageDir $assetName
Write-Step "附件名 $assetName"

# ---------- 4. release 正文 ----------
$log = if ([string]::IsNullOrWhiteSpace($Notes)) { "优化体验，修复已知问题" } else { $Notes.Trim() }
$bodyLines = @($log)
if ($Force) { $bodyLines += "forceUpdate: true" }
if ($MinSupport) { $bodyLines += "minSupportVersion: $MinSupport" }
$body = ($bodyLines -join "`n")
Write-Step "更新日志"
Write-Host $body -ForegroundColor Gray

if ($DryRun) {
    Write-Step "DryRun：不写文件、不建 tag、不发请求"
    Write-Ok "会复制到 $assetPath"
    Write-Ok "会创建 tag $tag（并推送）"
    Write-Ok "会创建 release 并上传该附件"
    exit 0
}

# ---------- 5. 暂存附件 ----------
if (-not (Test-Path $stageDir)) { New-Item -ItemType Directory -Path $stageDir | Out-Null }
Copy-Item $setup.FullName $assetPath -Force
Write-Ok "已暂存到 $assetPath"

# ---------- 6. 建 tag 并推送 ----------
Write-Step "创建 git tag"
Set-Location $root
$existingTag = git tag --list $tag
if ($existingTag) {
    Write-Ok "tag $tag 已存在，跳过创建"
} else {
    git tag $tag
    if ($LASTEXITCODE -ne 0) { throw "git tag 失败" }
    Write-Ok "已创建 $tag"
}
if ($NoPush) {
    Write-Ok "-NoPush：不推送 tag、不创建 release"
    exit 0
}
git push origin $tag
if ($LASTEXITCODE -ne 0) { throw "推送 tag 失败（检查网络/权限，或先 git pull --rebase）" }
Write-Ok "tag 已推送"

# ---------- 7. 调 GitHub API 建 release ----------
if (-not $Token) {
    throw @"
缺少 GitHub Token。请到 https://github.com/settings/tokens 新建一个带 repo 权限的 token，然后：
  `$env:GITHUB_TOKEN = "ghp_xxxx"
再重新执行本脚本（或者直接在网页上创建 release，效果相同）。
"@
}

$headers = @{
    Authorization          = "Bearer $Token"
    Accept                 = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
    "User-Agent"           = "CaranePublish-PC"
}

Write-Step "创建/复用 release $tag"
$release = $null
try {
    $payload = @{
        tag_name   = $tag
        name       = "卡烷计划PC $Version"
        body       = $body
        draft      = $false
        prerelease = $false
    } | ConvertTo-Json -Depth 5
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases" -Method Post `
        -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) -ContentType "application/json; charset=utf-8"
    Write-Ok "已创建 release：$($release.html_url)"
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 422) {
        Write-Ok "该 tag 的 release 已存在，改为向它上传附件"
        $all = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases?per_page=50" -Headers $headers
        $release = $all | Where-Object { $_.tag_name -eq $tag } | Select-Object -First 1
        if (-not $release) { throw "tag $tag 已有 release 但查询不到，请到网页手动处理" }
        Write-Ok "复用：$($release.html_url)"
    } else {
        throw "创建 release 失败（HTTP $status）：$($_.ErrorDetails.Message)"
    }
}

# ---------- 8. 上传附件 ----------
Write-Step "上传附件 $assetName"
$already = $release.assets | Where-Object { $_.name -eq $assetName }
if ($already) {
    Write-Ok "附件已存在，跳过上传（如需替换请先在网页删除）"
} else {
    $uploadUri = "https://uploads.github.com/repos/$Repo/releases/$($release.id)/assets?name=$assetName"
    Invoke-RestMethod -Uri $uploadUri -Method Post -Headers $headers `
        -InFile $assetPath -ContentType "application/octet-stream" | Out-Null
    Write-Ok "上传完成"
}

Write-Host ""
Write-Host "发版完成：$($release.html_url)" -ForegroundColor Green
Write-Host "客户端下次启动（或点顶栏版本号）即可检测到 $Version" -ForegroundColor Green
