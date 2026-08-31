import { Router } from 'express'
import { getDb } from '../db/index.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM study_plans ORDER BY date DESC, id DESC').all()
  res.json(rows.map(r => ({ ...r, done: !!r.done })))
})

router.post('/', (req, res) => {
  const { subject, content, date } = req.body
  if (!subject || !content || !date) return res.status(400).json({ error: 'subject, content, date are required' })
  const db = getDb()
  const result = db.prepare('INSERT INTO study_plans (subject, content, date) VALUES (?, ?, ?)').run(subject, content, date)
  const row = db.prepare('SELECT * FROM study_plans WHERE id = ?').get(result.lastInsertRowid)
  res.json({ ...row, done: !!row.done })
})

router.put('/:id/toggle', (req, res) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM study_plans WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not found' })
  db.prepare('UPDATE study_plans SET done = ? WHERE id = ?').run(row.done ? 0 : 1, req.params.id)
  const updated = db.prepare('SELECT * FROM study_plans WHERE id = ?').get(req.params.id)
  res.json({ ...updated, done: !!updated.done })
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM study_plans WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
