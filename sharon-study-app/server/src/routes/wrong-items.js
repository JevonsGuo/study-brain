import { Router } from 'express'
import { getDb } from '../db/index.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const { subject, status } = req.query
  const conditions = []
  const params = []

  if (subject) {
    conditions.push('subject = ?')
    params.push(subject)
  }
  if (status) {
    conditions.push('mastery_status = ?')
    params.push(status)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.prepare(`SELECT * FROM wrong_items ${whereClause} ORDER BY id DESC`).all(...params)
  res.json(rows)
})

router.post('/', (req, res) => {
  const { subject, question, reason, mastery_status, review_count } = req.body
  if (!subject || !question) return res.status(400).json({ error: 'subject and question are required' })
  const finalReason = reason || '未注明原因'
  const finalStatus = mastery_status || 'unmastered'
  const finalReview = Number(review_count) || 0
  const db = getDb()
  const result = db.prepare('INSERT INTO wrong_items (subject, question, reason, mastery_status, review_count) VALUES (?, ?, ?, ?, ?)').run(subject, question, finalReason, finalStatus, finalReview)
  const row = db.prepare('SELECT * FROM wrong_items WHERE id = ?').get(result.lastInsertRowid)
  res.json(row)
})

router.put('/:id', (req, res) => {
  const { subject, question, reason, mastery_status, review_count } = req.body
  const db = getDb()
  const fields = []
  const values = []
  if (subject !== undefined) { fields.push('subject = ?'); values.push(subject) }
  if (question !== undefined) { fields.push('question = ?'); values.push(question) }
  if (reason !== undefined) { fields.push('reason = ?'); values.push(reason) }
  if (mastery_status !== undefined) { fields.push('mastery_status = ?'); values.push(mastery_status) }
  if (review_count !== undefined) { fields.push('review_count = ?'); values.push(Number(review_count)) }
  if (fields.length === 0) return res.status(400).json({ error: 'no fields to update' })
  values.push(req.params.id)
  db.prepare(`UPDATE wrong_items SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  const row = db.prepare('SELECT * FROM wrong_items WHERE id = ?').get(req.params.id)
  res.json(row)
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM wrong_items WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
