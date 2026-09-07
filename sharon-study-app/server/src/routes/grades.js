import { Router } from 'express'
import { getDb } from '../db/index.js'

const router = Router()

// 获取所有成绩
router.get('/', (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM grades ORDER BY date DESC, id DESC').all()
  res.json(rows)
})

// 获取各科目标分
router.get('/goals', (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM grade_goals').all()
  const goalsMap = {}
  for (const r of rows) {
    goalsMap[r.subject] = { target_score: r.target_score, target_full_score: r.target_full_score }
  }
  res.json(goalsMap)
})

// 设置/批量设置各科目标分
router.put('/goals', (req, res) => {
  const goals = req.body
  if (!goals || typeof goals !== 'object') {
    return res.status(400).json({ error: 'goals object required' })
  }
  const db = getDb()
  const insertOrUpdate = db.prepare(`
    INSERT INTO grade_goals (subject, target_score, target_full_score, updated_at)
    VALUES (?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(subject) DO UPDATE SET
      target_score = excluded.target_score,
      target_full_score = excluded.target_full_score,
      updated_at = excluded.updated_at
  `)

  const transaction = db.transaction((entries) => {
    for (const [subj, val] of entries) {
      if (val && typeof val.target_score === 'number') {
        insertOrUpdate.run(subj, val.target_score, val.target_full_score || 150)
      }
    }
  })

  transaction(Object.entries(goals))
  const rows = db.prepare('SELECT * FROM grade_goals').all()
  const goalsMap = {}
  for (const r of rows) {
    goalsMap[r.subject] = { target_score: r.target_score, target_full_score: r.target_full_score }
  }
  res.json(goalsMap)
})

// 批量录入整场大考各科成绩
router.post('/batch', (req, res) => {
  const { exam, date, items } = req.body
  if (!exam || !date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'exam, date, and non-empty items array are required' })
  }
  const db = getDb()
  const insertStmt = db.prepare('INSERT INTO grades (subject, exam, score, full_score, date) VALUES (?, ?, ?, ?, ?)')
  const insertedIds = []

  const transaction = db.transaction((list) => {
    for (const item of list) {
      if (item.subject && item.score != null && item.full_score) {
        const result = insertStmt.run(item.subject, exam, item.score, item.full_score, date)
        insertedIds.push(result.lastInsertRowid)
      }
    }
  })

  transaction(items)
  res.json({ ok: true, count: insertedIds.length, ids: insertedIds })
})

// 单科录入成绩
router.post('/', (req, res) => {
  const { subject, exam, score, full_score, date } = req.body
  if (!subject || !exam || score == null || !full_score || !date) {
    return res.status(400).json({ error: 'subject, exam, score, full_score, date are required' })
  }
  const db = getDb()
  const result = db.prepare('INSERT INTO grades (subject, exam, score, full_score, date) VALUES (?, ?, ?, ?, ?)').run(subject, exam, score, full_score, date)
  const row = db.prepare('SELECT * FROM grades WHERE id = ?').get(result.lastInsertRowid)
  res.json(row)
})

// 修改单科成绩
router.put('/:id', (req, res) => {
  const { subject, exam, score, full_score, date } = req.body
  if (!subject || !exam || score == null || !full_score || !date) {
    return res.status(400).json({ error: 'subject, exam, score, full_score, date are required' })
  }
  const db = getDb()
  db.prepare('UPDATE grades SET subject = ?, exam = ?, score = ?, full_score = ?, date = ? WHERE id = ?')
    .run(subject, exam, score, full_score, date, req.params.id)
  const row = db.prepare('SELECT * FROM grades WHERE id = ?').get(req.params.id)
  if (!row) {
    return res.status(404).json({ error: 'grade not found' })
  }
  res.json(row)
})

// 删除成绩
router.delete('/:id', (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM grades WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
