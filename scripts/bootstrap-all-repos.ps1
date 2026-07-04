# Bootstrap all git repos under a code root (default: $env:USERPROFILE\code).
param(
    [string]$CodeRoot = (Join-Path $env:USERPROFILE 'code'),
    [switch]$Commit,
    [switch]$Push
)

$ErrorActionPreference = 'Stop'
$scriptsRoot = $env:CURSOR_WORKFLOW_SCRIPTS
if (-not $scriptsRoot) {
    $scriptsRoot = Join-Path $env:USERPROFILE '.cursor\workflow-scripts'
}
$bootstrapCli = Join-Path $scriptsRoot 'repo-auto-bootstrap.mjs'
if (-not (Test-Path $bootstrapCli)) {
    throw "repo-auto-bootstrap.mjs not found at $bootstrapCli. Run install.ps1 from cursor-global-workflow."
}
if (-not (Test-Path $CodeRoot)) {
    throw "Code root not found: $CodeRoot"
}

Write-Host "Batch bootstrap: $CodeRoot"
$resultsJson = node $bootstrapCli --batch-root $CodeRoot --json
$results = $resultsJson | ConvertFrom-Json

$bootstrapped = 0
$skipped = 0
$committed = 0

foreach ($r in $results) {
    if ($r.skipped) {
        $skipped++
        Write-Host "[skip] $($r.workspace) - $($r.reason)"
        continue
    }
    if (-not $r.bootstrapped) {
        Write-Host "[?] $($r.workspace)"
        continue
    }
    $bootstrapped++
    Write-Host "[ok] $($r.workspace) - $($r.reason)"
    if ($r.files) { Write-Host "     files: $($r.files -join ', ')" }

    if (-not $Commit) { continue }

    $ws = $r.workspace
    Push-Location $ws
    try {
        $toAdd = @()
        $cursorPaths = @(
            '.cursor/rules/00-use-global-workflow.mdc',
            '.cursor/workflow-bootstrapped',
            '.cursor/PR_REVIEW_PROMPT.md',
            '.cursor/cli.json',
            '.github/workflows/cursor-auto-pr-review.yml'
        )
        foreach ($rel in $cursorPaths) {
            if (Test-Path ($rel -replace '/', '\')) { $toAdd += $rel }
        }
        if (Test-Path 'WORKFLOW.md') {
            $wf = git status --porcelain -- WORKFLOW.md 2>$null
            if ($wf) { $toAdd += 'WORKFLOW.md' }
        }
        if (Test-Path 'package.json') {
            $pkg = git status --porcelain -- package.json 2>$null
            if ($pkg) { $toAdd += 'package.json' }
        }
        if ($r.files) {
            foreach ($f in $r.files) {
                if ($toAdd -notcontains $f) { $toAdd += $f }
            }
        }
        $toAdd = $toAdd | Select-Object -Unique
        if ($toAdd.Count -eq 0) { continue }

        $status = git status --porcelain -- $toAdd 2>$null
        if (-not $status) {
            Write-Host "     commit: nothing to commit"
            continue
        }

        git add @toAdd
        git commit -m "chore: add Cursor Auto PR review workflow (Pro+ Auto quota)"
        $committed++
        Write-Host "     commit: done"

        if ($Push) {
            $branch = git rev-parse --abbrev-ref HEAD 2>$null
            if ($branch) {
                git push -u origin HEAD 2>&1 | ForEach-Object { Write-Host "     $_" }
            }
        }
    } catch {
        Write-Warning "     commit failed: $_"
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "Summary: bootstrapped=$bootstrapped skipped=$skipped committed=$committed total=$($results.Count)"
Write-Host "Tip: run setup-cursor-pr-review.ps1 to set CURSOR_API_KEY on all repos."
