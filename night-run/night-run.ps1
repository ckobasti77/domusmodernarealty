#Requires -Version 5.1
<#
.SYNOPSIS
  Mihajlo Estate - overnight Claude Code runner (Windows PowerShell 5.1+ / PowerShell 7).

.DESCRIPTION
  Runs the steps defined in night-run\steps.psd1 one after another with `claude -p`.
  Per step: model, effort, session (new/continue) and mode (plan/goal/auto) come from steps.psd1.
  - Keeps Windows awake while running.
  - Logs every Claude event (stream-json) to night-run\logs\<run>\<step>-aN.jsonl, and a readable
    night-run\STATUS.md is refreshed after every event that matters.
  - Survives usage limits: parses the reset time, sleeps, then resumes the same session.
    Very long limits (weekly) -> steps down the model ladder (fable -> opus -> sonnet).
  - After each step runs a verification gate (npm run verify); on failure resumes the same
    session with the error output, up to MaxFixAttempts times.
  - Git checkpoint commit + tag after every step. Resumable: re-run the script and it continues.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\night-run\night-run.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\night-run\night-run.ps1 -From 06
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\night-run\night-run.ps1 -Only 05b -Redo
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\night-run\night-run.ps1 -DryRun
#>
[CmdletBinding()]
param(
    [string]$From,
    [string]$Only,
    [switch]$Redo,
    [switch]$DryRun,
    [switch]$SkipPreflight,
    [string]$ClaudePath
)

$ErrorActionPreference = 'Stop'
$script:IsWin = ($env:OS -eq 'Windows_NT')
$NightDir = $PSScriptRoot
$Root = Split-Path -Parent $NightDir
Set-Location -LiteralPath $Root

