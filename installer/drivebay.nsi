; Drivebay Windows installer. Packs installer/staging (see stage.mjs).
; Pinokio install.js / start.js are not used by this script.

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

!ifndef VERSION
  !define VERSION "3.18"
!endif
!ifndef VERSION4
  !define VERSION4 "3.18.0.0"
!endif

Name "Drivebay ${VERSION}"
OutFile "dist\Drivebay-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\Drivebay"
InstallDirRegKey HKCU "Software\Drivebay" "InstallDir"
RequestExecutionLevel user
Unicode True
SetCompressor /SOLID lzma
BrandingText "Drivebay ${VERSION}"
ShowInstDetails show

!define MUI_ABORTWARNING
!define MUI_ICON "assets\drivebay.ico"
!define MUI_UNICON "assets\drivebay.ico"
!define MUI_WELCOMEPAGE_TITLE "Install Drivebay"
!define MUI_WELCOMEPAGE_TEXT "Drivebay is a password-locked file browser for every drive on this PC.$\r$\n$\r$\nThis setup includes the program and the runtime it needs. You do not need Node.js, git, or Pinokio.$\r$\n$\r$\nYou will choose Tailscale or a regular connection, pick a free port, and set the password."
!define MUI_FINISHPAGE_TITLE "Drivebay is installed"
!define MUI_FINISHPAGE_TEXT "Open Drivebay and sign in with the username and password you just chose.$\r$\n$\r$\nOther devices can connect only after you open and forward the port you picked on your router.$\r$\n$\r$\nStart Drivebay from the Start menu. Uninstall it from the Start menu or from Apps."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Open Drivebay in my browser"
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchDrivebay

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
Page custom ModePageCreate ModePageLeave
Page custom PortPageCreate PortPageLeave
Page custom RouterPageCreate RouterPageLeave
Page custom TailscalePageCreate TailscalePageLeave
Page custom AccountPageCreate AccountPageLeave
Page custom OptionsPageCreate OptionsPageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
UninstPage custom un.DataPageCreate un.DataPageLeave
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Var Mode
Var ModeTailscale
Var ModeRegular
Var Port
Var PortField
Var Username
Var Password
Var UsernameField
Var PasswordField
Var ConfirmField
Var InstallTailscale
Var LaunchTailscale
Var HInstallTs
Var HLaunchTs
Var HAck
Var DesktopShortcut
Var StartWithWindows
Var HDesktop
Var HStartup
Var DeleteData
Var UnDeleteCheckbox

!macro WriteUtf16 FILE VALUE
  FileOpen $R9 "${FILE}" w
  FileWrite $R9 "${VALUE}"
  FileClose $R9
!macroend

Function .onInit
  StrCpy $Mode "regular"
  StrCpy $Port "42013"
  StrCpy $InstallTailscale "0"
  StrCpy $LaunchTailscale "0"
  StrCpy $DesktopShortcut "1"
  StrCpy $StartWithWindows "0"
  SetShellVarContext current
FunctionEnd

Function un.onInit
  SetShellVarContext current
  StrCpy $DeleteData ${BST_UNCHECKED}
FunctionEnd

Function ModePageCreate
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 28u "How should other devices reach this PC? You still pick a port either way, and you still have to forward that port on your router."
  Pop $0
  ${NSD_CreateFirstRadioButton} 0 36u 100% 12u "Tailscale — reach Drivebay over your tailnet"
  Pop $ModeTailscale
  ${NSD_CreateAdditionalRadioButton} 0 52u 100% 14u "Regular — this network, without Tailscale"
  Pop $ModeRegular
  ${If} $Mode == "tailscale"
    ${NSD_SetState} $ModeTailscale ${BST_CHECKED}
  ${Else}
    ${NSD_SetState} $ModeRegular ${BST_CHECKED}
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function ModePageLeave
  ${NSD_GetState} $ModeTailscale $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $Mode "tailscale"
  ${Else}
    StrCpy $Mode "regular"
  ${EndIf}
FunctionEnd

Function PortPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 32u "Choose the port Drivebay listens on. This step is required. The port must be free on this PC (1024–65535). The next page tells you to forward this same port on your router."
  Pop $0
  ${NSD_CreateLabel} 0 36u 100% 10u "Port"
  Pop $0
  ${NSD_CreateText} 0 48u 80u 12u "$Port"
  Pop $PortField
  nsDialogs::Show
FunctionEnd

