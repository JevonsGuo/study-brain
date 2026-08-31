#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "====== 启动开发模式 ======"
echo "前端: http://localhost:5173 (Vite 热更新)"
echo "后端: http://localhost:3000 (API + SQLite)"
echo "按 Ctrl+C 同时停止两个服务"
echo "=========================="

cleanup() {
  echo ""
  echo "正在停止服务..."
  kill $(jobs -p) 2>/dev/null 2>&1
  exit 0
}
trap cleanup EXIT INT TERM

cd "$ROOT_DIR/sharon-study-app/server" && node --watch src/index.js &
cd "$ROOT_DIR/sharon-study-app" && npx vite &

wait
