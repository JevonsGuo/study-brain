#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "====== 构建前端 ======"
cd "$ROOT_DIR/sharon-study-app"
npm run build

echo ""
echo "====== 启动生产模式 ======"
echo "访问: http://localhost:3000"
echo "按 Ctrl+C 停止"
echo "=========================="

cd "$ROOT_DIR/sharon-study-app/server"
node src/index.js
