#!/bin/bash
set -e

REMOTE_HOST="${1:-}"
REMOTE_USER="${2:-jevons}"
REMOTE_DIR="/opt/sharon-study"

if [ -z "$REMOTE_HOST" ]; then
  echo "Usage: ./publish.sh <host> [user]"
  echo "Example: ./publish.sh 192.168.1.100"
  echo "Example: ./publish.sh my-nas jevons"
  exit 1
fi

echo "=== Publish to $REMOTE_USER@$REMOTE_HOST ==="

echo "[1/3] Git commit and push..."
cd "$(dirname "$0")/.."
git add -A
if git diff --cached --quiet; then
  echo "  No changes to commit"
else
  git commit -m "v$(node -p 'require(\"./sharon-study-app/package.json\").version') update"
  git push
fi

echo "[2/3] Remote deploy..."
ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && bash scripts/deploy.sh"

echo "[3/3] Done!"
echo "Site: http://$REMOTE_HOST:3000"
