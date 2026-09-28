@echo off
rem Mihajlo Estate night run - one-time fresh restart (Claude, 2026-09-28 23:40)
cd /d "%~dp0.."
start "Mihajlo Estate - night run" powershell -NoExit -ExecutionPolicy Bypass -File "%~dp0night-run.ps1" -Fresh -SkipUpdate
