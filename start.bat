@echo off
chcp 65001 >nul
title DocMind Server

echo ========================================
echo   DocMind - 智能文档处理助手
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] 启动后端服务 (端口 8000)...
start "DocMind Backend" cmd /c "python -m uvicorn src.main:app --host 0.0.0.0 --port 8000"

echo [2/2] 启动前端开发服务器 (端口 5173)...
cd frontend
start "DocMind Frontend" cmd /c "npm run dev"

echo.
echo ✓ 项目启动中，请稍候...
echo.
echo   后端:  http://localhost:8000
echo   文档:  http://localhost:8000/docs
echo   前端:  http://localhost:5173
echo.
echo   关闭此窗口即可停止所有服务
echo ========================================

timeout /t 5 >nul
start http://localhost:5173
