[CmdletBinding()]
param(
	[int] $Port = 3080,
	[int] $StartupTimeoutSeconds = 45,
	[switch] $NoOpen
)

$ErrorActionPreference = "Stop"

try {
	$Host.UI.RawUI.WindowTitle = "dsh-web (127.0.0.1:$Port)"
} catch {
	# The launcher can also be checked from a non-interactive shell.
}

function Resolve-PowerShell7 {
	$candidates = @(
		if ($env:ProgramW6432) { Join-Path $env:ProgramW6432 "PowerShell\7\pwsh.exe" }
		if ($env:ProgramFiles) { Join-Path $env:ProgramFiles "PowerShell\7\pwsh.exe" }
		if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "Programs\PowerShell\7\pwsh.exe" }
	)
	foreach ($candidate in $candidates) {
		if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
	}
	$command = Get-Command pwsh.exe -ErrorAction SilentlyContinue | Select-Object -First 1
	if ($null -ne $command) {
		$path = if ([string]::IsNullOrWhiteSpace($command.Source)) { $command.Path } else { $command.Source }
		if (-not [string]::IsNullOrWhiteSpace($path) -and (Test-Path -LiteralPath $path -PathType Leaf)) { return $path }
	}
	throw "PowerShell 7 (pwsh.exe) is not available."
}

function Resolve-DshCommand {
	$command = Get-Command dsh -ErrorAction Stop | Select-Object -First 1
	$path = if ([string]::IsNullOrWhiteSpace($command.Source)) { $command.Path } else { $command.Source }
	if ([string]::IsNullOrWhiteSpace($path)) { throw "The dsh command does not resolve to a launchable path." }
	if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "The dsh command path is not available: $path" }
	return $path
}

function Get-PortBinding {
	param([int] $TargetPort)
	$netstat = Join-Path ([Environment]::GetEnvironmentVariable("SystemRoot")) "System32\netstat.exe"
	if (-not (Test-Path -LiteralPath $netstat -PathType Leaf)) { $netstat = "netstat.exe" }
	$listenerLines = @(
		& $netstat -ano 2>$null |
			ForEach-Object { $_.ToString() } |
			Where-Object { $_ -match "^\s*TCP\s+" -and $_ -match "\bLISTENING\s+\d+\s*$" }
	)
	$portLines = @($listenerLines | Where-Object { $_ -match ":$TargetPort\s+" })
	$loopbackLines = @($portLines | Where-Object { $_ -match "^\s*TCP\s+127\.0\.0\.1:$TargetPort\s+" })
	$nonLoopbackLines = @($portLines | Where-Object { $_ -notmatch "^\s*TCP\s+127\.0\.0\.1:$TargetPort\s+" })
	return [pscustomobject]@{
		Listening = $portLines.Count -gt 0
		LoopbackOnly = $portLines.Count -gt 0 -and $loopbackLines.Count -gt 0 -and $nonLoopbackLines.Count -eq 0
		NonLoopback = $nonLoopbackLines.Count -gt 0
		Lines = $portLines
	}
}

function Wait-ForDshWebUi {
	param(
		[int] $TargetPort,
		[int] $TimeoutSeconds
	)
	$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
	$uri = "http://127.0.0.1:$TargetPort/"
	while ([DateTime]::UtcNow -lt $deadline) {
		$binding = Get-PortBinding -TargetPort $TargetPort
		if ($binding.NonLoopback) { return $false }
		if ($binding.LoopbackOnly) {
			try {
				$response = Invoke-WebRequest -Uri $uri -TimeoutSec 2 -MaximumRedirection 5
				if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { return $true }
			} catch {
				# The listener can come up before the WebUI route is ready.
			}
		}
		Start-Sleep -Milliseconds 250
	}
	return $false
}

