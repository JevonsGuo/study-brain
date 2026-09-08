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
      mastery_status TEXT NOT NULL DEFAULT 'unmastered',
      review_count INTEGER NOT NULL DEFAULT 0,
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
      origin TEXT NOT NULL DEFAULT 'seed',
      user_modified INTEGER NOT NULL DEFAULT 0,
      word_list TEXT NOT NULL DEFAULT '',
      forms TEXT NOT NULL DEFAULT '',
      synonyms TEXT NOT NULL DEFAULT '',
      antonyms TEXT NOT NULL DEFAULT '',
      collocations TEXT NOT NULL DEFAULT '',
      etymology TEXT NOT NULL DEFAULT '',
      distinction TEXT NOT NULL DEFAULT '',
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

    CREATE TABLE IF NOT EXISTS grade_goals (
      subject TEXT PRIMARY KEY,
      target_score REAL NOT NULL,
      target_full_score REAL NOT NULL DEFAULT 150,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
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
      grade TEXT NOT NULL DEFAULT '',
      book TEXT NOT NULL DEFAULT '',
      chapter TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      key_formulas TEXT NOT NULL DEFAULT '',
      tips TEXT NOT NULL DEFAULT '',
      visual_desc TEXT NOT NULL DEFAULT '',
      video_url TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      origin TEXT NOT NULL DEFAULT 'seed',
      user_modified INTEGER NOT NULL DEFAULT 0,
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
      origin TEXT NOT NULL DEFAULT 'seed',
      user_modified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS focus_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL DEFAULT '其他',
      plan_id INTEGER DEFAULT NULL,
      task_name TEXT NOT NULL DEFAULT '',
      mode TEXT NOT NULL DEFAULT 'pomodoro',
      duration_minutes INTEGER NOT NULL DEFAULT 25,
      completed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_focus_records_completed_at ON focus_records(completed_at);
    CREATE INDEX IF NOT EXISTS idx_focus_records_subject ON focus_records(subject);
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
    name: '010_focus_records',
    up: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS focus_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subject TEXT NOT NULL DEFAULT '其他',
          plan_id INTEGER DEFAULT NULL,
          task_name TEXT NOT NULL DEFAULT '',
          mode TEXT NOT NULL DEFAULT 'pomodoro',
          duration_minutes INTEGER NOT NULL DEFAULT 25,
          completed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          notes TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_focus_records_completed_at ON focus_records(completed_at);
        CREATE INDEX IF NOT EXISTS idx_focus_records_subject ON focus_records(subject);
      `)
    }
  },
  {
    name: '009_grade_goals',
    up: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS grade_goals (
          subject TEXT PRIMARY KEY,
          target_score REAL NOT NULL,
          target_full_score REAL NOT NULL DEFAULT 150,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `)
    }
  },
  {
    name: '008_wrong_items_mastery_status',
    up: () => {
      const columns = db.prepare("PRAGMA table_info(wrong_items)").all().map(c => c.name)
      if (!columns.includes('mastery_status')) db.exec("ALTER TABLE wrong_items ADD COLUMN mastery_status TEXT NOT NULL DEFAULT 'unmastered'")
      if (!columns.includes('review_count')) db.exec("ALTER TABLE wrong_items ADD COLUMN review_count INTEGER NOT NULL DEFAULT 0")
    }
  },
  {
    name: '007_knowledge_add_grade_book',
    up: () => {
      const columns = db.prepare("PRAGMA table_info(knowledge_points)").all().map(c => c.name)
      if (!columns.includes('grade')) db.exec("ALTER TABLE knowledge_points ADD COLUMN grade TEXT NOT NULL DEFAULT ''")
      if (!columns.includes('book')) db.exec("ALTER TABLE knowledge_points ADD COLUMN book TEXT NOT NULL DEFAULT ''")
    }
  },
  {
    name: '006_words_enrichment',
    up: () => {
      const columns = db.prepare("PRAGMA table_info(words)").all().map(c => c.name)
      if (!columns.includes('forms')) db.exec("ALTER TABLE words ADD COLUMN forms TEXT NOT NULL DEFAULT ''")
      if (!columns.includes('synonyms')) db.exec("ALTER TABLE words ADD COLUMN synonyms TEXT NOT NULL DEFAULT ''")
      if (!columns.includes('antonyms')) db.exec("ALTER TABLE words ADD COLUMN antonyms TEXT NOT NULL DEFAULT ''")
      if (!columns.includes('collocations')) db.exec("ALTER TABLE words ADD COLUMN collocations TEXT NOT NULL DEFAULT ''")
      if (!columns.includes('etymology')) db.exec("ALTER TABLE words ADD COLUMN etymology TEXT NOT NULL DEFAULT ''")
      if (!columns.includes('distinction')) db.exec("ALTER TABLE words ADD COLUMN distinction TEXT NOT NULL DEFAULT ''")
    }
  },
  {
    name: '005_words_add_word_list',
    up: () => {
      const columns = db.prepare("PRAGMA table_info(words)").all().map(c => c.name)
      if (!columns.includes('word_list')) {
        db.exec("ALTER TABLE words ADD COLUMN word_list TEXT NOT NULL DEFAULT ''")
        db.exec("UPDATE words SET word_list = 'default' WHERE word_list = ''")
      }
      const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='words'").all().map(r => r.name)
      if (indexes.includes('idx_words_word') && !indexes.includes('idx_words_word_list')) {
        db.exec('DROP INDEX IF EXISTS idx_words_word')
      }
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_words_word_list ON words(word, word_list)')
    }
  },
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
  },
  {
    name: '004_content_provenance',
    up: () => {
      const addColumn = (table, column, ddl) => {
        const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name)
        if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`)
      }
      addColumn('words', 'origin', "TEXT NOT NULL DEFAULT 'seed'")
      addColumn('words', 'user_modified', 'INTEGER NOT NULL DEFAULT 0')
      addColumn('knowledge_points', 'origin', "TEXT NOT NULL DEFAULT 'seed'")
      addColumn('knowledge_points', 'user_modified', 'INTEGER NOT NULL DEFAULT 0')
      addColumn('learning_resources', 'origin', "TEXT NOT NULL DEFAULT 'seed'")
      addColumn('learning_resources', 'user_modified', 'INTEGER NOT NULL DEFAULT 0')

      const dedup = db.transaction(() => {
        const dupWords = db.prepare('SELECT word FROM words GROUP BY word HAVING COUNT(*) > 1').all()
        const keeperWord = db.prepare('SELECT id FROM words WHERE word = ? ORDER BY review_count DESC, mastery_level DESC, last_review DESC, id ASC LIMIT 1')
        const otherWords = db.prepare('SELECT id FROM words WHERE word = ? AND id != ?')
        const repointRecord = db.prepare('UPDATE study_records SET word_id = ? WHERE word_id = ?')
        const deleteWord = db.prepare('DELETE FROM words WHERE id = ?')
        for (const { word } of dupWords) {
          const keeperId = keeperWord.get(word).id
          for (const { id } of otherWords.all(word, keeperId)) {
            repointRecord.run(keeperId, id)
            deleteWord.run(id)
          }
        }

        const dupKnowledge = db.prepare('SELECT subject, title FROM knowledge_points GROUP BY subject, title HAVING COUNT(*) > 1').all()
        const deleteKnowledge = db.prepare('DELETE FROM knowledge_points WHERE subject = ? AND title = ? AND id != (SELECT MIN(id) FROM knowledge_points WHERE subject = ? AND title = ?)')
        for (const d of dupKnowledge) {
          deleteKnowledge.run(d.subject, d.title, d.subject, d.title)
        }

        const dupResources = db.prepare('SELECT subject, url FROM learning_resources GROUP BY subject, url HAVING COUNT(*) > 1').all()
        const deleteResource = db.prepare('DELETE FROM learning_resources WHERE subject = ? AND url = ? AND id != (SELECT MIN(id) FROM learning_resources WHERE subject = ? AND url = ?)')
        for (const d of dupResources) {
          deleteResource.run(d.subject, d.url, d.subject, d.url)
        }
      })
      dedup()

      const existingIndexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='words'").all().map(r => r.name)
      if (!existingIndexes.includes('idx_words_word_list')) {
        db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_words_word ON words(word)')
      }
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_subject_title ON knowledge_points(subject, title)')
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_resources_subject_url ON learning_resources(subject, url)')
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
