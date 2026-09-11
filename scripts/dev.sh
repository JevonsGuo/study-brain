#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "====== 启动开发模式 ======"

kill_port() {
  local pid
  pid=$(lsof -ti:$1 2>/dev/null | head -1) || true
  if [ -n "$pid" ]; then
    echo "端口 $1 已被占用 (PID: $pid)，正在终止..."
    kill $pid 2>/dev/null || true
    sleep 1
  fi
}

kill_port 5173
kill_port 3000

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

node "$ROOT_DIR/scripts/copy-content-to-public.mjs"
cd "$ROOT_DIR/sharon-study-app/server" && node --watch src/index.js &
cd "$ROOT_DIR/sharon-study-app" && npx vite &

wait
