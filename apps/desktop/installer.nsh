!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Remove local Companion settings, cached packages, Creator recordings, and diagnostic bundles? Published or synchronized server data is not removed." IDNO preserveUserData
  RMDir /r "$APPDATA\The Forever Treasure Companion"
  preserveUserData:
!macroend
