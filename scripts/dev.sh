#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "====== 启动智学大脑 (Study Brain) 开发模式 ======"

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

echo "前端: http://localhost:5173 (Vite 极速热更新)"
echo "引擎: IndexedDB 本地私有数据引擎 (零后端进程)"
echo "================================================"

cleanup() {
  echo ""
  echo "正在停止服务..."
  kill $(jobs -p) 2>/dev/null 2>&1
  exit 0
}
trap cleanup EXIT INT TERM

# 自动同步学科数据到 public/content/
node "$ROOT_DIR/scripts/copy-content-to-public.mjs"

# 启动 Vite 开发服务
cd "$ROOT_DIR/sharon-study-app" && npx vite