function Minimize-ForegroundTerminal {
	if (-not ("DshForegroundWindow" -as [type])) {
		Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class DshForegroundWindow
{
    [DllImport("kernel32.dll")]
    public static extern IntPtr GetConsoleWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
	}
	$windowHandle = [DshForegroundWindow]::GetConsoleWindow()
	if ($windowHandle -eq [IntPtr]::Zero) {
		Write-Warning "Could not resolve the foreground terminal window handle; leaving the terminal visible."
		return
	}
	# SW_MINIMIZE = 6. This minimizes the console; it does not hide or detach it.
	# ShowWindow's return value describes the window's previous visibility state,
	# not whether the minimize request succeeded.
	[DshForegroundWindow]::ShowWindow($windowHandle, 6) | Out-Null
}

function Stop-DshTree {
	param([System.Diagnostics.Process] $Process)
	if ($null -eq $Process -or $Process.HasExited) { return }
	$taskkill = Join-Path ([Environment]::GetEnvironmentVariable("SystemRoot")) "System32\taskkill.exe"
	if (Test-Path -LiteralPath $taskkill -PathType Leaf) {
		& $taskkill /PID $Process.Id /T /F 2>$null | Out-Null
	} else {
		Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
	}
}

$workingDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$powerShell = Resolve-PowerShell7
$dshCommand = Resolve-DshCommand
$binding = Get-PortBinding -TargetPort $Port

if ($binding.NonLoopback) {
	throw "Refusing to start dsh because port $Port has a non-loopback listener."
}

if ($binding.LoopbackOnly) {
	if (-not (Wait-ForDshWebUi -TargetPort $Port -TimeoutSeconds $StartupTimeoutSeconds)) {
		throw "dsh is listening on 127.0.0.1:$Port, but the WebUI did not become ready within $StartupTimeoutSeconds seconds."
	}
	Write-Host "dsh is already running on http://127.0.0.1:$Port"
	Write-Host "WebUI is ready; minimizing this foreground terminal."
	[void](Minimize-ForegroundTerminal)
	return
}

$dshArguments = @(
	"-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass",
	"-File", $dshCommand, "--profile", "web"
)
if ($NoOpen) { $dshArguments += "--no-open" }

Write-Host "Starting dsh in this foreground terminal..."
Write-Host "The web service must bind exclusively to 127.0.0.1:$Port."
$dshProcess = Start-Process -FilePath $powerShell -ArgumentList $dshArguments -WorkingDirectory $workingDirectory -NoNewWindow -PassThru

try {
	$deadline = [DateTime]::UtcNow.AddSeconds($StartupTimeoutSeconds)
	while ([DateTime]::UtcNow -lt $deadline) {
		$binding = Get-PortBinding -TargetPort $Port
		if ($binding.Listening) { break }
		if ($dshProcess.HasExited) {
			throw "dsh exited before it started listening (exit code $($dshProcess.ExitCode))."
		}
		Start-Sleep -Milliseconds 250
	}

	$binding = Get-PortBinding -TargetPort $Port
	if (-not $binding.Listening) {
		throw "dsh did not start listening on 127.0.0.1:$Port within $StartupTimeoutSeconds seconds."
	}
	if (-not $binding.LoopbackOnly) {
		throw "dsh is not bound exclusively to 127.0.0.1:$Port; refusing to keep it running."
	}
	if (-not (Wait-ForDshWebUi -TargetPort $Port -TimeoutSeconds $StartupTimeoutSeconds)) {
		throw "dsh is listening on 127.0.0.1:$Port, but the WebUI did not become ready within $StartupTimeoutSeconds seconds."
	}

	Write-Host "dsh is running on http://127.0.0.1:$Port"
	Write-Host "WebUI is ready; minimizing this foreground terminal."
	[void](Minimize-ForegroundTerminal)
	$dshProcess.WaitForExit()
	Write-Host "dsh stopped with exit code $($dshProcess.ExitCode). The terminal remains open."
} catch {
	Stop-DshTree -Process $dshProcess
	throw
}
