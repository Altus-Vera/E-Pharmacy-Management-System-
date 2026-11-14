@echo off
title AltuVera Pharmacy - Start All
set SCRIPTS=%~dp0scripts

echo Starting AltuVera Pharmacy System...
echo.

start "Pharmacy API"          cmd /k "%SCRIPTS%\run-api.bat"
timeout /t 15 /nobreak >nul

start "Pharmacy ERP"          cmd /k "%SCRIPTS%\run-erp.bat"
start "Pharmacy POS React"    cmd /k "%SCRIPTS%\run-pos-react.bat"
timeout /t 20 /nobreak >nul

start "Pharmacy POS Desktop"  cmd /k "%SCRIPTS%\run-pos-desktop.bat"

echo.
echo  All services launched:
echo.
echo   API          http://localhost:8000
echo   ERP          http://localhost:5121
echo   POS React    http://localhost:5120
echo   POS Desktop  Electron window opens shortly
echo.
echo  First run: cd frontend\pos-desktop ^& npm install
echo.
pause
