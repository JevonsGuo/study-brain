#!/bin/bash
set -e

REPO_DIR="${1:-/opt/sharon-study}"
APP_DIR="$REPO_DIR/sharon-study-app"
WEB_DIR="/var/www/study-brain/dist"

echo "=== Study Brain 生产环境静态部署 (Ubuntu / Linux) ==="

cd "$REPO_DIR"
echo "[1/4] 拉取最新代码..."
git fetch origin
git reset --hard origin/master

echo "[2/4] 安装前端依赖..."
cd "$APP_DIR"
npm ci || npm install --cache /tmp/npm-cache

echo "[3/4] 编译前端 (自动同步公共学科 JSON)..."
npm run build

echo "[4/4] 部署至 Web 根目录并重载 Nginx..."
sudo mkdir -p "$WEB_DIR"
sudo cp -r "$APP_DIR/dist/"* "$WEB_DIR/"

if command -v nginx &> /dev/null; then
  sudo nginx -t && sudo systemctl reload nginx
  echo "  Nginx 已平滑重载！"
fi

echo ""
echo "=== 部署完成！智学大脑已在生产环境极速上线 ==="
