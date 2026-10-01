' Stops the Drivebay server started by start-drivebay.vbs.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
installDir = fso.GetParentFolderName(WScript.ScriptFullName)
node = installDir & "\runtime\node.exe"
launcher = installDir & "\launcher.mjs"
If Not fso.FileExists(node) Then
  MsgBox "Drivebay's bundled runtime is missing.", 16, "Drivebay"
  WScript.Quit 1
End If
sh.CurrentDirectory = installDir
sh.Run """" & node & """ """ & launcher & """ --stop", 0, True
MsgBox "Drivebay has stopped.", 64, "Drivebay"
