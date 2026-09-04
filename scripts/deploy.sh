#!/bin/bash
set -e

REPO_DIR="/opt/sharon-study"
APP_DIR="$REPO_DIR/sharon-study-app"
SERVER_DIR="$APP_DIR/server"
ENV_FILE="$APP_DIR/.env.production"

echo "=== Sharon Study Deploy ==="

cd "$REPO_DIR"
echo "[1/8] Git pull..."
git checkout -- sharon-study-app/data/ sharon-study-app/server/package.json 2>/dev/null || true
git fetch origin
git reset --hard origin/master

echo "[2/8] Install frontend dependencies..."
cd "$APP_DIR"
npm install --cache /tmp/npm-cache

echo "[3/8] Build frontend..."
npm run build

echo "[4/8] Install server dependencies..."
cd "$SERVER_DIR"
npm install --omit=dev --cache /tmp/npm-cache
npx npm-install-scripts approve better-sqlite3 2>/dev/null || true
npm rebuild better-sqlite3

echo "[5/8] Ensure data directory and env..."
mkdir -p /data/sharon-study/backups

if [ ! -f "$ENV_FILE" ]; then
  echo "  [WARN] .env.production not found, creating default..."
  cat > "$ENV_FILE" << 'EOF'
DB_PATH=/data/sharon-study/production.db
PORT=3000
NODE_ENV=production
EOF
fi

DB_PATH=$(grep '^DB_PATH=' "$ENV_FILE" | cut -d= -f2)

echo "[6/8] Backup database..."
if [ -n "$DB_PATH" ] && [ -f "$DB_PATH" ]; then
  STAMP=$(date +%Y%m%d-%H%M%S)
  BACKUP_FILE="/data/sharon-study/backups/pre-deploy-$STAMP.db"
  (cd "$SERVER_DIR" && node -e "
    const db = require('better-sqlite3')(process.argv[1])
    db.backup(process.argv[2]).then(() => { console.log('  Backup -> ' + process.argv[2]); process.exit(0) }).catch(e => { console.error('  Backup failed:', e.message); process.exit(1) })
  " "$DB_PATH" "$BACKUP_FILE")
else
  echo "  Database not found (first deploy?), skip backup"
fi

echo "[7/8] Sync content data..."
(cd "$REPO_DIR" && NODE_ENV=production node scripts/sync-content.mjs)

echo "[8/8] Restart service..."
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
