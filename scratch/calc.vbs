Set WshShell = WScript.CreateObject("WScript.Shell")
WshShell.Run "calc.exe"
WScript.Sleep 1000
WshShell.AppActivate "Calculator"
WScript.Sleep 500
WshShell.SendKeys "1"
WScript.Sleep 200
WshShell.SendKeys "{+}"
WScript.Sleep 200
WshShell.SendKeys "2"
WScript.Sleep 200
WshShell.SendKeys "{ENTER}"