Function PortIsDigits
  ; $Port -> $0 = 1 when every character is a digit and the value is 1024-65535
  StrLen $1 $Port
  ${If} $1 < 4
  ${OrIf} $1 > 5
    StrCpy $0 0
    Return
  ${EndIf}
  StrCpy $2 0
  ${While} $2 < $1
    StrCpy $3 $Port 1 $2
    ${If} $3 < "0"
    ${OrIf} $3 > "9"
      StrCpy $0 0
      Return
    ${EndIf}
    IntOp $2 $2 + 1
  ${EndWhile}
  ${If} $Port < 1024
  ${OrIf} $Port > 65535
    StrCpy $0 0
    Return
  ${EndIf}
  StrCpy $0 1
FunctionEnd

Function PortPageLeave
  ${NSD_GetText} $PortField $Port
  Call PortIsDigits
  ${If} $0 != 1
    MessageBox MB_OK|MB_ICONEXCLAMATION "Enter a port from 1024 to 65535."
    Abort
  ${EndIf}
  nsExec::ExecToStack 'powershell.exe -NoProfile -NonInteractive -Command "try { $$l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, [int]$Port); $$l.Start(); $$l.Stop(); exit 0 } catch { exit 1 }"'
  Pop $0
  Pop $1
  ${If} $0 != "0"
    MessageBox MB_OK|MB_ICONEXCLAMATION "Port $Port is already in use on this PC. Enter a different port."
    Abort
  ${EndIf}
FunctionEnd

Function RouterPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 12u "Open this port on your router"
  Pop $0
  ${NSD_CreateLabel} 0 16u 100% 18u "TCP port $Port"
  Pop $0
  ${NSD_CreateLabel} 0 38u 100% 48u "You have to open and forward TCP port $Port on your router.$\r$\n$\r$\nPhones and other computers cannot reach Drivebay until your router forwards port $Port to this PC. This is required for Tailscale mode and for regular mode.$\r$\n$\r$\nIf Windows Firewall asks, allow Drivebay or TCP port $Port as well."
  Pop $0
  ${NSD_CreateCheckbox} 0 96u 100% 18u "I understand I must open and forward port $Port on my router."
  Pop $HAck
  nsDialogs::Show
FunctionEnd

Function RouterPageLeave
  ${NSD_GetState} $HAck $0
  ${If} $0 != ${BST_CHECKED}
    MessageBox MB_OK|MB_ICONEXCLAMATION "Check the box to confirm you will open and forward port $Port on your router."
    Abort
  ${EndIf}
FunctionEnd

Function TailscalePageCreate
  ${If} $Mode != "tailscale"
    Abort
  ${EndIf}
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 56u "Tailscale mode. Devices on your tailnet reach this PC at http://<this-PC-tailscale-name>:$Port/ after you sign in to Tailscale on both devices.$\r$\n$\r$\nYou still have to open and forward TCP port $Port on your router.$\r$\n$\r$\nDrivebay can download the official Tailscale installer from pkgs.tailscale.com and run it. Tailscale's own window will open."
  Pop $0
  ${NSD_CreateCheckbox} 0 62u 100% 12u "Download and install Tailscale (official installer)"
  Pop $HInstallTs
  ${NSD_CreateCheckbox} 0 78u 100% 14u "Launch Tailscale when setup finishes"
  Pop $HLaunchTs
  ${If} $InstallTailscale == "1"
    ${NSD_SetState} $HInstallTs ${BST_CHECKED}
  ${EndIf}
  ${If} $LaunchTailscale == "1"
    ${NSD_SetState} $HLaunchTs ${BST_CHECKED}
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function TailscalePageLeave
  ${NSD_GetState} $HInstallTs $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $InstallTailscale "1"
  ${Else}
    StrCpy $InstallTailscale "0"
  ${EndIf}
  ${NSD_GetState} $HLaunchTs $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $LaunchTailscale "1"
  ${Else}
    StrCpy $LaunchTailscale "0"
  ${EndIf}
FunctionEnd

Function UsernameOk
  StrLen $1 $Username
  ${If} $1 < 1
  ${OrIf} $1 > 64
    StrCpy $0 0
    Return
  ${EndIf}
  StrCpy $2 0
  ${While} $2 < $1
    StrCpy $3 $Username 1 $2
    StrCpy $4 0
    ${If} $3 >= "0"
    ${AndIf} $3 <= "9"
      StrCpy $4 1
    ${EndIf}
    ${If} $3 >= "A"
    ${AndIf} $3 <= "Z"
      StrCpy $4 1
    ${EndIf}
    ${If} $3 >= "a"
    ${AndIf} $3 <= "z"
      StrCpy $4 1
    ${EndIf}
    ${If} $2 > 0
      ${If} $3 == "."
      ${OrIf} $3 == "-"
      ${OrIf} $3 == "_"
        StrCpy $4 1
      ${EndIf}
    ${EndIf}
    ${If} $4 != 1
      StrCpy $0 0
      Return
    ${EndIf}
    IntOp $2 $2 + 1
  ${EndWhile}
  StrCpy $0 1
