@echo off
title S.A.I.D. Cipher — Startup
color 0A

echo.
echo  ==========================================
echo   S.A.I.D. CIPHER — MYM LOGIC LLC
echo  ==========================================
echo.

:: Load NVM and switch to Node 18
set NVM_HOME=%APPDATA%\nvm
set NVM_SYMLINK=%ProgramFiles%\nodejs
call "%NVM_HOME%\nvm.exe" use 18 >nul 2>&1

:: Check if .env exists
if not exist .env (
    echo  [!] No .env file found.
    echo  [!] Copy .env.example to .env and add your OPENROUTER_API_KEY
    echo.
    pause
    exit /b 1
)

:: Check node
where node >nul 2>&1
if errorlevel 1 (
    echo  [!] Node.js not found. Run: nvm install 18
    pause
    exit /b 1
)

:: Install deps if needed
if not exist node_modules (
    echo  Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo  [!] npm install failed.
        pause
        exit /b 1
    )
)

echo.
echo  Launching Cipher...
echo.
npm start

