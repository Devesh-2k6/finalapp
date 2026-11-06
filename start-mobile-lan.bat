@echo off
setlocal enabledelayedexpansion
title Meeva Mobile - Expo Go LAN Mode
set EXPO_NO_TELEMETRY=1

:: 1. Auto-detect Wi-Fi IPv4 address and sync configs
for /f "tokens=*" %%i in ('node get_ip.cjs 2^>nul') do set LAN_IP=%%i

if "%LAN_IP%"=="" (
    for /f "tokens=*" %%i in ('python get_ip.py 2^>nul') do set LAN_IP=%%i
)

if "%LAN_IP%"=="" (
    set LAN_IP=172.23.27.186
)

:: 2. Ensure Port 8081 is clean
node clean_ports.cjs 2>nul || python -c "import subprocess, re; out = subprocess.getoutput('netstat -ano | findstr :8081'); pids = set(re.findall(r'\s+(\d+)\r?$', out, re.M)); [subprocess.run(['taskkill', '/F', '/PID', pid], capture_output=True) for pid in pids if pid != '0']" 2>nul

echo ============================================================
echo   📱 MEEVA MOBILE - EXPO GO LAN MODE (exp://%LAN_IP%:8081)
echo ============================================================
echo.
echo Make sure your phone is connected to the same Wi-Fi (%LAN_IP%)
echo.
cd mobile
set REACT_NATIVE_PACKAGER_HOSTNAME=%LAN_IP%
npx expo start --go --host lan -c
pause
