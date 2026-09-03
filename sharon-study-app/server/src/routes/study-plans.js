import { Router } from 'express'
import { getDb } from '../db/index.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM study_plans ORDER BY date DESC, id DESC').all()
  res.json(rows.map(r => ({ ...r, done: !!r.done })))
})

router.post('/', (req, res) => {
  const { subject, content, date, estimated_minutes } = req.body
  if (!subject || !content || !date) return res.status(400).json({ error: 'subject, content, date are required' })
  const db = getDb()
  const mins = estimated_minutes || 0
  const result = db.prepare('INSERT INTO study_plans (subject, content, date, estimated_minutes) VALUES (?, ?, ?, ?)').run(subject, content, date, mins)
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

router.put('/:id', (req, res) => {
  const { subject, content, date, estimated_minutes } = req.body
  const db = getDb()
  const row = db.prepare('SELECT * FROM study_plans WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not found' })
  const s = subject || row.subject
  const c = content || row.content
  const d = date || row.date
  const m = estimated_minutes !== undefined ? estimated_minutes : row.estimated_minutes
  db.prepare('UPDATE study_plans SET subject = ?, content = ?, date = ?, estimated_minutes = ? WHERE id = ?').run(s, c, d, m, req.params.id)
  const updated = db.prepare('SELECT * FROM study_plans WHERE id = ?').get(req.params.id)
  res.json({ ...updated, done: !!updated.done })
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM study_plans WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
