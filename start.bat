@echo off
title Llama.cpp Web Console - Port 5175
cd /d "%~dp0"

echo ====================================================
echo   Llama.cpp Web Console Launcher
echo ====================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto NO_NODE

where npm >nul 2>nul
if errorlevel 1 goto NO_NPM

echo [1/3] Scanning port 5175 / 3001 for previous instances...
set "KILLED_PIDS="

for /f "tokens=2,5" %%a in ('netstat -aon ^| findstr ":5175" ^| findstr "LISTENING"') do (
    call :TERMINATE_PROCESS %%b %%a
)
for /f "tokens=2,5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do (
    call :TERMINATE_PROCESS %%b %%a
)
goto START_APP

:TERMINATE_PROCESS
set "TARGET_PID=%1"
set "BIND_ADDR=%2"
if "%TARGET_PID%"=="" goto :EOF
if "%TARGET_PID%"=="0" goto :EOF

echo %KILLED_PIDS% | findstr /c:" %TARGET_PID% " >nul
if errorlevel 1 (
    echo [INFO] Terminating previous process PID %TARGET_PID% on %BIND_ADDR%...
    taskkill /F /PID %TARGET_PID% >nul 2>nul
    set "KILLED_PIDS=%KILLED_PIDS% %TARGET_PID% "
)
goto :EOF

:START_APP
if defined KILLED_PIDS (
    echo [INFO] Waiting for port to be released...
    timeout /t 1 /nobreak >nul
)

echo [2/3] Opening browser at http://127.0.0.1:5175 ...
start "" "http://127.0.0.1:5175"

echo [3/3] Starting Web Console via npm start on port 5175...
echo.
echo ====================================================
echo   Server is starting up...
echo   (Keep this window open)
echo ====================================================
echo.

call npm start

echo.
echo ====================================================
echo   Server process stopped.
echo ====================================================
echo.
pause
exit /b 0

:NO_NODE
echo [ERROR] Node.js is not found in PATH!
echo Please install Node.js from https://nodejs.org/
echo.
pause
exit /b 1

:NO_NPM
echo [ERROR] npm is not found in PATH!
echo.
pause
exit /b 1
