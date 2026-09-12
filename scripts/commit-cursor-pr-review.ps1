# Commit cursor-auto-pr-review bootstrap files across git repos under CodeRoot.
param(
    [string]$CodeRoot = (Join-Path $env:USERPROFILE 'code'),
    [switch]$Push
)

$ErrorActionPreference = 'Stop'

$cursorPaths = @(
    '.cursor/rules/00-use-global-workflow.mdc',
    '.cursor/workflow-bootstrapped',
    '.cursor/PR_REVIEW_PROMPT.md',
    '.cursor/cli.json',
    '.github/workflows/cursor-auto-pr-review.yml',
    'scripts/qwen-pr-review.mjs'
)

$committed = 0
$skipped = 0

foreach ($dir in Get-ChildItem -Path $CodeRoot -Directory) {
    $gitDir = Join-Path $dir.FullName '.git'
    if (-not (Test-Path $gitDir)) { continue }

    Push-Location $dir.FullName
    try {
        $toAdd = @()
        foreach ($rel in $cursorPaths) {
            if (Test-Path $rel) { $toAdd += $rel }
        }
        if (Test-Path 'WORKFLOW.md') {
            $wf = git status --porcelain -- WORKFLOW.md 2>$null
            if ($wf) { $toAdd += 'WORKFLOW.md' }
        }
        if (Test-Path 'package.json') {
            $pkg = git status --porcelain -- package.json 2>$null
            if ($pkg) { $toAdd += 'package.json' }
        }
        $toAdd = $toAdd | Select-Object -Unique
        if ($toAdd.Count -eq 0) {
            $skipped++
            continue
        }

        $status = git status --porcelain -- @toAdd 2>$null
        if (-not $status) {
            $skipped++
            continue
        }

        git add @toAdd
        git commit -m "chore: add Qwen Code PR review workflow (self-hosted)"
        $committed++
        Write-Host "[commit] $($dir.Name) -> $($toAdd -join ', ')"

        if ($Push) {
            $branch = git rev-parse --abbrev-ref HEAD 2>$null
            if ($branch) {
                git push -u origin HEAD 2>&1 | ForEach-Object { Write-Host "  $_" }
            }
        }
    } catch {
        Write-Warning "[fail] $($dir.Name): $_"
    } finally {
        Pop-Location
    }
}

Write-Host ''
Write-Host "Summary: committed=$committed skipped=$skipped"
