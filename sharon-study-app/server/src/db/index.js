import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..')

function resolveDbPath() {
  if (process.env.DB_PATH) {
    return path.resolve(PROJECT_ROOT, process.env.DB_PATH)
  }
  return path.join(PROJECT_ROOT, 'data', 'sharon-study.db')
}

let db = null

export function getDb() {
  if (!db) {
    const dbPath = resolveDbPath()
    const dbDir = path.dirname(dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initTables()
    runMigrations()
    console.log(`[DB] ${dbPath}`)
  }
  return db
}

export function getDbPath() {
  return resolveDbPath()
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
      visual_desc TEXT NOT NULL DEFAULT '',
      video_url TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS learning_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'video',
      name TEXT NOT NULL,
      desc TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `)

  initDailyConfig()
}

function initDailyConfig() {
  const row = db.prepare('SELECT COUNT(*) as count FROM daily_config').get()
  if (row.count === 0) {
    db.prepare('INSERT INTO daily_config (target_new, target_review) VALUES (20, 40)').run()
  }
}

const MIGRATIONS = [
  {
    name: '001_words_add_columns',
    up: () => {
      const columns = db.prepare("PRAGMA table_info(words)").all().map(c => c.name)
      if (!columns.includes('example_en')) db.exec('ALTER TABLE words ADD COLUMN example_en TEXT NOT NULL DEFAULT ""')
      if (!columns.includes('example_cn')) db.exec('ALTER TABLE words ADD COLUMN example_cn TEXT NOT NULL DEFAULT ""')
      if (!columns.includes('mastery_level')) db.exec('ALTER TABLE words ADD COLUMN mastery_level INTEGER NOT NULL DEFAULT 0')
      if (!columns.includes('interval_days')) db.exec('ALTER TABLE words ADD COLUMN interval_days INTEGER NOT NULL DEFAULT 0')
      if (!columns.includes('next_review')) db.exec("ALTER TABLE words ADD COLUMN next_review TEXT NOT NULL DEFAULT ''")
    }
  },
  {
    name: '002_knowledge_add_visual_video',
    up: () => {
      const columns = db.prepare("PRAGMA table_info(knowledge_points)").all().map(c => c.name)
      if (!columns.includes('visual_desc')) db.exec("ALTER TABLE knowledge_points ADD COLUMN visual_desc TEXT NOT NULL DEFAULT ''")
      if (!columns.includes('video_url')) db.exec("ALTER TABLE knowledge_points ADD COLUMN video_url TEXT NOT NULL DEFAULT ''")
    }
  },
  {
    name: '003_study_plans_add_estimated_minutes',
    up: () => {
      const columns = db.prepare("PRAGMA table_info(study_plans)").all().map(c => c.name)
      if (!columns.includes('estimated_minutes')) db.exec('ALTER TABLE study_plans ADD COLUMN estimated_minutes INTEGER NOT NULL DEFAULT 0')
    }
  }
]

function runMigrations() {
  const applied = new Set(db.prepare('SELECT name FROM _migrations').all().map(r => r.name))
  for (const m of MIGRATIONS) {
    if (!applied.has(m.name)) {
      m.up()
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(m.name)
      console.log(`Migration applied: ${m.name}`)
    }
  }
}