FunctionEnd

Function AccountPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 32u "Set the only Drivebay account. After this, nobody else can sign up. Use at least 8 characters. This password is the lock for every drive on this PC."
  Pop $0
  ${NSD_CreateLabel} 0 34u 100% 8u "Username (letters, numbers, dot, dash, underscore)"
  Pop $0
  ${NSD_CreateText} 0 44u 100% 12u "$Username"
  Pop $UsernameField
  ${NSD_CreateLabel} 0 60u 100% 8u "Password"
  Pop $0
  ${NSD_CreatePassword} 0 70u 100% 12u ""
  Pop $PasswordField
  ${NSD_CreateLabel} 0 86u 100% 8u "Confirm password"
  Pop $0
  ${NSD_CreatePassword} 0 96u 100% 12u ""
  Pop $ConfirmField
  nsDialogs::Show
FunctionEnd

Function AccountPageLeave
  ${NSD_GetText} $UsernameField $Username
  ${NSD_GetText} $PasswordField $Password
  ${NSD_GetText} $ConfirmField $1
  Call UsernameOk
  ${If} $0 != 1
    MessageBox MB_OK|MB_ICONEXCLAMATION "Enter a username using letters, numbers, dots, dashes, or underscores."
    Abort
  ${EndIf}
  StrLen $2 $Password
  ${If} $2 < 8
    MessageBox MB_OK|MB_ICONEXCLAMATION "Use a password of at least 8 characters."
    Abort
  ${EndIf}
  ${If} $Password != $1
    MessageBox MB_OK|MB_ICONEXCLAMATION "Passwords do not match."
    Abort
  ${EndIf}
FunctionEnd

Function OptionsPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 20u "Shortcuts. Drivebay is also added to the Start menu, with an uninstaller."
  Pop $0
  ${NSD_CreateCheckbox} 0 28u 100% 12u "Desktop shortcut"
  Pop $HDesktop
  ${NSD_CreateCheckbox} 0 44u 100% 16u "Start Drivebay when I sign in to Windows"
  Pop $HStartup
  ${If} $DesktopShortcut == "1"
    ${NSD_SetState} $HDesktop ${BST_CHECKED}
  ${EndIf}
  ${If} $StartWithWindows == "1"
    ${NSD_SetState} $HStartup ${BST_CHECKED}
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function OptionsPageLeave
  ${NSD_GetState} $HDesktop $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $DesktopShortcut "1"
  ${Else}
    StrCpy $DesktopShortcut "0"
  ${EndIf}
  ${NSD_GetState} $HStartup $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $StartWithWindows "1"
  ${Else}
    StrCpy $StartWithWindows "0"
  ${EndIf}
FunctionEnd

Function LaunchDrivebay
  Exec '"$SYSDIR\wscript.exe" //nologo "$INSTDIR\start-drivebay.vbs"'
