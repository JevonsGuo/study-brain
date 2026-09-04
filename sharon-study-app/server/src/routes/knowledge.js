import { Router } from 'express'
import { getDb } from '../db/index.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const { subject, chapter } = req.query
  let sql = 'SELECT * FROM knowledge_points'
  const conditions = []
  const params = []
  if (subject) {
    conditions.push('subject = ?')
    params.push(subject)
  }
  if (chapter) {
    conditions.push('chapter = ?')
    params.push(chapter)
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }
  sql += ' ORDER BY sort_order ASC, id ASC'
  const rows = db.prepare(sql).all(...params)
  res.json(rows)
})

router.get('/subjects', (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT DISTINCT subject FROM knowledge_points ORDER BY subject ASC').all()
  const chapters = db.prepare('SELECT subject, chapter FROM knowledge_points GROUP BY subject, chapter ORDER BY subject, chapter').all()
  res.json({ subjects: rows.map(r => r.subject), chapters })
})

router.get('/:id', (req, res) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM knowledge_points WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not found' })
  res.json(row)
})

router.post('/', (req, res) => {
  const { subject, chapter, title, content, key_formulas, tips, visual_desc, video_url, sort_order } = req.body
  if (!subject || !title) return res.status(400).json({ error: 'subject, title are required' })
  const db = getDb()
  const result = db.prepare(
    "INSERT INTO knowledge_points (subject, chapter, title, content, key_formulas, tips, visual_desc, video_url, sort_order, origin, user_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', 1)"
  ).run(subject, chapter || '', title, content || '', key_formulas || '', tips || '', visual_desc || '', video_url || '', sort_order || 0)
  const row = db.prepare('SELECT * FROM knowledge_points WHERE id = ?').get(result.lastInsertRowid)
  res.json(row)
})

router.put('/:id', (req, res) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM knowledge_points WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not found' })
  const { subject, chapter, title, content, key_formulas, tips, visual_desc, video_url, sort_order } = req.body
  db.prepare(
    'UPDATE knowledge_points SET subject = ?, chapter = ?, title = ?, content = ?, key_formulas = ?, tips = ?, visual_desc = ?, video_url = ?, sort_order = ?, user_modified = 1 WHERE id = ?'
  ).run(subject || row.subject, chapter ?? row.chapter, title || row.title, content ?? row.content, key_formulas ?? row.key_formulas, tips ?? row.tips, visual_desc ?? row.visual_desc, video_url ?? row.video_url, sort_order ?? row.sort_order, req.params.id)
  const updated = db.prepare('SELECT * FROM knowledge_points WHERE id = ?').get(req.params.id)
  res.json(updated)
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM knowledge_points WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
