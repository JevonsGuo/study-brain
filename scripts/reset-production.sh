#!/bin/bash
set -e

if [ "$1" != "--confirm" ]; then
  echo "Sharon Study 生产数据库重置"
  echo ""
  echo "此脚本将执行："
  echo "  1. 备份当前生产数据库"
  echo "  2. 停止服务"
  echo "  3. 删除生产数据库（清空所有用户数据：学习计划/错题/成绩/背诵进度）"
  echo "  4. 重建表结构并从 content/ 导入内容数据"
  echo "  5. 重新启动服务"
  echo ""
  echo "用法: ./scripts/reset-production.sh --confirm"
  echo "请先确认生产库中没有需要保留的用户数据！"
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$REPO_DIR/sharon-study-app"
SERVER_DIR="$APP_DIR/server"
ENV_FILE="$APP_DIR/.env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "[ERROR] 未找到 $ENV_FILE"
  exit 1
fi

DB_PATH=$(grep '^DB_PATH=' "$ENV_FILE" | cut -d= -f2)
if [ -z "$DB_PATH" ]; then
  echo "[ERROR] $ENV_FILE 中未配置 DB_PATH"
  exit 1
fi

BACKUP_DIR=$(dirname "$DB_PATH")/backups
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pre-reset-$STAMP.db"

echo "=== Sharon Study 生产库重置 ==="
echo "数据库: $DB_PATH"
echo ""

echo "[1/6] 备份当前数据库 -> $BACKUP_FILE"
if [ -f "$DB_PATH" ]; then
  (cd "$SERVER_DIR" && node -e "
    const db = require('better-sqlite3')(process.argv[1])
    db.backup(process.argv[2]).then(() => { console.log('  备份完成'); process.exit(0) }).catch(e => { console.error('  备份失败:', e.message); process.exit(1) })
  " "$DB_PATH" "$BACKUP_FILE")
else
  echo "  数据库文件不存在，跳过备份"
fi

echo "[2/6] 停止服务..."
if command -v pm2 &> /dev/null; then
  pm2 stop sharon-study || true
elif command -v systemctl &> /dev/null; then
  sudo systemctl stop sharon-study || true
else
  echo "  [WARN] 未找到 pm2/systemctl，请确保服务已手动停止"
fi

echo "[3/6] 删除数据库文件..."
rm -f "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm"

echo "[4/6] 重建表结构并导入内容数据..."
(cd "$REPO_DIR" && NODE_ENV=production node scripts/sync-content.mjs)

echo "[5/6] 启动服务..."
if command -v pm2 &> /dev/null; then
  pm2 start sharon-study || pm2 restart sharon-study
  pm2 save
elif command -v systemctl &> /dev/null; then
  sudo systemctl start sharon-study
else
  echo "  [MANUAL] 请手动启动: cd $SERVER_DIR && NODE_ENV=production node src/index.js &"
fi

echo "[6/6] 重置完成。当前数据统计："
(cd "$SERVER_DIR" && node -e "
  const db = require('better-sqlite3')(process.argv[1], { readonly: true })
  const c = (t) => { try { return db.prepare('SELECT COUNT(*) c FROM ' + t).get().c } catch { return 'N/A' } }
  console.log('  单词: ' + c('words'))
  console.log('  知识点: ' + c('knowledge_points'))
  console.log('  学习资源: ' + c('learning_resources'))
  console.log('  学习计划: ' + c('study_plans') + ' | 错题: ' + c('wrong_items') + ' | 成绩: ' + c('grades'))
" "$DB_PATH")

echo ""
echo "备份文件: $BACKUP_FILE"
echo "如需回滚: 停止服务 -> cp $BACKUP_FILE $DB_PATH -> 重启服务"
