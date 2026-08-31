import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', '..', '..', 'data', 'sharon-study.db')

let db = null

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initTables()
  }
  return db
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS study_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      date TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS wrong_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      question TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      phonetic TEXT NOT NULL DEFAULT '',
      meaning TEXT NOT NULL,
      example_en TEXT NOT NULL DEFAULT '',
      example_cn TEXT NOT NULL DEFAULT '',
      mastery_level INTEGER NOT NULL DEFAULT 0,
      interval_days INTEGER NOT NULL DEFAULT 0,
      next_review TEXT NOT NULL DEFAULT '',
      review_count INTEGER NOT NULL DEFAULT 0,
      last_review TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      exam TEXT NOT NULL,
      score INTEGER NOT NULL,
      full_score INTEGER NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS study_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS daily_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_new INTEGER NOT NULL DEFAULT 20,
      target_review INTEGER NOT NULL DEFAULT 40,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      chapter TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      key_formulas TEXT NOT NULL DEFAULT '',
      tips TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `)

  migrateWords()
  initDailyConfig()
}

function migrateWords() {
  const columns = db.prepare("PRAGMA table_info(words)").all().map(c => c.name)
  if (!columns.includes('example_en')) {
    db.exec('ALTER TABLE words ADD COLUMN example_en TEXT NOT NULL DEFAULT ""')
  }
  if (!columns.includes('example_cn')) {
    db.exec('ALTER TABLE words ADD COLUMN example_cn TEXT NOT NULL DEFAULT ""')
  }
  if (!columns.includes('mastery_level')) {
    db.exec('ALTER TABLE words ADD COLUMN mastery_level INTEGER NOT NULL DEFAULT 0')
  }
  if (!columns.includes('interval_days')) {
    db.exec('ALTER TABLE words ADD COLUMN interval_days INTEGER NOT NULL DEFAULT 0')
  }
  if (!columns.includes('next_review')) {
    db.exec("ALTER TABLE words ADD COLUMN next_review TEXT NOT NULL DEFAULT ''")
  }
}

function initDailyConfig() {
  const row = db.prepare('SELECT COUNT(*) as count FROM daily_config').get()
  if (row.count === 0) {
    db.prepare('INSERT INTO daily_config (target_new, target_review) VALUES (20, 40)').run()
  }
}
