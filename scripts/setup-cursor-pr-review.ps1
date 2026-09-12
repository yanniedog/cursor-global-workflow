# Set CURSOR_API_KEY — superseded by Qwen self-hosted review secrets.
# Prefer: .\setup-qwen-pr-review.ps1
param(
    [string]$ApiKey = $env:CURSOR_API_KEY,
    [string]$CodeRoot = (Join-Path $env:USERPROFILE 'code'),
    [switch]$PushRepos,
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

Write-Host 'NOTE: PR review now uses Qwen (setup-qwen-pr-review.ps1), not Cursor Auto.'
Write-Host 'This script only sets CURSOR_API_KEY if you still need it for other tooling.'
Write-Host ''

if (-not $ApiKey) {
    Write-Host 'Create an API key at https://cursor.com/dashboard (API Keys).'
    $secure = Read-Host 'Paste CURSOR_API_KEY' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $ApiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

if (-not $ApiKey) {
    throw 'CURSOR_API_KEY is required.'
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'gh CLI is required (gh auth login).'
}

$repos = @()
foreach ($name in Get-ChildItem -Path $CodeRoot -Directory) {
    $gitDir = Join-Path $name.FullName '.git'
    if (-not (Test-Path $gitDir)) { continue }
    Push-Location $name.FullName
    try {
        $remote = git remote get-url origin 2>$null
        if (-not $remote) { continue }
        $slug = (gh repo view --json nameWithOwner -q .nameWithOwner 2>$null)
        if ($slug) { $repos += $slug }
    } finally {
        Pop-Location
    }
}

$repos = $repos | Sort-Object -Unique
Write-Host "Setting CURSOR_API_KEY on $($repos.Count) repos..."
$set = 0
foreach ($slug in $repos) {
    if ($WhatIf) {
        Write-Host "[what-if] gh secret set CURSOR_API_KEY --repo $slug"
        continue
    }
    gh secret set CURSOR_API_KEY --repo $slug --body $ApiKey | Out-Null
    $set++
    Write-Host "[ok] $slug"
}

Write-Host ''
Write-Host "Secrets set on $set repos."
Write-Host 'For Qwen PR reviews, run: .\setup-qwen-pr-review.ps1'

if ($PushRepos) {
    & (Join-Path $PSScriptRoot 'bootstrap-all-repos.ps1') -CodeRoot $CodeRoot -Commit -Push
}
