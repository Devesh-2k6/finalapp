@echo off
setlocal enabledelayedexpansion
title ExpiryGo - Expo Go Host
set EXPO_NO_TELEMETRY=1
cd /d "%~dp0"

echo ============================================================
echo   📱 EXPIRYGO - EXPO GO HOSTING LAUNCHER
echo ============================================================
echo.

:: 1. Auto-detect Wi-Fi IP and sync
for /f "tokens=*" %%i in ('node get_ip.cjs 2^>nul') do set LAN_IP=%%i
if "%LAN_IP%"=="" set LAN_IP=10.88.239.184
echo [Detected Wi-Fi / LAN IP]: %LAN_IP%
echo.

:: 2. Ensure Port 8081 is clean
echo [Freeing Port 8081 if occupied]...
node clean_ports.cjs 2>nul
echo.

:: 3. Mode selection (Supports parameter %1: tunnel, lan, web)
set MODE=%1
if "%MODE%"=="" (
    echo Select hosting mode for Expo Go:
    echo   [1] Tunnel Mode (RECOMMENDED - Works on any Wi-Fi, 4G/5G, bypasses router isolation)
    echo   [2] LAN Mode    (Fastest - Requires phone connected to same Wi-Fi: %LAN_IP%)
    echo   [3] Web Mode    (Test in PC browser)
    echo.
    choice /C 123 /N /T 5 /D 1 /M "Select [1=Tunnel, 2=LAN, 3=Web] (Auto-defaults to 1 in 5s): "
    if errorlevel 3 set MODE=web
    if errorlevel 2 if not "%MODE%"=="web" set MODE=lan
    if errorlevel 1 if not "%MODE%"=="web" if not "%MODE%"=="lan" set MODE=tunnel
)

cd mobile
if /i "%MODE%"=="2" set MODE=lan
if /i "%MODE%"=="3" set MODE=web
if /i "%MODE%"=="1" set MODE=tunnel

if /i "%MODE%"=="lan" (
    echo.
    echo [Starting Expo Go in LAN Mode on exp://%LAN_IP%:8081]...
    echo.
    set REACT_NATIVE_PACKAGER_HOSTNAME=%LAN_IP%
    npx expo start --go --host lan -c
) else if /i "%MODE%"=="web" (
    echo.
    echo [Starting Expo Mobile in Web Mode]...
    echo.
    npx expo start --web
) else (
    echo.
    echo [Starting Expo Go in TUNNEL Mode (Worldwide Access)]...
    echo.
    npx expo start --go --tunnel ngrok -c
)

pause
