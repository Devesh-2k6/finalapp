@echo off
setlocal enabledelayedexpansion
title Meeva Ecosystem Launcher
echo ============================================================
echo   🚀 MEEVA - UNIFIED ECOSYSTEM LAUNCHER (WEB + MOBILE + API)
echo ============================================================
echo.

:: 1. Auto-detect Wi-Fi IPv4 address and sync configs
for /f "tokens=*" %%i in ('node get_ip.cjs 2^>nul') do set LAN_IP=%%i

if "%LAN_IP%"=="" (
    for /f "tokens=*" %%i in ('python get_ip.py 2^>nul') do set LAN_IP=%%i
)

if "%LAN_IP%"=="" (
    set LAN_IP=172.23.27.186
)

echo [Detected Active Network IP]: %LAN_IP%
echo.

:: 2. Ensure Ports 8000, 3000, and 8081 are clean
echo [Cleaning Ports 8000, 3000, 8081]...
node clean_ports.cjs 2>nul || python clean_ports.py 2>nul
echo.

:: 3. Ensure Database & Admin Account Ready
echo [1/4] Ensuring Database and Administrator Account...
python -c "import sys; sys.path.insert(0, 'backend'); from seed_data import ensure_ecosystem_ready; ensure_ecosystem_ready()" 2>nul
echo.

:: 4. Start Backend API
echo [2/4] Starting Backend FastAPI Server (http://0.0.0.0:8000)...
start "Meeva Backend API" cmd /k "title Meeva Backend API && cd backend && python run_server.py"
echo.

:: 5. Start Next.js Web App
echo [3/4] Starting Web Server (http://localhost:3000)...
start "Meeva Web App" cmd /k "title Meeva Web App && node serve_web.cjs"
echo.

:: 6. Start React Native Expo Go Mobile Server with QR Scanner
echo [4/5] Starting React Native Expo Go Mobile Server (%LAN_IP%:8081)...
start "Meeva Mobile App" cmd /k "title Meeva Expo Go Server && cd mobile && set EXPO_NO_TELEMETRY=1 && set REACT_NATIVE_PACKAGER_HOSTNAME=%LAN_IP% && npx expo start --go --host lan -c"
echo.

:: 7. Start Cloudflare Public HTTPS Tunnel for Worldwide Access
echo [5/5] Starting Global Cloudflare HTTPS Tunnel (Worldwide Access)...
start "Meeva Global Tunnel" cmd /k "title Meeva Global Cloudflare Tunnel && npx -y cloudflared tunnel --protocol http2 --url http://127.0.0.1:8000"
echo.

:: 8. Open Browser Companion & Web App
timeout /t 2 /nobreak >nul
start http://localhost:3000/auth
start http://localhost:3000/mobile

echo ============================================================
echo   ✅ SUCCESS! All services launched and synchronized:
echo   • Web App:        http://localhost:3000/auth
echo   • Backend API:    http://localhost:8000   (Docs: http://localhost:8000/docs)
echo   • Mobile App:     Expo Go (Scan QR in Mobile window or open exp://%LAN_IP%:8081)
echo   • Global Tunnel:  Look at 'Meeva Global Tunnel' window for your public https://*.trycloudflare.com link!
echo   • Web Companion:  Opened http://localhost:3000/mobile (QR Scanner & Sync Lab)
echo.
echo   📱 HOW TO USE WEB AND APP SIMULTANEOUSLY:
echo   1. PHONE (Expo Go): Connect to Wi-Fi (%LAN_IP%) and scan QR at http://localhost:3000/mobile.
echo   2. PC BROWSER (Side-by-side): In the 'Meeva Mobile App' terminal, press 'w' to launch
echo      the Mobile App at http://localhost:8081 right next to your Web App!
echo ============================================================
echo.
pause
