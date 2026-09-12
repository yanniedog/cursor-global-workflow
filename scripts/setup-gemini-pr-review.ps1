# Set GEMINI_API_KEY and ensure gemini-review.yml exists on owned GitHub repos.
param(
    [string]$ApiKey = $env:GEMINI_API_KEY,
    [string]$CodeRoot = (Join-Path $env:USERPROFILE 'code'),
    [switch]$PushRepos,
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

if (-not $ApiKey) {
    $ApiKey = Read-Host 'Paste GEMINI_API_KEY (from Google AI Studio)'
}

if (-not $ApiKey) {
    throw 'GEMINI_API_KEY is required.'
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'gh CLI is required (gh auth login).'
}

$scriptsRoot = $PSScriptRoot
$repoRoot = Split-Path $scriptsRoot -Parent
$workflowTemplate = @(
    (Join-Path $scriptsRoot 'templates\.github\workflows\gemini-review.yml'),
    (Join-Path $repoRoot 'templates\.github\workflows\gemini-review.yml'),
    (Join-Path $env:USERPROFILE '.cursor\workflow-scripts\templates\.github\workflows\gemini-review.yml')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $workflowTemplate) {
    throw 'Missing workflow template templates/.github/workflows/gemini-review.yml'
}

$repos = @()
$page = 1
while ($true) {
    $batch = gh api "user/repos?per_page=100&page=$page&affiliation=owner" --jq '.[] | select(.archived==false) | .full_name'
    if (-not $batch) { break }
    $repos += $batch
    if ((@($batch)).Count -lt 100) { break }
    $page++
}
$repos = $repos | Sort-Object -Unique
Write-Host "Setting GEMINI_API_KEY on $($repos.Count) repos..."

$set = 0
foreach ($slug in $repos) {
    if ($WhatIf) {
        Write-Host "[what-if] gh secret set GEMINI_API_KEY --repo $slug"
        continue
    }
    $ApiKey | gh secret set GEMINI_API_KEY --repo $slug | Out-Null
    $set++
    Write-Host "[ok] $slug"
}

Write-Host ''
Write-Host "Secrets set on $set repos."
Write-Host 'Open a PR to trigger .github/workflows/gemini-review.yml (sshnaidm/gemini-code-review-action).'

if ($PushRepos) {
    $bootstrap = @(
        (Join-Path $scriptsRoot 'bootstrap-all-repos.ps1'),
        (Join-Path $env:USERPROFILE '.cursor\workflow-scripts\bootstrap-all-repos.ps1')
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $bootstrap) { throw 'bootstrap-all-repos.ps1 not found' }
    & $bootstrap -CodeRoot $CodeRoot -Commit -Push
}