$StateDir = Join-Path $NightDir 'state'
$StepsStateDir = Join-Path $StateDir 'steps'
$LogRoot = Join-Path $NightDir 'logs'
$RunStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogDir = Join-Path $LogRoot $RunStamp
foreach ($d in @($StateDir, $StepsStateDir, $LogDir)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
$RunnerLog = Join-Path $LogDir 'runner.log'
$StatePath = Join-Path $StateDir 'state.json'
$StatusPath = Join-Path $NightDir 'STATUS.md'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
try { [Console]::OutputEncoding = $Utf8NoBom } catch { }
$OutputEncoding = $Utf8NoBom

# ------------------------------------------------------------------ helpers
function Write-Utf8File([string]$Path, [string]$Text) { [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom) }
function Add-Utf8Line([string]$Path, [string]$Text) { [System.IO.File]::AppendAllText($Path, $Text + [Environment]::NewLine, $Utf8NoBom) }

function Write-Log {
    param([string]$Msg, [string]$Level = 'INFO')
    $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Msg
    $color = 'Gray'
    switch ($Level) { 'ERROR' { $color = 'Red' } 'WARN' { $color = 'Yellow' } 'OK' { $color = 'Green' } 'STEP' { $color = 'Cyan' } 'EV' { $color = 'DarkGray' } }
    Write-Host $line -ForegroundColor $color
    try { Add-Utf8Line $RunnerLog $line } catch { }
}

function ConvertTo-Hashtable($obj) {
    if ($null -eq $obj) { return $null }
    if ($obj -is [System.Collections.IDictionary]) { $h = @{}; foreach ($k in @($obj.Keys)) { $h[$k] = ConvertTo-Hashtable $obj[$k] }; return $h }
    if ($obj -is [System.Management.Automation.PSCustomObject]) { $h = @{}; foreach ($p in $obj.PSObject.Properties) { $h[$p.Name] = ConvertTo-Hashtable $p.Value }; return $h }
    if (($obj -is [System.Collections.IEnumerable]) -and -not ($obj -is [string])) { $a = New-Object System.Collections.ArrayList; foreach ($i in $obj) { [void]$a.Add((ConvertTo-Hashtable $i)) }; return , $a.ToArray() }
    return $obj
}

function Load-State {
    if (Test-Path -LiteralPath $StatePath) {
        try { $s = ConvertTo-Hashtable (Get-Content -LiteralPath $StatePath -Raw -Encoding UTF8 | ConvertFrom-Json) }
        catch { Write-Log "state.json unreadable, starting fresh: $_" 'WARN'; $s = $null }
        if ($s) {
            if (-not $s.ContainsKey('steps') -or $null -eq $s.steps) { $s.steps = @{} }
            if (-not $s.ContainsKey('modelMap') -or $null -eq $s.modelMap) { $s.modelMap = @{} }
            return $s
        }
    }
    return @{ steps = @{}; modelMap = @{}; createdAt = (Get-Date).ToString('s') }
}
function Save-State { Write-Utf8File $StatePath ($script:State | ConvertTo-Json -Depth 12) }
function Get-StepState([string]$Id) {
    if (-not $script:State.steps.ContainsKey($Id) -or $null -eq $script:State.steps[$Id]) {
        $script:State.steps[$Id] = @{ status = 'pending'; attempts = 0; sessionId = $null; costUsd = 0.0; model = $null; notes = '' }
    }
    return $script:State.steps[$Id]
}

function Invoke-Native {
    # Runs a native command; never throws on stderr output (PS 5.1 quirk). Returns @{code; out}
    param([string]$Exe, [string[]]$ArgList)
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try {
        $out = & $Exe @ArgList 2>&1 | ForEach-Object { "$_" }
        $code = $LASTEXITCODE
    } catch {
        $out = @("$_"); $code = 9009
    } finally { $ErrorActionPreference = $prev }
    return @{ code = $code; out = (@($out) -join "`n") }
}

function ConvertTo-ArgString([string[]]$ArgList) {
    # Windows CommandLineToArgvW-compatible quoting (also what .NET uses on Unix).
    $parts = New-Object System.Collections.ArrayList
    foreach ($a in $ArgList) {
        if ($null -eq $a -or $a -eq '') { [void]$parts.Add('""'); continue }
        if ($a -notmatch '[\s"]') { [void]$parts.Add($a); continue }
        $sb = New-Object System.Text.StringBuilder
        [void]$sb.Append('"')
        $bs = 0
        foreach ($ch in $a.ToCharArray()) {
            if ($ch -eq [char]'\') { $bs++; continue }
            if ($ch -eq [char]'"') { [void]$sb.Append(('\' * ($bs * 2 + 1))); [void]$sb.Append('"'); $bs = 0; continue }
            if ($bs -gt 0) { [void]$sb.Append(('\' * $bs)); $bs = 0 }
            [void]$sb.Append($ch)
        }
        if ($bs -gt 0) { [void]$sb.Append(('\' * ($bs * 2))) }
        [void]$sb.Append('"')
        [void]$parts.Add($sb.ToString())
    }
    return ($parts -join ' ')
}

function Stop-ProcessTree([int]$ProcessId) {
    if ($script:IsWin) { $null = Invoke-Native 'taskkill.exe' @('/PID', "$ProcessId", '/T', '/F') }
    else { $null = Invoke-Native 'pkill' @('-TERM', '-P', "$ProcessId"); try { Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue } catch { } }
}

function Stop-DevServers {
    if (-not $script:IsWin) { return }
    foreach ($port in @(3000, 3001, 3100, 9323)) {
        try {
            $conns = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
            foreach ($c in $conns) {
                $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
                if ($p -and $p.ProcessName -match '^(node|bun|next)') {
                    Write-Log "Stopping leftover $($p.ProcessName) (pid $($p.Id)) listening on :$port" 'WARN'
                    Stop-ProcessTree $p.Id
                }
            }
        } catch { }
    }
}

# Keep the PC awake (display may sleep, system may not)
$script:Power = $null
try {
    $sig = '[DllImport("kernel32.dll", SetLastError = true)] public static extern uint SetThreadExecutionState(uint esFlags);'
    Add-Type -MemberDefinition $sig -Name 'NightRunPower' -Namespace 'MihajloEstate' -ErrorAction SilentlyContinue | Out-Null
    $script:Power = $true
} catch { $script:Power = $true }
function Set-KeepAwake([bool]$On) {
    if (-not $script:IsWin -or -not $script:Power) { return }
    try {
        if ($On) { [void][MihajloEstate.NightRunPower]::SetThreadExecutionState([uint32]2147483649) }   # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
        else { [void][MihajloEstate.NightRunPower]::SetThreadExecutionState([uint32]2147483648) }       # ES_CONTINUOUS
    } catch { }
}

# ------------------------------------------------------------------ config
$CfgPath = Join-Path $NightDir 'steps.psd1'
$Cfg = Import-PowerShellDataFile -LiteralPath $CfgPath
$Steps = @($Cfg.Steps)
$script:PermMode = [string]$Cfg.PermissionMode
if (-not $script:PermMode) { $script:PermMode = 'auto' }
$script:SupportsPromptsNone = $true
$script:SupportsUltracode = $true
$script:SupportsGoal = $true
$script:ClaudeExe = $null
$script:State = Load-State
$script:RunStarted = Get-Date
$script:Current = ''
$Npm = 'npm'; $Npx = 'npx'
if ($script:IsWin) { $Npm = 'npm.cmd'; $Npx = 'npx.cmd' }

# Env for every Claude process (inherited)
$env:DISABLE_AUTOUPDATER = '1'
$env:BASH_DEFAULT_TIMEOUT_MS = '600000'
$env:BASH_MAX_TIMEOUT_MS = '1800000'
$env:CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS = '2700000'
$env:CLAUDE_CODE_RESUME_INTERRUPTED_TURN = '1'
$env:NIGHT_RUN = '1'

# ------------------------------------------------------------------ status file
function Format-Dur([double]$Minutes) { if ($Minutes -le 0) { return '' }; $ts = [TimeSpan]::FromMinutes($Minutes); return ('{0}h{1:00}m' -f [int][Math]::Floor($ts.TotalHours), $ts.Minutes) }
function Update-Status {
    try {
        $sb = New-Object System.Text.StringBuilder
        [void]$sb.AppendLine('# Night run status')
        [void]$sb.AppendLine('')
        [void]$sb.AppendLine(('Updated: {0} | Run started: {1} | Permission mode: {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $script:RunStarted.ToString('yyyy-MM-dd HH:mm'), $script:PermMode))
        [void]$sb.AppendLine('')
        if ($script:Current) { [void]$sb.AppendLine("**Now:** $($script:Current)"); [void]$sb.AppendLine('') }
        [void]$sb.AppendLine('| # | Step | Model | Effort | Mode | Session | Status | Attempts | Duration | Cost est. | Notes |')
        [void]$sb.AppendLine('|---|---|---|---|---|---|---|---|---|---|---|')
        foreach ($s in $Steps) {
            $st = Get-StepState $s.Id
            $dur = 0
            if ($st.startedAt) {
                $end = Get-Date; if ($st.endedAt) { $end = [datetime]$st.endedAt }
                $dur = ($end - [datetime]$st.startedAt).TotalMinutes
            }
            $model = $s.Model; if ($st.model) { $model = $st.model }
            $cost = ''; if ($st.costUsd) { $cost = ('${0:N2}' -f [double]$st.costUsd) }
            [void]$sb.AppendLine(('| {0} | {1} | {2} | {3} | {4} | {5} | {6} | {7} | {8} | {9} | {10} |' -f $s.Id, $s.Title, $model, $s.Effort, $s.Mode, $s.Session, $st.status, $st.attempts, (Format-Dur $dur), $cost, ($st.notes -replace '\|', '/')))
        }
        [void]$sb.AppendLine('')
        [void]$sb.AppendLine("Logs: night-run/logs/$RunStamp/ (runner.log + one .jsonl per attempt). Step reports: night-run/state/steps/*.done.md. Progress: docs/PROGRESS.md.")
        Write-Utf8File $StatusPath $sb.ToString()
    } catch { }
}

# ------------------------------------------------------------------ claude process
function Resolve-Claude {
    if ($ClaudePath) { return $ClaudePath }
    if ($script:IsWin) {
        $native = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
        if (Test-Path -LiteralPath $native) { return $native }
        $exe = Get-Command 'claude.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($exe) { return $exe.Source }
    }
    $any = Get-Command 'claude' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($any) { return $any.Source }
    throw 'Claude Code CLI (claude) not found. Install it (https://code.claude.com) or pass -ClaudePath.'
}

function New-ClaudeStartInfo([string[]]$ArgList) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $exe = $script:ClaudeExe
    $argString = ConvertTo-ArgString $ArgList
    $ext = [System.IO.Path]::GetExtension($exe).ToLowerInvariant()
    if ($ext -eq '.cmd' -or $ext -eq '.bat') {
        $psi.FileName = $env:ComSpec
        $psi.Arguments = '/d /s /c "' + (ConvertTo-ArgString @($exe)) + ' ' + $argString + '"'
    } elseif ($ext -eq '.ps1') {
        $psi.FileName = 'powershell.exe'
        $psi.Arguments = '-NoProfile -ExecutionPolicy Bypass -File ' + (ConvertTo-ArgString @($exe)) + ' ' + $argString
    } else {
        $psi.FileName = $exe
        $psi.Arguments = $argString
    }
    $psi.WorkingDirectory = $Root
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.RedirectStandardInput = $true
    $psi.StandardOutputEncoding = $Utf8NoBom
    $psi.StandardErrorEncoding = $Utf8NoBom
    $psi.CreateNoWindow = $true
    return $psi
}

function Get-ShortText([string]$Text, [int]$Max = 160) {
    if (-not $Text) { return '' }
    $t = ($Text -replace '\s+', ' ').Trim()
    if ($t.Length -gt $Max) { return $t.Substring(0, $Max) + '...' }
    return $t
}

function Handle-StreamLine([string]$Line, $R) {
    if (-not $Line -or $Line[0] -ne '{') { return }
    if (-not $R.sessionId -and $Line -match '"session_id"\s*:\s*"([0-9a-fA-F-]{16,})"') { $R.sessionId = $Matches[1] }
    if ($Line -match '^\{"type":"system","subtype":"init"' -or ($Line -match '"type"\s*:\s*"system"' -and $Line -match '"subtype"\s*:\s*"init"')) {
        try {
            $o = $Line | ConvertFrom-Json
            if ($o.session_id) { $R.sessionId = [string]$o.session_id }
            if ($o.permissionMode) { $R.permissionMode = [string]$o.permissionMode }
            if ($o.model) { $R.model = [string]$o.model }
            Write-Log ("  init: model={0} permissionMode={1} session={2}" -f $o.model, $o.permissionMode, $o.session_id) 'EV'
        } catch { }
        return
    }
    if ($Line -match '"type"\s*:\s*"result"' -and $Line -match '"subtype"\s*:') {
        try { $R.result = $Line | ConvertFrom-Json } catch { $R.resultRaw = $Line }
        return
    }
    if ($Line -match '"type"\s*:\s*"system"' -and $Line -match '"subtype"\s*:\s*"api_retry"') {
        $err = ''; if ($Line -match '"error"\s*:\s*"([a-z_]+)"') { $err = $Matches[1] }
        Write-Log "  api_retry ($err)" 'WARN'
        $R.lastText = "api_retry $err"
        return
    }
    if ($Line -match '"type"\s*:\s*"assistant"') {
        $R['events'] = [int]$R['events'] + 1
        if ($Line.Length -gt 1500000) { return }
        try {
            $o = $Line | ConvertFrom-Json
            if ($o.parent_tool_use_id) { $prefix = '    [sub]' } else { $prefix = '  ' }
            foreach ($c in @($o.message.content)) {
                if ($c.type -eq 'text' -and $c.text) {
                    $R.lastText = [string]$c.text
                    Write-Log ("{0} {1}" -f $prefix, (Get-ShortText $c.text 200)) 'EV'
                } elseif ($c.type -eq 'tool_use') {
                    $detail = ''
                    $inp = $c.input
                    if ($inp) {
                        if ($inp.command) { $detail = $inp.command }
                        elseif ($inp.file_path) { $detail = $inp.file_path }
                        elseif ($inp.pattern) { $detail = $inp.pattern }
                        elseif ($inp.description) { $detail = $inp.description }
                        elseif ($inp.skill) { $detail = $inp.skill }
                        elseif ($inp.url) { $detail = $inp.url }
                    }
                    if ($c.name -eq 'ExitPlanMode' -and $inp -and $inp.plan) { $R.planText = [string]$inp.plan }
                    Write-Log ("{0} > {1}: {2}" -f $prefix, $c.name, (Get-ShortText ([string]$detail) 140)) 'EV'
                }
            }
        } catch { }
        if (($R.events % 25) -eq 0) { Update-Status }
    }
}

function Invoke-ClaudeRun {
    param([string[]]$ArgList, [string]$LogFile, [int]$TimeoutMin, [string]$Label)
    $R = @{ sessionId = $null; permissionMode = $null; model = $null; result = $null; resultRaw = $null; lastText = ''; planText = $null; timedOut = $false; exitCode = $null; stderr = ''; events = 0 }
    Add-Utf8Line $RunnerLog ("CMD: claude " + (ConvertTo-ArgString $ArgList))
    $psi = New-ClaudeStartInfo $ArgList
    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()
    try { $proc.StandardInput.Close() } catch { }
    $errTask = $proc.StandardError.ReadToEndAsync()
    $writer = New-Object System.IO.StreamWriter($LogFile, $true, $Utf8NoBom)
    $deadline = (Get-Date).AddMinutes($TimeoutMin)
    try {
        $readTask = $proc.StandardOutput.ReadLineAsync()
        while ($true) {
            if ($readTask.Wait(2000)) {
                $line = $readTask.Result
                if ($null -eq $line) { break }
                $writer.WriteLine($line); $writer.Flush()
                Handle-StreamLine $line $R
                $readTask = $proc.StandardOutput.ReadLineAsync()
            } elseif ((Get-Date) -gt $deadline) {
                $R.timedOut = $true
                Write-Log "$Label exceeded $TimeoutMin min - stopping the process tree (the session will be resumed)" 'WARN'
                Stop-ProcessTree $proc.Id
                break
            }
        }
    } finally { $writer.Close() }
    if (-not $proc.WaitForExit(120000)) { Stop-ProcessTree $proc.Id; [void]$proc.WaitForExit(30000) }
    try { if ($errTask.Wait(15000)) { $R.stderr = [string]$errTask.Result } } catch { }
    try { $R.exitCode = $proc.ExitCode } catch { $R.exitCode = -1 }
    if ($R.stderr) { Write-Utf8File ($LogFile -replace '\.jsonl$', '.stderr.log') $R.stderr }
    return $R
}

# ------------------------------------------------------------------ outcome handling
$LimitRx = '(?i)(hit your (session|weekly|opus|sonnet|fable|usage|daily)[a-z ]* limit|usage limit (reached|hit)|limit reached|reached your .*limit|out of (extra )?usage|rate-limit-options|resets? (at )?\d{1,2}(:\d{2})?\s*(am|pm))'
function Get-ResultText($R) {
    $t = ''
    if ($R.result -and $R.result.result) { $t = [string]$R.result.result }
    elseif ($R.resultRaw) { $t = [string]$R.resultRaw }
    return $t
}
function Get-Outcome($R) {
    if ($R.timedOut) { return 'timeout' }
    $text = Get-ResultText $R
    $res = $R.result
    if ($res -and ($res.is_error -eq $false) -and ([string]$res.subtype -eq 'success')) {
        if ($text.Length -lt 400 -and $text -match $LimitRx) { return 'usage_limit' }
        return 'success'
    }
    $blob = ($text + "`n" + $R.stderr + "`n" + $R.lastText)
    if ($blob -match $LimitRx) { return 'usage_limit' }
    if ($blob -match '(?i)(Request rejected \(429\)|"rate_limit"|api_retry rate_limit|temporarily limiting requests)') { return 'rate_limit' }
    if ($blob -match '(?i)(overloaded|high load|\b529\b|server_error|api_retry (overloaded|server_error|unknown))') { return 'overloaded' }
    if ($blob -match '(?i)(not a recognized model|model[^\n]{0,60}not found|issue with the selected model|model_not_found|is not available (with|on) (your|the))') { return 'model_unavailable' }
    if ($blob -match '(?i)(invalid api key|please run /login|not logged in|authentication_failed|oauth token (has )?expired|credit balance is too low|account_on_hold|billing_error)') { return 'auth' }
    if ($blob -match '(?i)(unknown option|error: option|invalid value for|unexpected argument)') { return 'bad_flag' }
    if ($res -and [string]$res.subtype -eq 'error_max_turns') { return 'max_turns' }
    return 'error'
}

function Get-ResetTime([string]$Text) {
    if (-not $Text) { return $null }
    if ($Text -match '\|(\d{10})\b') { return ([DateTimeOffset]::FromUnixTimeSeconds([int64]$Matches[1])).LocalDateTime }
    $now = Get-Date
    $rx = '(?i)resets?\s+(?:at\s+|on\s+)?(?:(?<mon>jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?<day>\d{1,2})(?:st|nd|rd|th)?,?\s*(?:at\s+)?)?(?<h>\d{1,2})(?::(?<m>\d{2}))?\s*(?<ap>am|pm)?'
    if ($Text -match $rx) {
        $h = [int]$Matches['h']; $m = 0
        if ($Matches['m']) { $m = [int]$Matches['m'] }
        if ($Matches['ap']) {
            $ap = $Matches['ap'].ToLowerInvariant()
            if ($ap -eq 'pm' -and $h -lt 12) { $h += 12 }
            if ($ap -eq 'am' -and $h -eq 12) { $h = 0 }
        }
        if ($h -gt 23 -or $m -gt 59) { return $null }
        if ($Matches['mon']) {
            $months = @('jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec')
            $mon = [array]::IndexOf($months, $Matches['mon'].Substring(0, 3).ToLowerInvariant()) + 1
            $dt = Get-Date -Year $now.Year -Month $mon -Day ([int]$Matches['day']) -Hour $h -Minute $m -Second 0
            if ($dt -lt $now.AddDays(-2)) { $dt = $dt.AddYears(1) }
            return $dt
        }
        $dt = Get-Date -Hour $h -Minute $m -Second 0
        if ($dt -le $now) { $dt = $dt.AddDays(1) }
        return $dt
    }
    return $null
}

function Wait-Until([datetime]$When, [string]$Why) {
    $script:Current = "waiting until $($When.ToString('ddd HH:mm')) - $Why"
    Update-Status
    Write-Log "Waiting until $($When.ToString('yyyy-MM-dd HH:mm')) ($Why)" 'WARN'
    if ($env:NIGHT_RUN_TEST_FAST -eq '1') { Start-Sleep -Seconds 2; return }
    while ((Get-Date) -lt $When) { Start-Sleep -Seconds 30 }
}

function Resolve-Model([string]$Name) {
    $m = $Name
    $guard = 0
    while ($script:State.modelMap.ContainsKey($m) -and $script:State.modelMap[$m] -and $guard -lt 5) { $m = [string]$script:State.modelMap[$m]; $guard++ }
    return $m
}
function Get-NextModel([string]$Name) {
    $ladder = @($Cfg.ModelLadder)
    $i = [array]::IndexOf($ladder, $Name)
    if ($i -ge 0 -and $i -lt ($ladder.Count - 1)) { return $ladder[$i + 1] }
    if ($i -lt 0 -and $ladder.Count -gt 0) { return $ladder[0] }
    return $null
}

function Test-ModelReady([string]$Model) {
    $log = Join-Path $LogDir ("probe-{0}-{1}.jsonl" -f $Model, (Get-Date -Format 'HHmmss'))
    $a = @('-p', 'Reply with exactly one word: READY', '--model', $Model, '--effort', 'low', '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--permission-mode', 'dontAsk')
    $r = Invoke-ClaudeRun -ArgList $a -LogFile $log -TimeoutMin 5 -Label "probe $Model"
    $o = Get-Outcome $r
    return @{ ok = ($o -eq 'success'); outcome = $o; run = $r }
}

# ------------------------------------------------------------------ prompts / args
function Get-GoalText($Step) {
    $cap = [int]$Cfg.GoalTurnCap; if ($cap -le 0) { $cap = 30 }
    return ("/goal Carry out night-run step {0} exactly as specified in night-run/prompts/{1} (first read that file and night-run/prompts/_protocol.md). The goal is met only when this conversation shows ALL of: (a) every item under 'Definition of done' in night-run/prompts/{1} is satisfied, each with evidence; (b) npm run verify was run after the last code change and exited with code 0 (its final output lines shown); (c) night-run/state/steps/{0}.done.md was written; (d) the work is committed (git log -1 --oneline shown) and git status is clean. If it is still not met after {2} turns, write the done file listing exactly what remains, commit, and stop." -f $Step.Id, $Step.File, $cap)
}
function Get-AutoText($Step) {
    return ("Carry out night-run step {0} exactly as specified in night-run/prompts/{1}. Read that file and night-run/prompts/_protocol.md first, and finish with the end protocol." -f $Step.Id, $Step.File)
}
function Get-PlanText($Step) {
    return ("Read night-run/prompts/{0} and do exactly what it says. You are in plan mode (read-only). Your final answer must be the complete implementation plan in Markdown - the runner saves it as docs/IMPLEMENTATION-PLAN.md." -f $Step.File)
}
function Get-SafeTail([string]$Text, [int]$Max = 1800) {
    if (-not $Text) { return '' }
    $t = $Text -replace '\r?\n', ' | '
    $t = $t -replace '[\x00-\x08\x0B\x0C\x0E-\x1F]', ' '
    $t = $t -replace '"', "'" -replace '%', ' pct '
    if ($t.Length -gt $Max) { $t = '...' + $t.Substring($t.Length - $Max) }
    return $t
}
function Get-FixGoalText($Step, [string]$Tail, [int]$Code) {
    return ("/goal The night-run verification gate failed after step {0}: npm run verify exited with code {1}. Last output lines: <<< {2} >>> Find and fix the root causes without weakening lint/type rules, deleting features or skipping checks. The goal is met only when npm run verify was run after the last change and exited 0 (final lines shown), night-run/state/steps/{0}.done.md is updated with what was fixed, and the fix is committed (git log -1 --oneline shown). Stop after 15 turns." -f $Step.Id, $Code, (Get-SafeTail $Tail))
}
function Get-DoneFileGoalText($Step) {
    return ("/goal Finish night-run step {0}: follow the end protocol in night-run/prompts/_protocol.md. The goal is met only when npm run verify exited 0 after the last change, night-run/state/steps/{0}.done.md exists (summary, files, decisions, known issues, next steps should know), docs/PROGRESS.md has the step section, and everything is committed. Stop after 10 turns." -f $Step.Id)
}

function Build-Args($Step, [string]$Model, [string]$Effort, [string]$Prompt, [string]$ResumeId, [string]$PermOverride) {
    $a = New-Object System.Collections.ArrayList
    [void]$a.Add('-p'); [void]$a.Add($Prompt)
    [void]$a.Add('--model'); [void]$a.Add($Model)
    $eff = $Effort
    if ($eff -eq 'ultracode' -and -not $script:SupportsUltracode) { $eff = 'xhigh' }
    if ($eff) { [void]$a.Add('--effort'); [void]$a.Add($eff) }
    if ($Step.Mode -eq 'plan') {
        [void]$a.Add('--permission-mode'); [void]$a.Add('plan')
    } else {
        $pm = $script:PermMode; if ($PermOverride) { $pm = $PermOverride }
        [void]$a.Add('--permission-mode'); [void]$a.Add($pm)
    }
    if ($script:SupportsPromptsNone) { [void]$a.Add('--permission-prompts'); [void]$a.Add('none') }
    [void]$a.Add('--output-format'); [void]$a.Add('stream-json')
    [void]$a.Add('--verbose')
    [void]$a.Add('--settings'); [void]$a.Add('night-run/claude-settings.json')
    [void]$a.Add('--append-system-prompt-file'); [void]$a.Add('night-run/system-append.md')
    [void]$a.Add('--name'); [void]$a.Add(('mihajlo-night-{0}' -f $Step.Id))
    if ($ResumeId) { [void]$a.Add('--resume'); [void]$a.Add($ResumeId) }
    return , ([string[]]$a.ToArray())
}

# ------------------------------------------------------------------ gate + git
function Invoke-Shell([string]$CommandLine, [string]$LogFile, [int]$TimeoutMin = 30) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    if ($script:IsWin) { $psi.FileName = $env:ComSpec; $psi.Arguments = '/d /s /c "' + $CommandLine + ' > "' + $LogFile + '" 2>&1"' }
    else { $psi.FileName = '/bin/bash'; $psi.Arguments = ConvertTo-ArgString @('-c', ($CommandLine + ' > "' + $LogFile + '" 2>&1')) }
    $psi.WorkingDirectory = $Root
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $p = [System.Diagnostics.Process]::Start($psi)
    if (-not $p.WaitForExit($TimeoutMin * 60000)) { Stop-ProcessTree $p.Id; return 124 }
    return $p.ExitCode
}
function Invoke-Gate($Step, [string]$Tag) {
    Stop-DevServers
    $log = Join-Path $LogDir ('{0}-gate-{1}.log' -f $Step.Id, $Tag)
    Write-Log "Gate ($($Cfg.GateCommand)) for step $($Step.Id)..." 'STEP'
    $code = Invoke-Shell $Cfg.GateCommand $log 40
    $tail = ''
    if (Test-Path -LiteralPath $log) { $tail = (Get-Content -LiteralPath $log -Tail 45 -Encoding UTF8) -join "`n" }
    if ($code -eq 0) { Write-Log "Gate passed" 'OK' } else { Write-Log "Gate FAILED (exit $code) - log: $log" 'WARN' }
    return @{ ok = ($code -eq 0); code = $code; log = $log; tail = $tail }
}
function Invoke-Git([string[]]$GitArgs) { return (Invoke-Native 'git' $GitArgs) }
function Save-Checkpoint($Step, [string]$Suffix = '') {
    $null = Invoke-Git @('add', '-A')
    $st = Invoke-Git @('status', '--porcelain')
    if ($st.out.Trim()) {
        $msg = ('chore(night-run): checkpoint after step {0} {1}{2}' -f $Step.Id, $Step.Title, $Suffix)
        $c = Invoke-Git @('commit', '-m', $msg)
        if ($c.code -eq 0) { Write-Log "Committed leftovers: $msg" 'INFO' } else { Write-Log "git commit failed: $($c.out)" 'WARN' }
    }
    $null = Invoke-Git @('tag', '-f', ('night-run/step-{0}' -f $Step.Id))
}

# ------------------------------------------------------------------ preflight
function Get-ClaudeVersion {
    $r = Invoke-Native $script:ClaudeExe @('--version')
    if ($r.out -match '(\d+)\.(\d+)\.(\d+)') { return [version]("{0}.{1}.{2}" -f $Matches[1], $Matches[2], $Matches[3]) }
    return $null
}
function New-Secret([int]$Length = 22) {
    $chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    $bytes = New-Object byte[] ($Length)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $sb = New-Object System.Text.StringBuilder
    foreach ($b in $bytes) { [void]$sb.Append($chars[$b % $chars.Length]) }
    return $sb.ToString()
}
function Write-SkillsInventory {
    $lines = New-Object System.Collections.ArrayList
    [void]$lines.Add('# Skills available to the night run')
    [void]$lines.Add('')
    [void]$lines.Add("Generated $(Get-Date -Format 's') by night-run.ps1. Invoke with the Skill tool by name.")
    $dirs = @()
    if ($env:USERPROFILE) { $dirs += (Join-Path $env:USERPROFILE '.claude\skills') }
    if ($env:HOME) { $dirs += (Join-Path $env:HOME '.claude/skills') }
    $dirs += (Join-Path $Root '.claude/skills')
    foreach ($dir in ($dirs | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $dir)) { continue }
        [void]$lines.Add('')
        [void]$lines.Add("## $dir")
        foreach ($d in (Get-ChildItem -LiteralPath $dir -Directory -ErrorAction SilentlyContinue | Sort-Object Name)) {
            $sk = Join-Path $d.FullName 'SKILL.md'
            if (-not (Test-Path -LiteralPath $sk)) { continue }
            $desc = ''
            $m = Select-String -LiteralPath $sk -Pattern '^description:\s*(.+)$' -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($m) { $desc = Get-ShortText ($m.Matches[0].Groups[1].Value.Trim('"', "'")) 220 }
            [void]$lines.Add("- **$($d.Name)**: $desc")
        }
    }
    Write-Utf8File (Join-Path $StateDir 'skills-inventory.md') (($lines.ToArray()) -join "`n")
    Write-Log "Skills inventory written ($($lines.Count) lines)" 'INFO'
}

function Invoke-Preflight {
    Write-Log '=== Preflight ===' 'STEP'
    foreach ($tool in @('node', 'git')) {
        $r = Invoke-Native $tool @('--version')
        if ($r.code -ne 0) { throw "$tool is not available on PATH" }
        Write-Log "$tool $($r.out.Trim())" 'INFO'
    }
    $nv = Invoke-Native 'node' @('-e', 'process.stdout.write(process.versions.node)')
    if ([version]$nv.out.Trim() -lt [version]'20.9.0') { throw "Node $($nv.out) is too old (need >= 20.9)" }

    # Claude CLI
    $v = Get-ClaudeVersion
    Write-Log "Claude Code: $script:ClaudeExe ($v)" 'INFO'
    if ($v -and $v -lt [version]'2.1.259') {
        Write-Log 'Claude Code is older than 2.1.259 - running `claude update`...' 'WARN'
        $u = Invoke-Native $script:ClaudeExe @('update'); Write-Log (Get-ShortText $u.out 300) 'INFO'
        $v = Get-ClaudeVersion
        Write-Log "Claude Code now: $v" 'INFO'
    }
    if ($v -and $v -lt [version]'2.1.259') { $script:SupportsPromptsNone = $false; $script:SupportsGoal = $false; Write-Log 'Old CLI: running without --permission-prompts none and without /goal loops.' 'WARN' }
    if ($v -and $v -lt [version]'2.1.203') { $script:SupportsUltracode = $false }
    $auth = Invoke-Native $script:ClaudeExe @('auth', 'status')
    Write-Log ("claude auth status: " + (Get-ShortText $auth.out 300)) 'INFO'

    # Git baseline
    if (-not (Test-Path -LiteralPath (Join-Path $Root '.git'))) { $null = Invoke-Git @('init') }
    foreach ($stale in @('.git/index.lock.stale-safe-to-delete')) { $p = Join-Path $Root $stale; if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue } }
    $lock = Join-Path $Root '.git/index.lock'
    if ((Test-Path -LiteralPath $lock) -and -not (Get-Process -Name git -ErrorAction SilentlyContinue)) { Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue; Write-Log 'Removed stale .git/index.lock' 'WARN' }
    $un = Invoke-Git @('config', 'user.name'); if (-not $un.out.Trim()) { $null = Invoke-Git @('config', 'user.name', 'Night Run') }
    $ue = Invoke-Git @('config', 'user.email'); if (-not $ue.out.Trim()) { $null = Invoke-Git @('config', 'user.email', 'night-run@localhost') }
    $br = (Invoke-Git @('rev-parse', '--abbrev-ref', 'HEAD')).out.Trim()
    $null = Invoke-Git @('add', '-A')
    $st = Invoke-Git @('status', '--porcelain')
    if ($st.out.Trim()) { $c = Invoke-Git @('commit', '-m', 'chore: baseline before night run'); Write-Log "Baseline commit: $($c.code)" 'INFO' }
    if ($br -ne 'night-run') {
        $exists = Invoke-Git @('rev-parse', '--verify', '--quiet', 'refs/heads/night-run')
        if ($exists.code -eq 0) { $null = Invoke-Git @('checkout', 'night-run') } else { $null = Invoke-Git @('checkout', '-b', 'night-run') }
    }
    $tagExists = Invoke-Git @('rev-parse', '--verify', '--quiet', 'refs/tags/night-run/baseline')
    if ($tagExists.code -ne 0) { $null = Invoke-Git @('tag', 'night-run/baseline') }
    Write-Log "Git branch: $((Invoke-Git @('rev-parse', '--abbrev-ref', 'HEAD')).out.Trim())" 'INFO'

    # Dependencies + Convex
    Write-Log 'npm install ...' 'INFO'
    $ni = Invoke-Shell "$Npm install --no-audit --no-fund" (Join-Path $LogDir 'preflight-npm-install.log') 20
    if ($ni -ne 0) { Write-Log 'npm install failed (see preflight-npm-install.log) - continuing, step 02 will fix deps' 'WARN' }
    $envLocal = Join-Path $Root '.env.local'
    if (-not (Test-Path -LiteralPath $envLocal) -or -not (Select-String -LiteralPath $envLocal -Pattern '^CONVEX_DEPLOYMENT=' -Quiet)) { throw '.env.local with CONVEX_DEPLOYMENT is missing - run `npx convex dev` once interactively first.' }
    Write-Log 'Setting Convex Auth env vars on the DEV deployment (idempotent)...' 'INFO'
    $ae = Invoke-Native 'node' @('night-run/scripts/convex-auth-env.mjs')
    Write-Log (Get-ShortText $ae.out 400) 'INFO'
    if ($ae.code -ne 0) { Write-Log 'Could not set Convex auth env vars - step 03 will try; check `npx convex login`.' 'WARN' }

    # Admin credentials for the seed/admin tests
    $adminPath = Join-Path $StateDir 'admin.json'
    if (-not (Test-Path -LiteralPath $adminPath)) {
        $adm = [ordered]@{ email = 'admin@mihajlo-estate.local'; password = ('Me-' + (New-Secret 20)); name = 'Mihajlo (admin)' }
        Write-Utf8File $adminPath ($adm | ConvertTo-Json)
        Write-Log "Admin credentials generated in night-run/state/admin.json" 'INFO'
    }
    New-Item -ItemType Directory -Force -Path (Join-Path $Root 'media-src') | Out-Null
    Write-SkillsInventory

    # Smoke test: models, auto mode, flags
    $models = @($Steps | ForEach-Object { Resolve-Model $_.Model } | Select-Object -Unique)
    foreach ($m in $models) {
        $probe = Test-ModelReady $m
        if ($probe.ok) { Write-Log "Model '$m' OK" 'OK'; continue }
        if ($probe.outcome -eq 'bad_flag') { Write-Log "CLI rejected a flag during the probe: $(Get-ShortText $probe.run.stderr 300)" 'ERROR'; throw 'Unsupported CLI flags - update Claude Code (claude update).' }
        if ($probe.outcome -eq 'auth') { throw "Claude Code is not logged in / billing problem: $(Get-ShortText (Get-ResultText $probe.run) 300)" }
        $next = Get-NextModel $m
        Write-Log "Model '$m' not usable right now ($($probe.outcome)) - mapping to '$next'" 'WARN'
        if ($next) { $script:State.modelMap[$m] = $next; Save-State }
    }
    if ($script:PermMode -eq 'auto') {
        $pm = Resolve-Model 'fable'
        $log = Join-Path $LogDir 'probe-auto-mode.jsonl'
        $a = @('-p', 'Reply with exactly one word: READY', '--model', $pm, '--effort', 'low', '--permission-mode', 'auto', '--output-format', 'stream-json', '--verbose', '--no-session-persistence')
        if ($script:SupportsPromptsNone) { $a += @('--permission-prompts', 'none') }
        $r = Invoke-ClaudeRun -ArgList $a -LogFile $log -TimeoutMin 5 -Label 'probe auto mode'
        if ((Get-Outcome $r) -eq 'bad_flag' -and $script:SupportsPromptsNone) {
            $script:SupportsPromptsNone = $false
            Write-Log '--permission-prompts not supported - continuing without it' 'WARN'
        } elseif ($r.permissionMode -and $r.permissionMode -ne 'auto') {
            if ($Cfg.FallbackToBypass) { $script:PermMode = 'bypassPermissions'; Write-Log "Auto mode unavailable (session started in '$($r.permissionMode)') - using bypassPermissions" 'WARN' }
            else { Write-Log "Auto mode unavailable (session started in '$($r.permissionMode)')" 'WARN' }
        } else { Write-Log "Auto mode OK" 'OK' }
    }
    if (@($Steps | Where-Object { $_.Effort -eq 'ultracode' }).Count -gt 0 -and $script:SupportsUltracode) {
        $log = Join-Path $LogDir 'probe-ultracode.jsonl'
        $r = Invoke-ClaudeRun -ArgList @('-p', 'Reply with exactly one word: READY', '--model', (Resolve-Model 'fable'), '--effort', 'ultracode', '--permission-mode', 'dontAsk', '--output-format', 'stream-json', '--verbose', '--no-session-persistence') -LogFile $log -TimeoutMin 8 -Label 'probe ultracode'
        if ((Get-Outcome $r) -ne 'success') { $script:SupportsUltracode = $false; Write-Log 'ultracode effort not accepted - those steps will use xhigh' 'WARN' } else { Write-Log 'ultracode OK' 'OK' }
    }
    Save-State
    Write-Log '=== Preflight done ===' 'OK'
}

# ------------------------------------------------------------------ step runner
function Set-StepNote($Step, [string]$Note) { $st = Get-StepState $Step.Id; $st.notes = $Note; Save-State; Update-Status }

function Invoke-Step($Step, [int]$Index) {
    $st = Get-StepState $Step.Id
    $st.status = 'running'; $st.startedAt = (Get-Date).ToString('s'); $st.endedAt = $null; $st.notes = ''
    Save-State
    $label = "Step $($Step.Id) - $($Step.Title)"
    Write-Log "================ $label ================" 'STEP'
    $model = Resolve-Model $Step.Model
    $st.model = $model
    $mode = [string]$Step.Mode
    $timeout = [int]$Step.TimeoutMin; if ($timeout -le 0) { $timeout = [int]$Cfg.DefaultTimeoutMin }

    $resumeId = $null
    if ($Step.Session -eq 'continue' -and $Index -gt 0) {
        $prev = Get-StepState $Steps[$Index - 1].Id
        if ($prev.sessionId) { $resumeId = [string]$prev.sessionId; Write-Log "Continuing the session of step $($Steps[$Index - 1].Id): $resumeId" 'INFO' }
        else { Write-Log 'Previous session id unknown - starting a new session' 'WARN' }
    }
    if ($st.sessionId -and $st.status -ne 'done') { $resumeId = [string]$st.sessionId }   # resume an interrupted attempt of this step

    if ($mode -eq 'goal' -and -not $script:SupportsGoal) { $mode = 'auto' }
    switch ($mode) { 'plan' { $prompt = Get-PlanText $Step } 'auto' { $prompt = Get-AutoText $Step } default { $prompt = Get-GoalText $Step } }
    $fixes = 0; $errors = 0; $timeouts = 0; $permOverride = $null; $attempt = 0

    :attemptLoop while ($true) {
        $attempt++; $st.attempts = [int]$st.attempts + 1
        if ($attempt -gt 14) { $st.status = 'failed'; Set-StepNote $Step 'too many attempts'; break attemptLoop }
        $script:Current = "$label (attempt $attempt, model $model, effort $($Step.Effort))"
        Update-Status
        $args2 = Build-Args $Step $model $Step.Effort $prompt $resumeId $permOverride
        if ($DryRun) { Write-Log ("DRY RUN: claude " + (ConvertTo-ArgString $args2)) 'INFO'; $st.status = 'pending'; Save-State; return }
        $logFile = Join-Path $LogDir ('{0}-a{1}.jsonl' -f $Step.Id, $attempt)
        Stop-DevServers
        $r = Invoke-ClaudeRun -ArgList $args2 -LogFile $logFile -TimeoutMin $timeout -Label $label
        if ($r.sessionId) { $st.sessionId = $r.sessionId; $resumeId = $r.sessionId }
        if ($r.result -and $r.result.total_cost_usd) { try { $st.costUsd = [double]$r.result.total_cost_usd } catch { } }
        Save-State

        # auto mode silently unavailable -> the session starts in default/manual mode and every tool is denied
        if ($mode -ne 'plan' -and $script:PermMode -eq 'auto' -and -not $permOverride -and $r.permissionMode -and $r.permissionMode -notin @('auto')) {
            if ($Cfg.FallbackToBypass) { Write-Log "Session started in '$($r.permissionMode)' instead of auto - retrying with bypassPermissions" 'WARN'; $script:PermMode = 'bypassPermissions'; continue attemptLoop }
        }

        $outcome = Get-Outcome $r
        $rtext = Get-ResultText $r
        Write-Log ("Outcome: {0} | exit {1} | turns {2} | {3}" -f $outcome, $r.exitCode, $(if ($r.result) { $r.result.num_turns } else { '?' }), (Get-ShortText $rtext 220)) 'INFO'

        switch ($outcome) {
            'success' {
                if ($mode -eq 'plan') {
                    $plan = $r.planText
                    if (-not $plan -or $plan.Length -lt $rtext.Length) { $plan = $rtext }
                    if (-not $plan -or $plan.Length -lt 1500) {
                        if ($errors -lt 2) { $errors++; $prompt = 'Output the COMPLETE implementation plan now as Markdown in your final message (all 6 sections). Do not summarize it - the full text is saved to docs/IMPLEMENTATION-PLAN.md.'; continue attemptLoop }
                    }
                    $header = "<!-- Written by night-run step 01 (plan mode, $model, effort $($Step.Effort)) on $(Get-Date -Format 's') -->`n`n"
                    Write-Utf8File (Join-Path $Root 'docs/IMPLEMENTATION-PLAN.md') ($header + $plan)
                    Write-Utf8File (Join-Path $StepsStateDir ('{0}.done.md' -f $Step.Id)) ("# Step $($Step.Id) done`n`nPlan saved to docs/IMPLEMENTATION-PLAN.md ($($plan.Length) chars).`n")
                    Save-Checkpoint $Step
                    $st.status = 'done'; break attemptLoop
                }
                if ($Step.Gate -eq 'none') { Save-Checkpoint $Step; $st.status = 'done'; break attemptLoop }
                $doneFile = Join-Path $StepsStateDir ('{0}.done.md' -f $Step.Id)
                if (-not (Test-Path -LiteralPath $doneFile) -and $fixes -lt [int]$Cfg.MaxFixAttempts) {
                    $fixes++; Write-Log 'Done file missing - asking the session to finish the end protocol' 'WARN'
                    $prompt = Get-DoneFileGoalText $Step; continue attemptLoop
                }
                $g = Invoke-Gate $Step ("a$attempt")
                if ($g.ok) {
                    Save-Checkpoint $Step
                    $st.status = 'done'
                    if (-not (Test-Path -LiteralPath $doneFile)) { $st.status = 'done-with-issues'; Set-StepNote $Step 'no done file' }
                    break attemptLoop
                }
                if ($fixes -lt [int]$Cfg.MaxFixAttempts) {
                    $fixes++; Write-Log "Resuming the session to fix the gate (fix attempt $fixes)" 'WARN'
                    $prompt = Get-FixGoalText $Step $g.tail $g.code; continue attemptLoop
                }
                Save-Checkpoint $Step ' (verify failing)'
                Add-Utf8Line (Join-Path $Root 'docs/PROGRESS.md') ("`n## Step $($Step.Id) - WARNING from night-run.ps1 ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))`n- npm run verify still failing after $fixes fix attempts (exit $($g.code)). The next step must fix it first. Gate log: night-run/logs/$RunStamp/$(Split-Path -Leaf $g.log)")
                $null = Invoke-Git @('add', '-A'); $null = Invoke-Git @('commit', '-m', ('chore(night-run): note failing gate after step {0}' -f $Step.Id))
                $st.status = 'done-with-issues'; Set-StepNote $Step "verify failing (exit $($g.code))"
                break attemptLoop
            }
            'usage_limit' {
                $blob = "$rtext`n$($r.stderr)`n$($r.lastText)"
                $reset = Get-ResetTime $blob
                $maxWait = [double]$Cfg.MaxUsageWaitHours; if ($maxWait -le 0) { $maxWait = 6 }
                $isLong = ($blob -match '(?i)weekly')
                if ($reset -and ($reset - (Get-Date)).TotalHours -le $maxWait -and -not $isLong) {
                    Set-StepNote $Step "usage limit, waiting until $($reset.ToString('HH:mm'))"
                    Wait-Until $reset.AddMinutes(3) 'usage limit reset'
                } elseif ($reset -or $isLong) {
                    $next = Get-NextModel $model
                    if ($next) {
                        Write-Log "Long usage limit (reset: $reset, weekly: $isLong) - switching $model -> $next for the rest of the run" 'WARN'
                        $script:State.modelMap[$model] = $next; $model = $next; $st.model = $model; Save-State
                        Set-StepNote $Step "limit on previous model, now $model"
                    } else {
                        $when = (Get-Date).AddMinutes(45); if ($reset) { $when = $reset.AddMinutes(3) }
                        Wait-Until $when 'usage limit on every model in the ladder'
                    }
                }
                # Unknown reset or after waiting: probe cheaply before resuming; wait in 20-min slices while limited.
                $tries = 0
                while ($tries -lt 12) {
                    $p = Test-ModelReady $model
                    if ($p.ok) { break }
                    if ($p.outcome -ne 'usage_limit' -and $p.outcome -ne 'rate_limit' -and $p.outcome -ne 'overloaded') { break }
                    $tries++; Wait-Until (Get-Date).AddMinutes(20) "still limited ($($p.outcome))"
                }
                if ($tries -ge 12) {
                    $next = Get-NextModel $model
                    if ($next) { Write-Log "Still limited after 4h - switching $model -> $next" 'WARN'; $script:State.modelMap[$model] = $next; $model = $next; $st.model = $model; Save-State }
                }
                if ($mode -ne 'goal') { $prompt = 'Continue exactly where you left off and complete the task.' }
                continue attemptLoop
            }
            { $_ -in @('rate_limit', 'overloaded') } {
                $errors++
                if ($errors -gt [int]$Cfg.MaxErrorRetries + 3) { $st.status = 'failed'; Set-StepNote $Step "API $outcome repeatedly"; break attemptLoop }
                $mins = [Math]::Min(30, 3 * $errors)
                Wait-Until (Get-Date).AddMinutes($mins) "API $outcome (retry $errors)"
                if ($mode -ne 'goal') { $prompt = 'Continue exactly where you left off and complete the task.' }
                continue attemptLoop
            }
            'model_unavailable' {
                $next = Get-NextModel $model
                if (-not $next) { $st.status = 'failed'; Set-StepNote $Step "model $model unavailable"; break attemptLoop }
                Write-Log "Model $model unavailable - switching to $next" 'WARN'
                $script:State.modelMap[$model] = $next; $model = $next; $st.model = $model; Save-State
                continue attemptLoop
            }
            'auth' {
                $st.status = 'failed'; Set-StepNote $Step 'auth/billing problem'
                Write-Log "Claude Code authentication/billing problem: $(Get-ShortText $rtext 300). Log in by running claude once interactively, then re-run this script." 'ERROR'
                Save-State; Update-Status
                throw 'Stopping: authentication/billing problem.'
            }
            'bad_flag' {
                Write-Log "The CLI rejected a flag: $(Get-ShortText $r.stderr 400)" 'ERROR'
                if ($script:SupportsPromptsNone -and $r.stderr -match 'permission-prompts') { $script:SupportsPromptsNone = $false; continue attemptLoop }
                if ($Step.Effort -eq 'ultracode' -and $script:SupportsUltracode) { $script:SupportsUltracode = $false; continue attemptLoop }
                $st.status = 'failed'; Set-StepNote $Step 'CLI flag rejected'; break attemptLoop
            }
            'timeout' {
                $timeouts++
                if ($timeouts -le 2) {
                    Write-Log "Resuming after timeout ($timeouts)" 'WARN'
                    if ($mode -ne 'goal') { $prompt = 'Continue exactly where you left off and complete the task.' }
                    continue attemptLoop
                }
                $g = Invoke-Gate $Step 'after-timeouts'
                Save-Checkpoint $Step ' (timed out)'
                if ($g.ok) { $st.status = 'done-with-issues' } else { $st.status = 'done-with-issues' }
                Set-StepNote $Step "timed out x$timeouts; verify ok=$($g.ok)"
                break attemptLoop
            }
            default {
                $errors++
                if ($errors -gt [int]$Cfg.MaxErrorRetries) {
                    $g = Invoke-Gate $Step 'after-errors'
                    Save-Checkpoint $Step ' (errors)'
                    $st.status = 'done-with-issues'; Set-StepNote $Step "errors x$errors ($outcome); verify ok=$($g.ok)"
                    break attemptLoop
                }
                Write-Log "Error ($outcome) - resuming in 60s (retry $errors)" 'WARN'
                Start-Sleep -Seconds 60
                if ($mode -ne 'goal') { $prompt = 'Continue exactly where you left off and complete the task.' }
                continue attemptLoop
            }
        }
        break attemptLoop
    }
    $st.endedAt = (Get-Date).ToString('s')
    Save-State
    Update-Status
    Stop-DevServers
    Write-Log ("{0} finished with status '{1}'" -f $label, $st.status) $(if ($st.status -eq 'done') { 'OK' } else { 'WARN' })
}

# ------------------------------------------------------------------ main
$exitCode = 0
try {
    Write-Log "Mihajlo Estate night run - root $Root - log $LogDir" 'STEP'
    Set-KeepAwake $true
    $script:ClaudeExe = Resolve-Claude
    if (-not $SkipPreflight -and -not $DryRun) { Invoke-Preflight } else { Write-Log 'Preflight skipped' 'WARN' }
    Update-Status

    $startIndex = 0
    if ($From) {
        $idx = -1; for ($i = 0; $i -lt $Steps.Count; $i++) { if ($Steps[$i].Id -eq $From) { $idx = $i } }
        if ($idx -lt 0) { throw "Unknown step id '$From'" }
        $startIndex = $idx
    }
    for ($i = $startIndex; $i -lt $Steps.Count; $i++) {
        $s = $Steps[$i]
        if ($Only -and $s.Id -ne $Only) { continue }
        $st = Get-StepState $s.Id
        $isDone = ($st.status -eq 'done' -or $st.status -eq 'done-with-issues')
        if ($isDone -and -not $Redo -and -not $Only) { Write-Log "Skipping step $($s.Id) ($($st.status))" 'INFO'; continue }
        if ($isDone -and ($Redo -or $Only)) { $st.sessionId = $null; $st.attempts = 0; $st.status = 'pending' }
        Invoke-Step $s $i
    }
    $script:Current = ''
    Update-Status
    $summary = @($Steps | ForEach-Object { '{0}={1}' -f $_.Id, (Get-StepState $_.Id).status }) -join ' '
    Write-Log "Night run finished: $summary" 'OK'
} catch {
    $exitCode = 1
    Write-Log "Runner stopped: $_" 'ERROR'
    $script:Current = "STOPPED: $_"
    Update-Status
} finally {
    Set-KeepAwake $false
    Save-State
}
exit $exitCode
