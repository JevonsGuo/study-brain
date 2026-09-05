import { Router } from 'express'
import { getDb } from '../db/index.js'

const router = Router()

const INTERVAL_STEPS = [1, 2, 4, 7, 15, 30]

router.get('/', (req, res) => {
  const db = getDb()
  const { search, mastery, word_list } = req.query
  let sql = 'SELECT * FROM words'
  const conditions = []
  const params = []
  if (search) {
    conditions.push('(word LIKE ? OR meaning LIKE ? OR example_en LIKE ?)')
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }
  if (mastery !== undefined && mastery !== '') {
    conditions.push('mastery_level = ?')
    params.push(Number(mastery))
  }
  if (word_list) {
    conditions.push('word_list = ?')
    params.push(word_list)
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }
  sql += ' ORDER BY id DESC'
  const rows = db.prepare(sql).all(...params)
  res.json(rows)
})

router.get('/due', (req, res) => {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)
  const wl = req.query.word_list
  const wlCond = wl ? ' AND word_list = ?' : ''
  const wlParams = wl ? [wl] : []
  const rows = db.prepare(
    `SELECT * FROM words WHERE next_review <= ? AND next_review != ''${wlCond} ORDER BY next_review ASC`
  ).all(today, ...wlParams)
  const newWords = db.prepare(
    `SELECT * FROM words WHERE mastery_level = 0${wlCond} ORDER BY id ASC LIMIT 40`
  ).all(...wlParams)
  res.json({ due: rows, newWords })
})

router.get('/stats', (req, res) => {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)
  const wl = req.query.word_list
  const wlCond = wl ? ' AND word_list = ?' : ''
  const wlParams = wl ? [wl] : []
  const wlParams2 = wl ? [wl, wl, wl] : []

  const total = db.prepare(`SELECT COUNT(*) as count FROM words WHERE 1=1${wlCond}`).get(...wlParams).count
  const newCount = db.prepare(`SELECT COUNT(*) as count FROM words WHERE mastery_level = 0${wlCond}`).get(...wlParams).count
  const learningCount = db.prepare(`SELECT COUNT(*) as count FROM words WHERE mastery_level = 1${wlCond}`).get(...wlParams).count
  const masteredCount = db.prepare(`SELECT COUNT(*) as count FROM words WHERE mastery_level = 2${wlCond}`).get(...wlParams).count
  const dueCount = db.prepare(`SELECT COUNT(*) as count FROM words WHERE next_review <= ? AND next_review != ''${wlCond}`).get(today, ...wlParams).count

  const srJoin = wl ? ' JOIN study_records sr ON sr.word_id = w.id' : ''
  const srWhere = wl ? ` WHERE sr.word_id IN (SELECT id FROM words WHERE word_list = ?)` : ''
  const todayStudied = wl
    ? db.prepare(`SELECT COUNT(DISTINCT sr.word_id) as count FROM study_records sr JOIN words w ON sr.word_id = w.id WHERE sr.date = ? AND w.word_list = ?`).get(today, wl).count
    : db.prepare("SELECT COUNT(DISTINCT word_id) as count FROM study_records WHERE date = ?").get(today).count

  const todayNew = wl
    ? db.prepare(`SELECT COUNT(DISTINCT sr.word_id) as count FROM study_records sr JOIN words w ON sr.word_id = w.id WHERE sr.date = ? AND sr.action = 'new' AND w.word_list = ?`).get(today, wl).count
    : db.prepare("SELECT COUNT(DISTINCT word_id) as count FROM study_records WHERE date = ? AND action = 'new'").get(today).count

  const todayReviewed = wl
    ? db.prepare(`SELECT COUNT(DISTINCT sr.word_id) as count FROM study_records sr JOIN words w ON sr.word_id = w.id WHERE sr.date = ? AND sr.action = 'review' AND w.word_list = ?`).get(today, wl).count
    : db.prepare("SELECT COUNT(DISTINCT word_id) as count FROM study_records WHERE date = ? AND action = 'review'").get(today).count

  const config = db.prepare('SELECT * FROM daily_config ORDER BY id DESC LIMIT 1').get()

  let streak = 0
  const d = new Date()
  while (true) {
    const dateStr = d.toISOString().slice(0, 10)
    const count = db.prepare(
      "SELECT COUNT(*) as count FROM study_records WHERE date = ?"
    ).get(dateStr).count
    if (count > 0) {
      streak++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }

  res.json({
    total, newCount, learningCount, masteredCount, dueCount,
    todayStudied, todayNew, todayReviewed,
    targetNew: config?.target_new || 20,
    targetReview: config?.target_review || 40,
    streak
  })
})

router.get('/word-lists', (req, res) => {
  const db = getDb()
  const rows = db.prepare(
    "SELECT word_list, COUNT(*) as count FROM words GROUP BY word_list ORDER BY word_list"
  ).all()
  res.json(rows)
})

