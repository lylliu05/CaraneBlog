param(
    [Parameter(HelpMessage = "单应用更新说明，如 '1.修复XX 2.新增XX'（配合 -App 使用）")]
    [string]$UpdateLog,

    [Parameter(HelpMessage = "应用包名，默认 com.caranelovelife")]
    [string]$App = "com.caranelovelife",

    [Parameter(HelpMessage = "多应用批量更新，哈希表格式：@{ 'com.caranelovelife'='1.修复XX'; 'com.caraneplan.app'='2.新增XX' }")]
    [hashtable]$UpdateLogs,

    [Parameter(HelpMessage = "Git 提交信息，默认 '更新应用'")]
    [string]$Message = "更新应用",

    [Parameter(HelpMessage = "是否强制更新（仅单应用模式生效）")]
    [switch]$ForceUpdate
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$configFile = Join-Path $root "scripts\update-config.json"
$dlDir = Join-Path $root "downloads"

# 文件名前缀 → 包名 映射（用于自动检测）
$pkgMap = @{
    "CaraneLoveLife" = "com.caranelovelife"
    "CaranePlan"     = "com.caraneplan.app"
    "CaraneVideo"    = "com.caranevideo.app"
    "Tempo"          = "com.tempo.app"
}

# ---------- 收集需要更新的应用（包名 → 更新说明） ----------
$targets = @{}

if ($UpdateLogs -and $UpdateLogs.Count -gt 0) {
    # 模式一：批量传入
    foreach ($k in $UpdateLogs.Keys) {
        $targets[$k] = $UpdateLogs[$k]
    }
} elseif ($UpdateLog) {
    # 模式二：单应用快捷
    $targets[$App] = $UpdateLog
} else {
    # 模式三：自动检测 + 交互输入
    Write-Host "=== 自动检测 downloads/ 中的应用 ===" -ForegroundColor Cyan

    # 按文件名前缀分组，取每组版本号最大的
    $groups = @{}
    Get-ChildItem $dlDir -Filter "*.apk" | ForEach-Object {
        $name = $_.BaseName
        # 提取前缀（第一个 v 之前的部分）
        $idx = $name.IndexOf("v")
        $prefix = if ($idx -gt 0) { $name.Substring(0, $idx) } else { $name }
        if (-not $groups.ContainsKey($prefix)) { $groups[$prefix] = @() }
        $groups[$prefix] += $_
    }

    $detected = @()
    foreach ($prefix in $groups.Keys | Sort-Object) {
        $latest = $groups[$prefix] | Sort-Object { $_.BaseName } -Descending | Select-Object -First 1
        $pkg = if ($pkgMap.ContainsKey($prefix)) { $pkgMap[$prefix] } else { $null }
        $detected += [PSCustomObject]@{
            Prefix = $prefix
            File   = $latest.Name
            Pkg    = $pkg
        }
    }

    if ($detected.Count -eq 0) {
        throw "downloads/ 中没有找到 APK 文件"
    }

    Write-Host ""
    for ($i = 0; $i -lt $detected.Count; $i++) {
        $d = $detected[$i]
        $pkgDisplay = if ($d.Pkg) { $d.Pkg } else { "（未知包名，需手动输入）" }
        Write-Host ("  [{0}] {1}  →  {2}" -f ($i + 1), $d.File, $pkgDisplay)
    }
    Write-Host ""

    # 让用户选择要更新哪些应用
    $selection = Read-Host "输入要更新的序号（多个用逗号分隔，直接回车=全部）"
    if ([string]::IsNullOrWhiteSpace($selection)) {
        $selectedIdx = 0..($detected.Count - 1)
    } else {
        $selectedIdx = $selection -split "," | ForEach-Object { [int]($_.Trim()) - 1 } | Where-Object { $_ -ge 0 -and $_ -lt $detected.Count }
    }

    Write-Host ""
    foreach ($idx in $selectedIdx) {
        $d = $detected[$idx]
        $pkg = $d.Pkg
        if (-not $pkg) {
            $pkg = Read-Host "请输入 $($d.Prefix) 的包名"
        }
        $log = Read-Host "请输入 $($d.File) 的更新说明"
        if (-not [string]::IsNullOrWhiteSpace($log)) {
            $targets[$pkg] = $log
        }
    }
}

if ($targets.Count -eq 0) {
    throw "没有需要更新的应用"
}

# ---------- 写入 update-config.json ----------
if (-not (Test-Path $configFile)) {
    throw "找不到 $configFile"
}

$config = Get-Content $configFile -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $config.apps) {
    $config | Add-Member -NotePropertyName apps -NotePropertyValue ([PSCustomObject]@{})
}

foreach ($pkg in $targets.Keys) {
    $log = $targets[$pkg]
    $existing = $config.apps.$pkg
    $isForce = if ($UpdateLog -and $App -eq $pkg) { $ForceUpdate.IsPresent } else { if ($existing) { [bool]$existing.forceUpdate } else { $false } }

    $entry = [PSCustomObject]@{
        updateLog         = $log
        forceUpdate       = $isForce
        minSupportVersion = if ($existing -and $existing.minSupportVersion -ne $null) { $existing.minSupportVersion } else { 0 }
    }

    # 保留已有其他字段
    if ($existing) {
        foreach ($p in $existing.PSObject.Properties) {
            if ($p.Name -notin @("updateLog", "forceUpdate", "minSupportVersion")) {
                $entry | Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value
            }
        }
    }

    $config.apps.PSObject.Properties.Remove($pkg)
    $config.apps | Add-Member -NotePropertyName $pkg -NotePropertyValue $entry
    Write-Host "已配置 $pkg → $log" -ForegroundColor Green
}

# 写回 UTF-8 无 BOM
$json = $config | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($configFile, $json + "`n", (New-Object System.Text.UTF8Encoding $false))

# ---------- Git 提交与推送 ----------
Set-Location $root
git add .
if ($LASTEXITCODE -ne 0) { throw "git add 失败" }

git commit -m $Message
if ($LASTEXITCODE -ne 0) { throw "git commit 失败" }

git pull --rebase
if ($LASTEXITCODE -ne 0) { throw "git pull --rebase 失败，请手动解决冲突" }

git push
if ($LASTEXITCODE -ne 0) { throw "git push 失败" }

Write-Host "`n推送成功！GitHub Actions 将在 1-2 分钟内重新生成 apps.json" -ForegroundColor Green
