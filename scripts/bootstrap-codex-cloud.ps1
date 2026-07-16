[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory, ValueFromPipeline, ValueFromPipelineByPropertyName)]
    [Alias('FullName')]
    [string[]]$RepoPath,

    [switch]$CreateAgentsTemplate,
    [switch]$Force
)

begin {
    $sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\codex-cloud')).Path
    $cloudFiles = @('lib.sh', 'setup.sh', 'maintenance.sh')
}

process {
    foreach ($candidate in $RepoPath) {
        $resolved = (Resolve-Path -LiteralPath $candidate -ErrorAction Stop).Path
        $gitRoot = (& git -C $resolved rev-parse --show-toplevel 2>$null)
        if ($LASTEXITCODE -ne 0 -or -not $gitRoot) {
            throw "Not a Git repository: $resolved"
        }
        $gitRoot = (Resolve-Path -LiteralPath $gitRoot).Path
        $targetRoot = Join-Path $gitRoot '.codex\cloud'

        if ($PSCmdlet.ShouldProcess($gitRoot, 'Install Codex Cloud repository baseline')) {
            New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
            foreach ($file in $cloudFiles) {
                $target = Join-Path $targetRoot $file
                if ((Test-Path -LiteralPath $target) -and -not $Force) {
                    Write-Host "Preserved existing $target"
                    continue
                }
                Copy-Item -LiteralPath (Join-Path $sourceRoot $file) -Destination $target -Force
                Write-Host "Installed $target"
            }

            $agentsPath = Join-Path $gitRoot 'AGENTS.md'
            if ($CreateAgentsTemplate) {
                if (Test-Path -LiteralPath $agentsPath) {
                    Write-Host "Preserved existing $agentsPath"
                } else {
                    Copy-Item -LiteralPath (Join-Path $sourceRoot 'AGENTS.md.template') -Destination $agentsPath
                    Write-Warning "Created $agentsPath; replace every REPLACE_WITH_* marker before committing."
                }
            }

            & git -C $gitRoot check-ignore --quiet -- '.codex/cloud/setup.sh'
            if ($LASTEXITCODE -eq 0) {
                Write-Warning "$gitRoot ignores .codex/cloud; add explicit negation rules before committing the baseline."
            }

            Write-Host "Cloud baseline ready in $gitRoot"
        }
    }
}
