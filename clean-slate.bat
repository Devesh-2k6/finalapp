@echo off
echo ============================================================
echo   🧹 EXPIRYGO - CLEAN SLATE INITIALIZER (ZERO DEMO PRODUCTS)
echo ============================================================
echo.
echo Wiping all accounts and preparing clean zero-account real environment...
cd backend
python wipe_all_accounts_zero.py
cd ..
echo.
echo Database is clean with 0 accounts and 0 demo products. Ready for real testing!
pause
