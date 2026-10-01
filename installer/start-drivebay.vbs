' Starts Drivebay. The tray app owns the server and has no console window.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
installDir = fso.GetParentFolderName(WScript.ScriptFullName)
tray = installDir & "\DrivebayTray.exe"
If fso.FileExists(tray) Then
  sh.CurrentDirectory = installDir
  sh.Run """" & tray & """", 0, False
  WScript.Quit 0
End If
node = installDir & "\runtime\node.exe"
launcher = installDir & "\launcher.mjs"
If Not fso.FileExists(node) Then
  MsgBox "Drivebay's bundled runtime is missing." & vbCrLf & node, 16, "Drivebay"
  WScript.Quit 1
End If
sh.CurrentDirectory = installDir
sh.Run """" & node & """ """ & launcher & """", 0, True
