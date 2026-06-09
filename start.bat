@echo off
chcp 65001 >nul
title DocMind Server

echo ========================================
echo   DocMind
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] Starting backend (port 8000)...
start "DocMind Backend" cmd /c "python -m uvicorn src.main:app --host 0.0.0.0 --port 8000"

echo [2/2] Starting frontend (port 5173)...
cd frontend
start "DocMind Frontend" cmd /c "npm run dev"
cd ..

echo.
echo Waiting for servers to be ready...

:wait_backend
timeout /t 2 >nul
netstat -an | findstr ":8000.*LISTENING" >nul 2>&1
if errorlevel 1 goto wait_backend
echo   [OK] Backend ready (port 8000)

:wait_frontend
timeout /t 2 >nul
netstat -an | findstr ":5173.*LISTENING" >nul 2>&1
if errorlevel 1 goto wait_frontend
echo   [OK] Frontend ready (port 5173)

echo.
echo   Backend:  http://localhost:8000
echo   Docs:    http://localhost:8000/docs
echo   Frontend: http://localhost:5173
echo.
echo   Close this window to stop all services
echo ========================================

start http://localhost:5173
