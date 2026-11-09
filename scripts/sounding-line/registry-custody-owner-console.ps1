# Run by the owner in a visible Windows PowerShell console, never a captured tool.
param(
 [ValidateSet('check-private-console','owner-prepare','owner-open-provider-registry')][string]$Operation='check-private-console',
 [string]$RunId,[string]$ArtifactId,[string]$PullRequest,[string]$ArchiveSha256,[string]$SourceBindingsDigest,
 [ValidateSet('C','D')][string]$RecoveryDrive
)
$ErrorActionPreference='Stop'
$ownerArguments=@('--operation',$Operation)
if($Operation -eq 'owner-open-provider-registry'){
 if($RunId -cnotmatch '^[1-9][0-9]{0,15}$' -or $ArtifactId -cnotmatch '^[1-9][0-9]{0,15}$' -or
    $PullRequest -cnotmatch '^[1-9][0-9]{0,15}$' -or $ArchiveSha256 -cnotmatch '^[a-f0-9]{64}$' -or
    $SourceBindingsDigest -cnotmatch '^[a-f0-9]{64}$' -or !$RecoveryDrive){
  throw 'OWNER_CUSTODY_ARGUMENTS'
 }
 $ownerArguments+=@($RunId,$ArtifactId,$PullRequest,$ArchiveSha256,$SourceBindingsDigest,$RecoveryDrive.ToUpperInvariant())
}elseif($RunId -or $ArtifactId -or $PullRequest -or $ArchiveSha256 -or $SourceBindingsDigest -or $RecoveryDrive){
 throw 'OWNER_CUSTODY_ARGUMENTS'
}
foreach($name in @('CODEX_THREAD_ID','CODEX_SESSION_ID','CODEX_TOOL_CALL_ID','CODEX_CI')){
 if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'OWNER_CUSTODY_CAPTURED_SESSION_REFUSED'}
}
if([Console]::IsInputRedirected -or [Console]::IsOutputRedirected -or [Console]::IsErrorRedirected){throw 'OWNER_CUSTODY_PRIVATE_CONSOLE_REQUIRED'}
$observation=& (Join-Path $PSScriptRoot 'registry-custody-owner-windows.ps1') -Operation console | ConvertFrom-Json
if(-not $observation.attached -or -not $observation.visible){throw 'OWNER_CUSTODY_VISIBLE_CONSOLE_REQUIRED'}
$node=Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.18.0-win-x64\node.exe'
$item=Get-Item -LiteralPath $node
if($item.Length -ne 92534088 -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'OWNER_CUSTODY_NODE_IDENTITY'}
$signature=Get-AuthenticodeSignature -LiteralPath $node
if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Thumbprint -ne 'CECD9673E955CA766047DD43706D31E48A6BD3B5'){throw 'OWNER_CUSTODY_NODE_SIGNATURE'}
if((Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash -ne '9A4EB5F1C29C6A2E93852EAD46B999E284A6A5CA8BAB4D4E241D587D025A52DE'){throw 'OWNER_CUSTODY_NODE_DIGEST'}
$keep=@('SystemRoot','WINDIR','SystemDrive','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','HOMEDRIVE','HOMEPATH','LOCALAPPDATA','APPDATA','USERNAME','USERDOMAIN','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS','OS')
$saved=@{}
foreach($entry in [Environment]::GetEnvironmentVariables('Process').GetEnumerator()){$saved[$entry.Key]=$entry.Value}
try{
 foreach($name in @($saved.Keys)){if($name -notin $keep){[Environment]::SetEnvironmentVariable($name,$null,'Process')}}
 # No NODE_OPTIONS, NODE_PATH, key value, password or execution-policy override.
 & $node (Join-Path $PSScriptRoot 'registry-custody-owner.mjs') @ownerArguments
 $result=$LASTEXITCODE
}finally{
 foreach($name in @([Environment]::GetEnvironmentVariables('Process').Keys)){if(-not $saved.ContainsKey($name)){[Environment]::SetEnvironmentVariable($name,$null,'Process')}}
 foreach($name in $saved.Keys){[Environment]::SetEnvironmentVariable($name,$saved[$name],'Process')}
}
exit $result
