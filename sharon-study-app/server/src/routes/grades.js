import { Router } from 'express'
import { getDb } from '../db/index.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM grades ORDER BY date DESC, id DESC').all()
  res.json(rows)
})

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

router.delete('/:id', (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM grades WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
