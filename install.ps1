# Install cursor-global-workflow to user-global Cursor paths (Windows).

$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot

$CursorHome = Join-Path $env:USERPROFILE '.cursor'

$SkillsDest = Join-Path $CursorHome 'skills'

$RulesDest = Join-Path $CursorHome 'rules'

$ScriptsDest = Join-Path $CursorHome 'workflow-scripts'

$TemplatesDest = Join-Path $ScriptsDest 'templates'



New-Item -ItemType Directory -Force -Path $SkillsDest, $RulesDest, $ScriptsDest, $TemplatesDest | Out-Null



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



Get-ChildItem -Path (Join-Path $Root 'hooks') -Filter '*.mjs' | ForEach-Object {
    Copy-Item -Force $_.FullName (Join-Path $ScriptsDest $_.Name)
}

Copy-Item -Force (Join-Path $Root 'bootstrap-version.txt') (Join-Path $ScriptsDest 'bootstrap-version.txt')

Get-ChildItem -Path (Join-Path $Root 'templates') -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring((Join-Path $Root 'templates').Length + 1)
    $out = Join-Path $TemplatesDest $rel
    New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
    Copy-Item -Force $_.FullName $out
}



[System.Environment]::SetEnvironmentVariable('CURSOR_WORKFLOW_SCRIPTS', $ScriptsDest, 'User')

$env:CURSOR_WORKFLOW_SCRIPTS = $ScriptsDest



$scriptPath = ($ScriptsDest -replace '\\', '/')

$hooksPath = Join-Path $CursorHome 'hooks.json'

$hooksObj = @{ version = 1; hooks = @{} }



if (Test-Path $hooksPath) {

    try {

        $existing = Get-Content $hooksPath -Raw | ConvertFrom-Json

        if ($existing.version) { $hooksObj.version = [int]$existing.version }

        if ($existing.hooks) {

            foreach ($prop in $existing.hooks.PSObject.Properties) {

                $hooksObj.hooks[$prop.Name] = @($prop.Value)

            }

        }

    } catch {

        Write-Warning "Could not parse existing hooks.json; replacing hook entries from install."

    }

}



$hooksObj.hooks['sessionStart'] = @(

    @{

        command = "node `"$scriptPath/repo-auto-bootstrap.mjs`""

        loop_limit = 1

    }

)

$hooksObj.hooks['subagentStop'] = @(

    @{

        command = "node `"$scriptPath/orchestrator-remind.mjs`""

        loop_limit = 2

    }

)

$hooksObj.hooks['stop'] = @(

    @{

        command = "node `"$scriptPath/orchestrator-remind.mjs`""

        loop_limit = 2

    }

)



($hooksObj | ConvertTo-Json -Depth 6) | Set-Content -Path $hooksPath -Encoding utf8



Write-Host "Installed skills -> $SkillsDest"

Write-Host "Installed rules  -> $RulesDest"

Write-Host "Installed scripts -> $ScriptsDest"

Write-Host "Installed templates -> $TemplatesDest"

Write-Host "Registered user hooks -> $hooksPath (sessionStart + stop/subagentStop)"

Write-Host "Set CURSOR_WORKFLOW_SCRIPTS (User) = $ScriptsDest"

Write-Host "Re-open terminals/Cursor so env vars apply."

