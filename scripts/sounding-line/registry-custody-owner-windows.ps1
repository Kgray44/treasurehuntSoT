param([ValidateSet('console','directories','verify')][string]$Operation='console')
$ErrorActionPreference='Stop'
if($Operation -eq 'console'){
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class VoyagewrightPrivateConsole {
 [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
}
'@
 $window=[VoyagewrightPrivateConsole]::GetConsoleWindow()
 [pscustomobject]@{attached=($window -ne [IntPtr]::Zero);visible=($window -ne [IntPtr]::Zero -and [VoyagewrightPrivateConsole]::IsWindowVisible($window));secretInputRead=$false}|ConvertTo-Json -Compress
 exit
}
$created=[Collections.Generic.List[string]]::new()
$directories=[Collections.Generic.List[object]]::new()
try{
 $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $system=[Security.Principal.SecurityIdentifier]::new('S-1-5-18')
 foreach($drive in @('C:','D:')){
  $leaf=Join-Path $drive '\VoyagewrightRecovery\SoundingLine\B\generation-0001'
  if($Operation -eq 'directories' -and (Test-Path -LiteralPath $leaf)){throw 'GENERATION_ALREADY_EXISTS'}
  $ancestor=$leaf
  while($ancestor){
   if((Test-Path -LiteralPath $ancestor) -and ((Get-Item -LiteralPath $ancestor).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'DIRECTORY_ALIAS'}
   $next=Split-Path $ancestor;if($next -eq $ancestor){break};$ancestor=$next
  }
  if($Operation -eq 'directories'){
  $parent=$drive+'\'
  foreach($name in @('VoyagewrightRecovery','SoundingLine','B','generation-0001')){
   $parent=Join-Path $parent $name
   if(-not(Test-Path -LiteralPath $parent)){[void](New-Item -ItemType Directory -Path $parent -ErrorAction Stop);$created.Add($parent)}
   elseif($name -eq 'generation-0001'){throw 'GENERATION_ALREADY_EXISTS'}
  }
  $acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetOwner($owner);$acl.SetAccessRuleProtection($true,$false)
  foreach($sid in @($owner,$system)){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::FullControl,([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit),[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow))}
  Set-Acl -LiteralPath $leaf -AclObject $acl
  }
  $readback=Get-Acl -LiteralPath $leaf
  if($readback.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $owner.Value){throw 'ACL_OWNER'}
  if(-not $readback.AreAccessRulesProtected){throw 'ACL_NOT_PROTECTED'}
  $rules=@($readback.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
  if($rules.Count -ne 2){throw 'ACL_SCOPE'}
  foreach($rule in $rules){if($rule.IdentityReference.Value -notin @($owner.Value,'S-1-5-18') -or $rule.IsInherited -or $rule.InheritanceFlags -ne ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit) -or $rule.PropagationFlags -ne [Security.AccessControl.PropagationFlags]::None -or $rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or $rule.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl){throw 'ACL_SCOPE'}}
  $files=@(Get-ChildItem -LiteralPath $leaf -Force)
  if($files.Count -gt 4){throw 'FILE_SCOPE'}
  foreach($file in $files){
   if($file.PSIsContainer -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $file.Name -notin @('registry-key.pkcs8.age','package-created.public.json','custody.public.json','README-recovery.txt')){throw 'FILE_SCOPE'}
   $fileAcl=Get-Acl -LiteralPath $file.FullName
   if($fileAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $owner.Value -or $fileAcl.AreAccessRulesProtected){throw 'FILE_ACL_OWNER_OR_INHERITANCE'}
   $fileRules=@($fileAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
   if($fileRules.Count -ne 2){throw 'FILE_ACL_SCOPE'}
   foreach($rule in $fileRules){if($rule.IdentityReference.Value -notin @($owner.Value,'S-1-5-18') -or -not $rule.IsInherited -or $rule.InheritanceFlags -ne [Security.AccessControl.InheritanceFlags]::None -or $rule.PropagationFlags -ne [Security.AccessControl.PropagationFlags]::None -or $rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or $rule.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl){throw 'FILE_ACL_SCOPE'}}
  }
  $directories.Add(@{path=$leaf;acl=$readback.Sddl;ownerSid=$owner.Value})
 }
 $status=if($Operation -eq 'verify'){'VERIFIED_EXISTING_CUSTODY_ACL'}else{'NEW_DIRECTORIES_ONLY'}
 [pscustomobject]@{status=$status;created=$created.ToArray();directories=$directories.ToArray();keyFilesWritten=0}|ConvertTo-Json -Depth 5 -Compress
}catch{
 [pscustomobject]@{status='INCOMPLETE_DIRECTORIES';created=$created.ToArray();directories=$directories.ToArray();error='DIRECTORY_PREPARATION_FAILED';keyFilesWritten=0}|ConvertTo-Json -Depth 5 -Compress
 exit 1
}
