#!/bin/bash

echo "=========================================="
echo "        PDF处理工具 - 一键启动脚本"
echo "=========================================="
echo ""

PROJECT_ROOT=$(pwd)
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo "📦 检查并安装后端依赖..."
cd "$BACKEND_DIR"
if [ ! -d "node_modules" ]; then
    echo "   正在安装后端依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 后端依赖安装失败"
        exit 1
    fi
else
    echo "   后端依赖已存在"
fi

echo ""
echo "📦 检查并安装前端依赖..."
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
    echo "   正在安装前端依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 前端依赖安装失败"
        exit 1
    fi
else
    echo "   前端依赖已存在"
fi

echo ""
echo "🚀 启动后端服务 (端口: 5094)..."
cd "$BACKEND_DIR"
if command -v gnome-terminal &> /dev/null; then
    gnome-terminal --title="PDF Tool Backend" -- bash -c "cd '$BACKEND_DIR' && npm start; exec bash" &
elif command -v xterm &> /dev/null; then
    xterm -title "PDF Tool Backend" -e "cd '$BACKEND_DIR' && npm start" &
elif command -v osascript &> /dev/null; then
    osascript -e 'tell application "Terminal" to do script "cd '\''$BACKEND_DIR'\'' && npm start"' &
else
    echo "   无法自动打开终端，请手动在 $BACKEND_DIR 运行: npm start"
fi

sleep 2

echo "🚀 启动前端服务 (端口: 3094)..."
cd "$FRONTEND_DIR"
if command -v gnome-terminal &> /dev/null; then
    gnome-terminal --title="PDF Tool Frontend" -- bash -c "cd '$FRONTEND_DIR' && npm run dev; exec bash" &
elif command -v xterm &> /dev/null; then
    xterm -title "PDF Tool Frontend" -e "cd '$FRONTEND_DIR' && npm run dev" &
elif command -v osascript &> /dev/null; then
    osascript -e 'tell application "Terminal" to do script "cd '\''$FRONTEND_DIR'\'' && npm run dev"' &
else
    echo "   无法自动打开终端，请手动在 $FRONTEND_DIR 运行: npm run dev"
fi

echo ""
echo "=========================================="
echo "✅ 服务启动中..."
echo ""
echo "📱 前端地址: http://localhost:3094"
echo "🔧 后端地址: http://localhost:5094"
echo ""
echo "💡 请等待服务完全启动后访问前端地址"
echo "=========================================="
echo ""

if command -v open &> /dev/null; then
    sleep 3
    open http://localhost:3094
elif command -v xdg-open &> /dev/null; then
    sleep 3
    xdg-open http://localhost:3094
fi
