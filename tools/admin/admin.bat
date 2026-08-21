@echo off
chcp 65001 >nul
title Platho - operator console

rem Launcher for a double click, and it is cmd rather than PowerShell on purpose: on a default Windows the execution
rem policy refuses npm.ps1 outright ("выполнение сценариев отключено в этой системе"), and relaxing a machine
rem security setting just to look at a balance is not something a tool may ask for. This asks for nothing.
rem
rem %~dp0 is this file's own folder, so two levels up land on the repo root wherever it was cloned. The server
rem derives its root the same way, so this cd is belt and braces rather than the mechanism.
rem
rem The browser is opened by the SERVER, from its listen callback — opening it here would race the port and land on
rem "connection refused".

cd /d "%~dp0..\.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js не найден. Установите его с https://nodejs.org и запустите этот файл снова.
  echo.
  pause
  exit /b 1
)

node scripts\serve_admin.mjs

echo.
echo   Сервер остановлен. Окно можно закрыть.
pause >nul
