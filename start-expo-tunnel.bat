@echo off
setlocal enabledelayedexpansion
title ExpiryGo - Expo Go Tunnel Launcher
set EXPO_NO_TELEMETRY=1
echo ============================================================
echo   🚀 EXPIRYGO - EXPO GO TUNNEL LAUNCHER (WORLDWIDE ACCESS)
echo ============================================================
echo.
echo   This mode uses a secure tunnel so your phone can connect
echo   from ANY network (Wi-Fi, Mobile Data 4G/5G, or Hotspot)
echo   even if Windows Firewall or Router blocks local Wi-Fi.
echo.
echo ============================================================
echo.

:: Clean Port 8081
node clean_ports.cjs 2>nul

cd mobile
echo Starting Expo Go with Tunnel...
npx expo start --go --tunnel ngrok -c
pause

