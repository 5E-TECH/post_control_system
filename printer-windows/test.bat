@echo off
echo.
echo =====================================================
echo    BEEPOST PRINTER - TEST UTILITY
echo =====================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js topilmadi!
    echo Node.js ni https://nodejs.org dan o'rnating
    pause
    exit /b 1
)

echo Bu script printeringizni tekshiradi.
echo.
echo Printeringiz ulangan va yoniq ekanligiga ishonch hosil qiling.
echo.

set /p PORT="Port kiriting (bosh qoldiring = auto detect): "

if "%PORT%"=="" (
    echo.
    echo Auto detect rejimi...
    node scripts/test-printer.js
) else (
    echo.
    echo %PORT% portni sinash...
    node scripts/test-printer.js %PORT%
)

echo.
pause
