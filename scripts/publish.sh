#!/bin/bash
set -e

REMOTE_HOST="${1:-}"
REMOTE_USER="${2:-jevons}"
REMOTE_DIR="${3:-/opt/sharon-study}"

if [ -z "$REMOTE_HOST" ]; then
  echo "Usage: ./publish.sh <host> [user] [dir]"
  echo "Example: ./publish.sh 192.168.1.100"
  echo "Example: ./publish.sh my-server jevons"
  exit 1
fi

echo "=== 发布到生产服务器: $REMOTE_USER@$REMOTE_HOST ==="

echo "[1/2] Git commit and push..."
cd "$(dirname "$0")/.."
git add -A
if git diff --cached --quiet; then
  echo "  无本地改动需要提交"
else
  git commit -m "v$(node -p 'require("./sharon-study-app/package.json").version') update"
  git push
fi

echo "[2/2] 触发远端静态构建与 Nginx 热重载..."
ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && bash scripts/deploy.sh"

echo "=== 发布成功！请访问: http://$REMOTE_HOST ==="
