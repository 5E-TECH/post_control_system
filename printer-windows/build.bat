@echo off
echo.
echo =====================================================
echo    BEEPOST PRINTER - BUILD SCRIPT
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

echo [1/4] Node.js versiyasi:
node --version

echo.
echo [2/4] Paketlarni o'rnatish...
call npm install

if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm install xatosi!
    pause
    exit /b 1
)

echo.
echo [3/4] TypeScript kompilatsiya...
call npm run build

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build xatosi!
    pause
    exit /b 1
)

echo.
echo [4/4] EXE yaratish...
call npm run package

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Package xatosi!
    pause
    exit /b 1
)

echo.
echo =====================================================
echo    BUILD MUVAFFAQIYATLI!
echo =====================================================
echo.
echo EXE fayl: release\beepost-printer.exe
echo.
echo Keyingi qadamlar:
echo   1. release papkasini oching
echo   2. config.json ni sozlang
echo   3. beepost-printer.exe ni ishga tushiring
echo.

:: Copy config to release folder
if not exist release mkdir release
copy /Y config.json release\config.json >nul

echo config.json release papkasiga nusxalandi.
echo.
pause
