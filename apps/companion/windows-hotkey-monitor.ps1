param(
    [Parameter(Mandatory = $true)][ValidateRange(1, 255)][int]$VirtualKey,
    [Parameter(Mandatory = $true)][ValidateRange(0, 15)][int]$Modifiers,
    [Parameter(Mandatory = $true)][ValidatePattern('^\d+$')][string]$WindowHandle,
    [switch]$HealthOnly
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class ForeverTreasureNativeMonitor {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG {
        public IntPtr hwnd;
        public uint message;
        public UIntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public int ptX;
        public int ptY;
    }

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool PeekMessage(out MSG message, IntPtr hWnd, uint min, uint max, uint remove);
}
'@

function Write-MonitorEvent {
    param([Parameter(Mandatory = $true)][hashtable]$Event)
    $Event.timestamp = [DateTimeOffset]::UtcNow.ToString('o')
    [Console]::Out.WriteLine(($Event | ConvertTo-Json -Compress))
    [Console]::Out.Flush()
}

function Test-KeyDown {
    param([int]$Key)
    return (([ForeverTreasureNativeMonitor]::GetAsyncKeyState($Key) -band 0x8000) -ne 0)
}

function Test-ModifiersDown {
    param([int]$Flags)
    if (($Flags -band 1) -ne 0 -and -not ((Test-KeyDown 0x12) -or (Test-KeyDown 0xA4) -or (Test-KeyDown 0xA5))) { return $false }
    if (($Flags -band 2) -ne 0 -and -not ((Test-KeyDown 0x11) -or (Test-KeyDown 0xA2) -or (Test-KeyDown 0xA3))) { return $false }
    if (($Flags -band 4) -ne 0 -and -not ((Test-KeyDown 0x10) -or (Test-KeyDown 0xA0) -or (Test-KeyDown 0xA1))) { return $false }
    if (($Flags -band 8) -ne 0 -and -not ((Test-KeyDown 0x5B) -or (Test-KeyDown 0x5C))) { return $false }
    return $true
}

$registered = $true
if (-not $HealthOnly) {
    $modifierNoRepeat = [uint32]($Modifiers -bor 0x4000)
    $registered = [ForeverTreasureNativeMonitor]::RegisterHotKey([IntPtr]::Zero, 0x4654, $modifierNoRepeat, [uint32]$VirtualKey)
}
Write-MonitorEvent @{ type = 'registration'; registered = $registered; healthOnly = [bool]$HealthOnly; virtualKey = $VirtualKey; modifiers = $Modifiers }
if (-not $registered) { exit 3 }

$targetHandle = [IntPtr]::Zero
if ($WindowHandle -ne '0') { $targetHandle = [IntPtr]([Int64]::Parse($WindowHandle)) }
$held = $false
$heldAt = [DateTimeOffset]::MinValue
$lastHealth = [DateTimeOffset]::MinValue
$message = New-Object ForeverTreasureNativeMonitor+MSG

try {
    while ($true) {
        while ([ForeverTreasureNativeMonitor]::PeekMessage([ref]$message, [IntPtr]::Zero, 0, 0, 1)) { }

        if (-not $HealthOnly) {
            $down = (Test-KeyDown $VirtualKey) -and (Test-ModifiersDown $Modifiers)
            if ($down -and -not $held) {
                $held = $true
                $heldAt = [DateTimeOffset]::UtcNow
                Write-MonitorEvent @{ type = 'keydown' }
            }
            elseif (-not $down -and $held) {
                $held = $false
                Write-MonitorEvent @{ type = 'keyup' }
            }
            elseif ($held -and ([DateTimeOffset]::UtcNow - $heldAt).TotalSeconds -gt 10) {
                $held = $false
                Write-MonitorEvent @{ type = 'release-lost' }
            }
        }

        if ($targetHandle -ne [IntPtr]::Zero -and ([DateTimeOffset]::UtcNow - $lastHealth).TotalMilliseconds -ge 500) {
            $lastHealth = [DateTimeOffset]::UtcNow
            $exists = [ForeverTreasureNativeMonitor]::IsWindow($targetHandle)
            $minimized = $false
            $width = 0
            $height = 0
            if ($exists) {
                $minimized = [ForeverTreasureNativeMonitor]::IsIconic($targetHandle)
                $rectangle = New-Object ForeverTreasureNativeMonitor+RECT
                if ([ForeverTreasureNativeMonitor]::GetClientRect($targetHandle, [ref]$rectangle)) {
                    $width = [Math]::Max(0, $rectangle.Right - $rectangle.Left)
                    $height = [Math]::Max(0, $rectangle.Bottom - $rectangle.Top)
                }
            }
            Write-MonitorEvent @{
                type = 'health'
                windowHandle = $WindowHandle
                closed = (-not $exists)
                minimized = $minimized
                dimensions = @{ width = $width; height = $height }
            }
        }
        Start-Sleep -Milliseconds 20
    }
}
finally {
    if (-not $HealthOnly) { [void][ForeverTreasureNativeMonitor]::UnregisterHotKey([IntPtr]::Zero, 0x4654) }
}
