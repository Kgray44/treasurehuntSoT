# Read-only metadata only. No key store, contents, credentials or mutation.
$ErrorActionPreference = 'Stop'
$parts = @(Get-Partition -DriveLetter C,D | Select-Object DriveLetter,DiskNumber,PartitionNumber,Size)
$disks = @(Get-Disk | ForEach-Object {
  $hasher = [Security.Cryptography.SHA256]::Create()
  try { $digest = $hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes([string]$_.UniqueId)) }
  finally { $hasher.Dispose() }
  [pscustomobject]@{ Number=$_.Number; FriendlyName=$_.FriendlyName; BusType=[string]$_.BusType; Size=$_.Size; UniqueIdSha256=([BitConverter]::ToString($digest).Replace('-','').ToLower()) }
})
$physical = @(Get-PhysicalDisk | Select-Object DeviceId,FriendlyName,MediaType,BusType,Size)
# Enum values must be text in Windows PowerShell JSON as well as PowerShell Core.
$physical = @($physical | ForEach-Object { [pscustomobject]@{ DeviceId=[string]$_.DeviceId; FriendlyName=$_.FriendlyName; MediaType=[string]$_.MediaType; BusType=[string]$_.BusType; Size=$_.Size } })
[pscustomobject]@{ partitions=$parts; disks=$disks; physicalDisks=$physical } | ConvertTo-Json -Depth 6 -Compress
