import { Router } from 'express'
import { getDb } from '../db/index.js'

const router = Router()

const SELECT_WITH_KNOWLEDGE = `
  SELECT
    w.*,
    k.title AS knowledge_title,
    k.chapter AS knowledge_chapter,
    k.book AS knowledge_book,
    k.grade AS knowledge_grade
  FROM wrong_items w
  LEFT JOIN knowledge_points k ON w.knowledge_point_id = k.id
`

router.get('/', (req, res) => {
  const db = getDb()
  const { subject, status, knowledge_point_id } = req.query
  const conditions = []
  const params = []

  if (subject) {
    conditions.push('w.subject = ?')
    params.push(subject)
  }
  if (status) {
    conditions.push('w.mastery_status = ?')
    params.push(status)
  }
  if (knowledge_point_id) {
    conditions.push('w.knowledge_point_id = ?')
    params.push(Number(knowledge_point_id))
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.prepare(`${SELECT_WITH_KNOWLEDGE} ${whereClause} ORDER BY w.id DESC`).all(...params)
  res.json(rows)
})

router.post('/', (req, res) => {
  const { subject, question, reason, mastery_status, review_count, knowledge_point_id } = req.body
  if (!subject || !question) return res.status(400).json({ error: 'subject and question are required' })
  const finalReason = reason || '未注明原因'
  const finalStatus = mastery_status || 'unmastered'
  const finalReview = Number(review_count) || 0
  const finalKpId = knowledge_point_id ? Number(knowledge_point_id) : null
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO wrong_items (subject, question, reason, mastery_status, review_count, knowledge_point_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(subject, question, finalReason, finalStatus, finalReview, finalKpId)
  const row = db.prepare(`${SELECT_WITH_KNOWLEDGE} WHERE w.id = ?`).get(result.lastInsertRowid)
  res.json(row)
})

router.put('/:id', (req, res) => {
  const { subject, question, reason, mastery_status, review_count, knowledge_point_id } = req.body
  const db = getDb()
  const fields = []
  const values = []
  if (subject !== undefined) { fields.push('subject = ?'); values.push(subject) }
  if (question !== undefined) { fields.push('question = ?'); values.push(question) }
  if (reason !== undefined) { fields.push('reason = ?'); values.push(reason) }
  if (mastery_status !== undefined) { fields.push('mastery_status = ?'); values.push(mastery_status) }
  if (review_count !== undefined) { fields.push('review_count = ?'); values.push(Number(review_count)) }
  if (knowledge_point_id !== undefined) {
    fields.push('knowledge_point_id = ?')
    values.push(knowledge_point_id ? Number(knowledge_point_id) : null)
  }
  if (fields.length === 0) return res.status(400).json({ error: 'no fields to update' })
  values.push(req.params.id)
  db.prepare(`UPDATE wrong_items SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  const row = db.prepare(`${SELECT_WITH_KNOWLEDGE} WHERE w.id = ?`).get(req.params.id)
  res.json(row)
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM wrong_items WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
