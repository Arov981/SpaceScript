@echo off
setlocal
title SpaceScript Bridge
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [SpaceScript] Node.js was not found on your PATH.
  echo  [SpaceScript] Install Node.js 18+ from https://nodejs.org then re-run start.bat.
  echo.
  pause
  exit /b 1
)

echo.
echo  Starting SpaceScript Bridge...
echo  Dashboard: http://127.0.0.1:6471
echo.
node bridge\index.js
if errorlevel 1 (
  echo.
  echo  [SpaceScript] Bridge exited with an error.
  pause
)
