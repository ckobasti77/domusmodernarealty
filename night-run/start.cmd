@echo off
rem Mihajlo Estate night run - double-click to resume where the run stopped
cd /d "%~dp0.."
start "Mihajlo Estate - night run" powershell -NoExit -ExecutionPolicy Bypass -File "%~dp0night-run.ps1" -SkipUpdate