router.post('/', (req, res) => {
  const { word, phonetic, meaning, example_en, example_cn, word_list, forms, synonyms, antonyms, collocations, etymology, distinction } = req.body
  if (!word || !meaning) return res.status(400).json({ error: 'word, meaning are required' })
  const db = getDb()
  const wl = word_list || 'user'
  const formsStr = forms ? JSON.stringify(forms) : ''
  const synonymsStr = synonyms ? JSON.stringify(synonyms) : ''
  const antonymsStr = antonyms ? JSON.stringify(antonyms) : ''
  const collocationsStr = collocations ? JSON.stringify(collocations) : ''
  const etymologyStr = etymology || ''
  const distinctionStr = distinction ? JSON.stringify(distinction) : ''
  const result = db.prepare(
    "INSERT INTO words (word, phonetic, meaning, example_en, example_cn, word_list, origin, user_modified, forms, synonyms, antonyms, collocations, etymology, distinction) VALUES (?, ?, ?, ?, ?, ?, 'user', 1, ?, ?, ?, ?, ?, ?)"
  ).run(word, phonetic || '', meaning, example_en || '', example_cn || '', wl, formsStr, synonymsStr, antonymsStr, collocationsStr, etymologyStr, distinctionStr)
  const row = db.prepare('SELECT * FROM words WHERE id = ?').get(result.lastInsertRowid)

  const today = new Date().toISOString().slice(0, 10)
  db.prepare('INSERT INTO study_records (word_id, action, date) VALUES (?, ?, ?)').run(row.id, 'new', today)

  res.json(row)
})

router.put('/:id', (req, res) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not found' })
  const { word, phonetic, meaning, example_en, example_cn, forms, synonyms, antonyms, collocations, etymology, distinction } = req.body
  const formsStr = forms !== undefined ? (typeof forms === 'string' ? forms : JSON.stringify(forms)) : row.forms
  const synonymsStr = synonyms !== undefined ? (typeof synonyms === 'string' ? synonyms : JSON.stringify(synonyms)) : row.synonyms
  const antonymsStr = antonyms !== undefined ? (typeof antonyms === 'string' ? antonyms : JSON.stringify(antonyms)) : row.antonyms
  const collocationsStr = collocations !== undefined ? (typeof collocations === 'string' ? collocations : JSON.stringify(collocations)) : row.collocations
  const etymologyStr = etymology !== undefined ? etymology : row.etymology
  const distinctionStr = distinction !== undefined ? (typeof distinction === 'string' ? distinction : JSON.stringify(distinction)) : row.distinction
  db.prepare('UPDATE words SET word = ?, phonetic = ?, meaning = ?, example_en = ?, example_cn = ?, forms = ?, synonyms = ?, antonyms = ?, collocations = ?, etymology = ?, distinction = ?, user_modified = 1 WHERE id = ?')
    .run(word || row.word, phonetic ?? row.phonetic, meaning || row.meaning, example_en ?? row.example_en, example_cn ?? row.example_cn, formsStr, synonymsStr, antonymsStr, collocationsStr, etymologyStr, distinctionStr, req.params.id)
  const updated = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id)
  res.json(updated)
})

router.put('/:id/remember', (req, res) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not found' })

  const newReviewCount = row.review_count + 1
  const stepIdx = Math.min(Math.floor(newReviewCount / 2), INTERVAL_STEPS.length - 1)
  const interval = INTERVAL_STEPS[stepIdx]
  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + interval)
  const nextReview = nextDate.toISOString().slice(0, 10)

  let newMastery = row.mastery_level
  if (newMastery === 0) newMastery = 1
  if (newReviewCount >= 5) newMastery = 2

  db.prepare(
    "UPDATE words SET review_count = ?, last_review = date('now', 'localtime'), next_review = ?, interval_days = ?, mastery_level = ? WHERE id = ?"
  ).run(newReviewCount, nextReview, interval, newMastery, req.params.id)

  const today = new Date().toISOString().slice(0, 10)
  db.prepare('INSERT INTO study_records (word_id, action, date) VALUES (?, ?, ?)').run(req.params.id, 'review', today)

  const updated = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id)
  res.json(updated)
})

router.put('/:id/forget', (req, res) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not found' })

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + 1)
  const nextReview = nextDate.toISOString().slice(0, 10)

  let newMastery = row.mastery_level
  if (newMastery === 2) newMastery = 1

  db.prepare(
    "UPDATE words SET last_review = date('now', 'localtime'), next_review = ?, interval_days = 1, mastery_level = ? WHERE id = ?"
  ).run(nextReview, newMastery, req.params.id)

  const today = new Date().toISOString().slice(0, 10)
  db.prepare('INSERT INTO study_records (word_id, action, date) VALUES (?, ?, ?)').run(req.params.id, 'review', today)

  const updated = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id)
  res.json(updated)
})

router.put('/daily-config', (req, res) => {
  const db = getDb()
  const { target_new, target_review } = req.body
  db.prepare('UPDATE daily_config SET target_new = ?, target_review = ?, updated_at = datetime(?, ?) WHERE id = 1')
    .run(target_new || 20, target_review || 40, 'now', 'localtime')
  const config = db.prepare('SELECT * FROM daily_config WHERE id = 1').get()
  res.json(config)
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM study_records WHERE word_id = ?').run(req.params.id)
  db.prepare('DELETE FROM words WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
