@echo off
setlocal enabledelayedexpansion
title ExpiryGo - Expo Go Scanner Launcher
set EXPO_NO_TELEMETRY=1
echo ============================================================
echo   📱 EXPIRYGO - EXPO GO SCANNER & MOBILE APP LAUNCHER
echo ============================================================
echo.

:: 1. Auto-detect Wi-Fi IP
for /f "tokens=*" %%i in ('node get_ip.cjs 2^>nul') do set LAN_IP=%%i
if "%LAN_IP%"=="" (
    for /f "tokens=*" %%i in ('python get_ip.py 2^>nul') do set LAN_IP=%%i
)
if "%LAN_IP%"=="" (
    set LAN_IP=172.23.27.186
)

echo [Detected Active Wi-Fi IP]: %LAN_IP%
echo.

:: 2. Clean Port 8081
echo [Ensuring Port 8081 is free]...
node clean_ports.cjs 2>nul
echo.

:: 3. Select Mode
echo Choose how you want to run the mobile app:
echo   [1] LAN Mode (Default - Fast, requires phone on same Wi-Fi: %LAN_IP%)
echo   [2] Tunnel Mode (RECOMMENDED if you got "Something went wrong" - Works anywhere, cellular/firewall)
echo   [3] Web Mode (Run the mobile app right inside your PC Browser side-by-side with web)
echo.
set MODE=1
set /p MODE="Select mode [1, 2, or 3] (Press Enter for 1): "

if "%MODE%"=="2" (
    echo.
    echo [Starting Expo Go in TUNNEL Mode]...
    echo The QR code below will connect securely via tunnel!
    echo.
    cd mobile
    npx expo start --go --tunnel ngrok -c
) else if "%MODE%"=="3" (
    echo.
    echo [Starting Mobile App in Web Browser Mode]...
    cd mobile
    npx expo start --web
) else (
    echo.
    echo [Starting Expo Go in LAN Mode on %LAN_IP%:8081]...
    echo Scan with Expo Go (Android) or Camera (iOS).
    echo (Tip: In the terminal below, press 't' to switch to tunnel, or 'w' for web)
    echo.
    cd mobile
    set REACT_NATIVE_PACKAGER_HOSTNAME=%LAN_IP%
    npx expo start --go --host lan -c
)
pause
