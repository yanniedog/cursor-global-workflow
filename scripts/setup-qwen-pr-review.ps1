# Set Qwen PR review secrets on GitHub repos for cursor-auto-pr-review workflow.
param(
    [string]$BaseUrl = $(if ($env:QWEN_API_BASE_URL) { $env:QWEN_API_BASE_URL } else { 'http://127.0.0.1:11434/v1' }),
    [string]$ApiKey = $env:QWEN_API_KEY,
    [string]$Model = $(if ($env:QWEN_MODEL) { $env:QWEN_MODEL } else { 'qwen3-coder:30b' }),
    [string]$CodeRoot = (Join-Path $env:USERPROFILE 'code'),
    [switch]$PushRepos,
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

if (-not $BaseUrl) {
    throw 'QWEN_API_BASE_URL is required.'
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
Write-Host "Setting Qwen review secrets on $($repos.Count) repos..."
$set = 0
foreach ($slug in $repos) {
    if ($WhatIf) {
        Write-Host "[what-if] gh secret set QWEN_API_BASE_URL --repo $slug"
        Write-Host "[what-if] gh secret set QWEN_MODEL --repo $slug"
        if ($ApiKey) { Write-Host "[what-if] gh secret set QWEN_API_KEY --repo $slug" }
        continue
    }
    gh secret set QWEN_API_BASE_URL --repo $slug --body $BaseUrl | Out-Null
    gh secret set QWEN_MODEL --repo $slug --body $Model | Out-Null
    if ($ApiKey) {
        gh secret set QWEN_API_KEY --repo $slug --body $ApiKey | Out-Null
    }
    $set++
    Write-Host "[ok] $slug"
}

Write-Host ''
Write-Host "Secrets set on $set repos (model=$Model)."
Write-Host 'Ensure the base URL is reachable from GitHub-hosted runners (or use a self-hosted runner).'
Write-Host 'Open a PR (or comment @qwen-review) to trigger cursor-auto-pr-review / qwen-code-review.'

if ($PushRepos) {
    & (Join-Path $PSScriptRoot 'bootstrap-all-repos.ps1') -CodeRoot $CodeRoot -Commit -Push
}
