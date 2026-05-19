# Install cursor-global-workflow to user-global Cursor paths (Windows).
$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$CursorHome = Join-Path $env:USERPROFILE '.cursor'
$SkillsDest = Join-Path $CursorHome 'skills'
$RulesDest = Join-Path $CursorHome 'rules'
$ScriptsDest = Join-Path $CursorHome 'workflow-scripts'

New-Item -ItemType Directory -Force -Path $SkillsDest, $RulesDest, $ScriptsDest | Out-Null

Get-ChildItem -Path (Join-Path $Root 'skills') -Directory | ForEach-Object {
    $dest = Join-Path $SkillsDest $_.Name
    if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
    Copy-Item -Recurse -Force $_.FullName $dest
}

Get-ChildItem -Path (Join-Path $Root 'rules') -Filter '*.mdc' | ForEach-Object {
    Copy-Item -Force $_.FullName (Join-Path $RulesDest $_.Name)
}

Get-ChildItem -Path (Join-Path $Root 'scripts') -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring((Join-Path $Root 'scripts').Length + 1)
    $out = Join-Path $ScriptsDest $rel
    New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
    Copy-Item -Force $_.FullName $out
}

Copy-Item -Force (Join-Path $Root 'hooks\orchestrator-remind.mjs') (Join-Path $ScriptsDest 'orchestrator-remind.mjs')

[System.Environment]::SetEnvironmentVariable('CURSOR_WORKFLOW_SCRIPTS', $ScriptsDest, 'User')
$env:CURSOR_WORKFLOW_SCRIPTS = $ScriptsDest

Write-Host "Installed skills -> $SkillsDest"
Write-Host "Installed rules  -> $RulesDest"
Write-Host "Installed scripts -> $ScriptsDest"
Write-Host "Set CURSOR_WORKFLOW_SCRIPTS (User) = $ScriptsDest"
Write-Host "Re-open terminals/Cursor so env vars apply."
