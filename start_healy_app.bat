@echo off
echo Starting Healy Academy App...
cd /d "%~dp0app"

:: Start the dev server in the background
start /b npm run dev

:: Wait for 7 seconds to let the server start
echo Waiting for server to initialize...
timeout /t 7 >nul

:: Open the browser in Chrome specifically
start chrome http://localhost:3000

:: Keep the window open to show logs
echo.
echo Healy Academy is running! 🚀
echo Keep this window open while using the app.
pause
