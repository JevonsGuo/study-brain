import { Router } from 'express'
import { getDb } from '../db/index.js'
import { dumpKnowledgePoints, bumpDatabaseVersion } from '../utils/contentSync.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const { subject, grade, book, chapter } = req.query
  let sql = `
    SELECT k.*, IFNULL(n.note, '') AS user_note
    FROM knowledge_points k
    LEFT JOIN knowledge_notes n ON k.id = n.knowledge_point_id
  `
  const conditions = []
  const params = []
  if (subject) {
    conditions.push('k.subject = ?')
    params.push(subject)
  }
  if (grade) {
    conditions.push('k.grade = ?')
    params.push(grade)
  }
  if (book) {
    conditions.push('k.book = ?')
    params.push(book)
  }
  if (chapter) {
    conditions.push('k.chapter = ?')
    params.push(chapter)
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }
  sql += ' ORDER BY k.sort_order ASC, k.id ASC'
  const rows = db.prepare(sql).all(...params)
  res.json(rows)
})

router.get('/subjects', (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT DISTINCT subject FROM knowledge_points ORDER BY subject ASC').all()
  const books = db.prepare("SELECT subject, grade, book, COUNT(*) as count FROM knowledge_points WHERE book != '' GROUP BY subject, grade, book ORDER BY subject, grade, book").all()
  const chapters = db.prepare('SELECT subject, grade, book, chapter, COUNT(*) as count FROM knowledge_points GROUP BY subject, grade, book, chapter ORDER BY subject, grade, book, chapter').all()
  res.json({ subjects: rows.map(r => r.subject), books, chapters })
})

router.get('/:id', (req, res) => {
  const db = getDb()
  const row = db.prepare(`
    SELECT k.*, IFNULL(n.note, '') AS user_note
    FROM knowledge_points k
    LEFT JOIN knowledge_notes n ON k.id = n.knowledge_point_id
    WHERE k.id = ?
  `).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not found' })
  res.json(row)
})

// 学生个人随堂笔记与避坑备忘 (纯用户数据，绝不影响官方考点)
router.put('/:id/note', (req, res) => {
  const { note } = req.body
  const db = getDb()
  const kpId = Number(req.params.id)
  const row = db.prepare('SELECT id FROM knowledge_points WHERE id = ?').get(kpId)
  if (!row) return res.status(404).json({ error: 'knowledge point not found' })

  db.prepare(`
    INSERT INTO knowledge_notes (knowledge_point_id, note, updated_at)
    VALUES (?, ?, datetime('now', 'localtime'))
    ON CONFLICT(knowledge_point_id) DO UPDATE SET
      note = excluded.note,
      updated_at = excluded.updated_at
  `).run(kpId, note || '')

  res.json({ ok: true, knowledge_point_id: kpId, user_note: note || '' })
})

// 管理员维护模式：添加考点 (开发模式下自动写盘至 content/knowledge.json)
router.post('/', (req, res) => {
  const { subject, grade, book, chapter, title, content, key_formulas, tips, visual_desc, video_url, sort_order } = req.body
  if (!subject || !title) return res.status(400).json({ error: 'subject, title are required' })
  const db = getDb()
  const result = db.prepare(
    "INSERT INTO knowledge_points (subject, grade, book, chapter, title, content, key_formulas, tips, visual_desc, video_url, sort_order, origin, user_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed', 0)"
  ).run(subject, grade || '', book || '', chapter || '', title, content || '', key_formulas || '', tips || '', visual_desc || '', video_url || '', sort_order || 0)
  const row = db.prepare('SELECT * FROM knowledge_points WHERE id = ?').get(result.lastInsertRowid)

  if (process.env.NODE_ENV !== 'production' || req.headers['x-maintenance-mode'] === 'true') {
    dumpKnowledgePoints(db)
    bumpDatabaseVersion(`新增考点：${title}`)
  }

  res.json(row)
})

// 管理员维护模式：编辑考点 (开发模式下自动写盘至 content/knowledge.json)
router.put('/:id', (req, res) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM knowledge_points WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not found' })
  const { subject, grade, book, chapter, title, content, key_formulas, tips, visual_desc, video_url, sort_order } = req.body
  db.prepare(
    'UPDATE knowledge_points SET subject = ?, grade = ?, book = ?, chapter = ?, title = ?, content = ?, key_formulas = ?, tips = ?, visual_desc = ?, video_url = ?, sort_order = ? WHERE id = ?'
  ).run(
    subject || row.subject,
    grade ?? row.grade,
    book ?? row.book,
    chapter ?? row.chapter,
    title || row.title,
    content ?? row.content,
    key_formulas ?? row.key_formulas,
    tips ?? row.tips,
    visual_desc ?? row.visual_desc,
    video_url ?? row.video_url,
    sort_order ?? row.sort_order,
    req.params.id
  )
  const updated = db.prepare('SELECT * FROM knowledge_points WHERE id = ?').get(req.params.id)

  if (process.env.NODE_ENV !== 'production' || req.headers['x-maintenance-mode'] === 'true') {
    dumpKnowledgePoints(db)
    bumpDatabaseVersion(`更新考点：${title || row.title}`)
  }

  res.json(updated)
})

// 管理员维护模式：删除考点
router.delete('/:id', (req, res) => {
  const db = getDb()
  const row = db.prepare('SELECT title FROM knowledge_points WHERE id = ?').get(req.params.id)
  db.prepare('DELETE FROM knowledge_points WHERE id = ?').run(req.params.id)
  db.prepare('DELETE FROM knowledge_notes WHERE knowledge_point_id = ?').run(req.params.id)

  if (process.env.NODE_ENV !== 'production' || req.headers['x-maintenance-mode'] === 'true') {
    dumpKnowledgePoints(db)
    bumpDatabaseVersion(`删除考点：${row?.title || req.params.id}`)
  }

  res.json({ ok: true })
})

export default router