FunctionEnd

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "staging\*.*"
  WriteUninstaller "$INSTDIR\uninstall.exe"

  !insertmacro WriteUtf16 "$TEMP\drivebay-pending-user.txt" "$Username"
  !insertmacro WriteUtf16 "$TEMP\drivebay-pending-password.txt" "$Password"
  System::Call 'Kernel32::SetEnvironmentVariable(t "DRIVEBAY_HOME", t "$LOCALAPPDATA\Drivebay")'
  System::Call 'Kernel32::SetEnvironmentVariable(t "DRIVEBAY_PORT", t "$Port")'
  System::Call 'Kernel32::SetEnvironmentVariable(t "DRIVEBAY_MODE", t "$Mode")'
  System::Call 'Kernel32::SetEnvironmentVariable(t "DRIVEBAY_VERSION", t "${VERSION}")'
  System::Call 'Kernel32::SetEnvironmentVariable(t "DRIVEBAY_SETUP_USER_FILE", t "$TEMP\drivebay-pending-user.txt")'
  System::Call 'Kernel32::SetEnvironmentVariable(t "DRIVEBAY_SETUP_PASSWORD_FILE", t "$TEMP\drivebay-pending-password.txt")'
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\windows\write-setup.ps1"'
  Pop $0
  Delete "$TEMP\drivebay-pending-user.txt"
  Delete "$TEMP\drivebay-pending-password.txt"
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Drivebay is installed, but the password file could not be saved. The first time you open Drivebay, set the username and password in the browser."
  ${EndIf}

  DetailPrint "You must open and forward TCP port $Port on your router."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\windows\firewall.ps1" -Action add'
  Pop $0

  ${If} $Mode == "tailscale"
  ${AndIf} $InstallTailscale == "1"
    DetailPrint "Downloading the official Tailscale installer..."
    nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\windows\install-tailscale.ps1"'
    Pop $0
    ${If} $0 != 0
      MessageBox MB_OK|MB_ICONEXCLAMATION "Tailscale was not installed. Drivebay is still installed. Download Tailscale from https://tailscale.com/download/windows and sign in so this PC joins your tailnet. Other devices use http://<this-PC-tailscale-name>:$Port/ — and you still must forward TCP port $Port on your router."
    ${EndIf}
  ${EndIf}
  ${If} $Mode == "tailscale"
  ${AndIf} $LaunchTailscale == "1"
    nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\windows\launch-tailscale.ps1"'
    Pop $0
  ${EndIf}

  CreateDirectory "$SMPROGRAMS\Drivebay"
  CreateShortCut "$SMPROGRAMS\Drivebay\Drivebay.lnk" "$SYSDIR\wscript.exe" '//nologo "$INSTDIR\start-drivebay.vbs"' "$INSTDIR\assets\drivebay.ico"
  CreateShortCut "$SMPROGRAMS\Drivebay\Stop Drivebay.lnk" "$SYSDIR\wscript.exe" '//nologo "$INSTDIR\stop-drivebay.vbs"' "$INSTDIR\assets\drivebay.ico"
  CreateShortCut "$SMPROGRAMS\Drivebay\Uninstall Drivebay.lnk" "$INSTDIR\uninstall.exe"
  ${If} $DesktopShortcut == "1"
    CreateShortCut "$DESKTOP\Drivebay.lnk" "$SYSDIR\wscript.exe" '//nologo "$INSTDIR\start-drivebay.vbs"' "$INSTDIR\assets\drivebay.ico"
  ${EndIf}
  ${If} $StartWithWindows == "1"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Drivebay" '"$SYSDIR\wscript.exe" //nologo "$INSTDIR\start-drivebay.vbs"'
  ${Else}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Drivebay"
  ${EndIf}

  WriteRegStr HKCU "Software\Drivebay" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Drivebay" "DisplayName" "Drivebay"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Drivebay" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Drivebay" "Publisher" "Drivebay"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Drivebay" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Drivebay" "DisplayIcon" "$INSTDIR\assets\drivebay.ico"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Drivebay" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Drivebay" "NoRepair" 1
SectionEnd

Function un.DataPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 28u "Drivebay's program files, shortcuts, and startup entry will be removed. The password database stays unless you check the box below."
  Pop $0
  ${NSD_CreateCheckbox} 0 36u 100% 20u "Also delete the saved password and settings"
  Pop $UnDeleteCheckbox
  nsDialogs::Show
FunctionEnd

Function un.DataPageLeave
  ${NSD_GetState} $UnDeleteCheckbox $DeleteData
FunctionEnd

Section "Uninstall"
  nsExec::ExecToLog '"$INSTDIR\runtime\node.exe" "$INSTDIR\launcher.mjs" --stop'
  Pop $0
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\windows\firewall.ps1" -Action remove'
  Pop $0
  Sleep 400
  Delete "$DESKTOP\Drivebay.lnk"
  Delete "$SMPROGRAMS\Drivebay\Drivebay.lnk"
  Delete "$SMPROGRAMS\Drivebay\Stop Drivebay.lnk"
  Delete "$SMPROGRAMS\Drivebay\Uninstall Drivebay.lnk"
  RMDir "$SMPROGRAMS\Drivebay"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Drivebay"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Drivebay"
  DeleteRegKey HKCU "Software\Drivebay"
  RMDir /r "$INSTDIR"
  ${If} $DeleteData == ${BST_CHECKED}
    RMDir /r "$LOCALAPPDATA\Drivebay"
  ${EndIf}
SectionEnd

VIProductVersion "${VERSION4}"
VIAddVersionKey "ProductName" "Drivebay"
VIAddVersionKey "FileDescription" "Drivebay setup"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Drivebay"
