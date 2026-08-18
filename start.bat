@echo off
chcp 65001 >nul 2>nul
echo ========================================
echo   正在启动 Llama.cpp Web 控制台...
echo ========================================
cd /d "%~dp0"
echo 启动后台服务 (http://127.0.0.1:3001)...
start "Llama Web Console Server" node server/index.js
timeout /t 2 >nul
echo 正在打开浏览器...
start http://127.0.0.1:3001
echo ========================================
echo   服务已在后台运行！
echo ========================================
pause
