@echo off
chcp 65001 >nul
title Beeboo Bots 24/7 Worker
cd /d "%~dp0"
echo ==============================================================
echo   🚀 تشغيل بوتات Beeboo الـ 9 بشكل مستمر (24/7 Auto-Restart)
echo ==============================================================
:loop
node worker.js
echo [تحذير] توقف البوت أو حدثت إعادة تشغيل... جارٍ إعادة التشغيل خلال 5 ثوانٍ...
timeout /t 5 >nul
goto loop
