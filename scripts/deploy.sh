#!/bin/bash
set -e

REPO_DIR="/opt/sharon-study"
APP_DIR="$REPO_DIR/sharon-study-app"
SERVER_DIR="$APP_DIR/server"
ENV_FILE="$APP_DIR/.env.production"

echo "=== Sharon Study Deploy ==="

cd "$REPO_DIR"
echo "[1/5] Git pull..."
git pull

echo "[2/5] Install server dependencies..."
cd "$SERVER_DIR"
npm install --omit=dev --cache /tmp/npm-cache

echo "[3/5] Build frontend..."
cd "$APP_DIR"
npm run build --cache /tmp/npm-cache

echo "[4/5] Ensure data directory..."
mkdir -p /data/sharon-study/backups

if [ ! -f "$ENV_FILE" ]; then
  echo "[WARN] .env.production not found, creating default..."
  cat > "$ENV_FILE" << 'EOF'
DB_PATH=/data/sharon-study/production.db
PORT=3000
NODE_ENV=production
EOF
fi

echo "[5/5] Restart service..."
if command -v pm2 &> /dev/null; then
  pm2 restart sharon-study || pm2 start "$SERVER_DIR/src/index.js" --name sharon-study
  pm2 save
elif command -v systemctl &> /dev/null; then
  sudo systemctl restart sharon-study
else
  echo "[MANUAL] No pm2/systemctl found. Run manually:"
  echo "  cd $SERVER_DIR && NODE_ENV=production node src/index.js &"
fi

echo ""
echo "=== Deploy complete ==="
echo "DB: $(grep DB_PATH $ENV_FILE | cut -d= -f2)"
echo "Port: $(grep PORT $ENV_FILE | cut -d= -f2)"
