import { Router } from 'express'
import { getDb } from '../db/index.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const { subject } = req.query
  let rows
  if (subject) {
    rows = db.prepare('SELECT * FROM wrong_items WHERE subject = ? ORDER BY id DESC').all(subject)
  } else {
    rows = db.prepare('SELECT * FROM wrong_items ORDER BY id DESC').all()
  }
  res.json(rows)
})

router.post('/', (req, res) => {
  const { subject, question, reason } = req.body
  if (!subject || !question || !reason) return res.status(400).json({ error: 'subject, question, reason are required' })
  const db = getDb()
  const result = db.prepare('INSERT INTO wrong_items (subject, question, reason) VALUES (?, ?, ?)').run(subject, question, reason)
  const row = db.prepare('SELECT * FROM wrong_items WHERE id = ?').get(result.lastInsertRowid)
  res.json(row)
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM wrong_items WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
