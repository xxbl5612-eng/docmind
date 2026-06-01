@echo off
echo 正在停止 DocMind 服务...
taskkill /FI "WINDOWTITLE eq DocMind*" /F 2>nul
taskkill /FI "WINDOWTITLE eq npm*" /F 2>nul
echo 已停止
pause
