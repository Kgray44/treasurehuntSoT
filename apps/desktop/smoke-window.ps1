param(
    [Parameter(Mandatory = $true)]
    [ValidateLength(8, 180)]
    [string]$Title
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = $Title
$form.Width = 960
$form.Height = 540
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$form.Location = New-Object System.Drawing.Point(40, 40)
$form.BackColor = [System.Drawing.Color]::FromArgb(7, 27, 37)

$canvas = New-Object System.Windows.Forms.Panel
$canvas.Dock = [System.Windows.Forms.DockStyle]::Fill
$darkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(11, 43, 57))
$lightBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(196, 164, 91))
$canvas.Add_Paint({
    param($sender, $eventArgs)
    $phase = ($script:frame * 14) % 96
    $eventArgs.Graphics.FillRectangle($darkBrush, $sender.ClientRectangle)
    for ($x = -96; $x -lt ($sender.ClientSize.Width + 96); $x += 96) {
        $eventArgs.Graphics.FillRectangle($lightBrush, ($x + $phase), 0, 42, $sender.ClientSize.Height)
    }
})
$form.Controls.Add($canvas)

$label = New-Object System.Windows.Forms.Label
$label.AutoSize = $true
$label.Text = "PACKAGED DESKTOP ADAPTER CAPTURE"
$label.Font = New-Object System.Drawing.Font("Segoe UI", 24, [System.Drawing.FontStyle]::Bold)
$label.ForeColor = [System.Drawing.Color]::FromArgb(244, 213, 141)
$label.Location = New-Object System.Drawing.Point(60, 160)
$form.Controls.Add($label)

$marker = New-Object System.Windows.Forms.Panel
$marker.Width = 72
$marker.Height = 72
$marker.BackColor = [System.Drawing.Color]::White
$marker.Location = New-Object System.Drawing.Point(40, 300)
$form.Controls.Add($marker)

$frame = 0
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 50
$timer.Add_Tick({
    $script:frame += 1
    $marker.Left = 40 + (($script:frame * 13) % 780)
    $form.BackColor = [System.Drawing.Color]::FromArgb(
        7 + (($script:frame * 2) % 35),
        27 + (($script:frame * 3) % 45),
        37 + (($script:frame * 5) % 55)
    )
    $canvas.Invalidate()
})
$form.Add_Shown({ $timer.Start(); $form.Activate() })
$form.Add_FormClosed({
    $timer.Stop()
    $timer.Dispose()
    $darkBrush.Dispose()
    $lightBrush.Dispose()
})
[void]$form.ShowDialog()
