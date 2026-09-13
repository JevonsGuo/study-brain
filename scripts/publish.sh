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

# 自动自增修订版本号 (第三位数字: 1.0.0 -> 1.0.1)，保证用户端弹窗版本号明显递增
cd "$(dirname "$0")/.."
BUMP_ARG="${4:-patch}"
node scripts/bump-version.mjs "$BUMP_ARG"

echo "[1/2] Git commit and push..."
git add -A
if git diff --cached --quiet; then
  echo "  无本地改动需要提交"
else
  CURRENT_VERSION=$(node -p 'require("./sharon-study-app/package.json").version')
  git commit -m "v${CURRENT_VERSION} release"
  git push
fi

echo "[2/2] 触发远端静态构建与 Nginx 热重载..."
ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && bash scripts/deploy.sh"

echo "=== 发布成功！请访问: http://$REMOTE_HOST ==="
