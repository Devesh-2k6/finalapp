@echo off
setlocal enabledelayedexpansion
title ExpiryGo - Expo Go Tunnel (Worldwide)
set EXPO_NO_TELEMETRY=1
cd /d "%~dp0"

echo ============================================================
echo   📱 EXPIRYGO - EXPO GO (TUNNEL MODE - WORLDWIDE ACCESS)
echo ============================================================
echo.
echo Freeing port 8081...
node clean_ports.cjs 2>nul

echo Starting Expo Go with Tunnel...
echo Connect your phone (iOS / Android) with Expo Go anywhere!
echo.
cd mobile
npx expo start --go --tunnel ngrok -c
pause
