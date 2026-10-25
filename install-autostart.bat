@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
echo جارٍ إضافة البوت إلى بدء تشغيل ويندوز (يعمل بالخلفية بدون نوافذ)...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%STARTUP_FOLDER%\BeebooBots.lnk'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%~dp0run-bots-24-7.vbs\"'; $s.WorkingDirectory = '%~dp0'; $s.Save()"
echo ✅ تم التثبيت بنجاح! البوتات ستعمل دائماً بالخلفية تلقائياً عند تشغيل الكمبيوتر.
pause
