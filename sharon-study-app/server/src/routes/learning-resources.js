import { Router } from 'express'
import { getDb } from '../db/index.js'
import { dumpLearningResources, bumpDatabaseVersion } from '../utils/contentSync.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const { subject } = req.query
  let rows
  if (subject) {
    rows = db.prepare('SELECT * FROM learning_resources WHERE subject = ? ORDER BY category, sort_order, id').all(subject)
  } else {
    rows = db.prepare('SELECT * FROM learning_resources ORDER BY subject, category, sort_order, id').all()
  }
  res.json(rows)
})

router.post('/', (req, res) => {
  const { subject, category, name, desc, url, sort_order } = req.body
  if (!subject || !name || !url) return res.status(400).json({ error: 'subject, name, url are required' })
  const db = getDb()
  const cat = category || 'video'
  const order = sort_order || 0
  const result = db.prepare("INSERT INTO learning_resources (subject, category, name, desc, url, sort_order, origin, user_modified) VALUES (?, ?, ?, ?, ?, ?, 'seed', 0)").run(subject, cat, name, desc || '', url, order)
  const row = db.prepare('SELECT * FROM learning_resources WHERE id = ?').get(result.lastInsertRowid)

  if (process.env.NODE_ENV !== 'production' || req.headers['x-maintenance-mode'] === 'true') {
    dumpLearningResources(db)
    bumpDatabaseVersion(`新增学科资源：${name}`)
  }

  res.json(row)
})

router.put('/:id', (req, res) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM learning_resources WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not found' })
  const { subject, category, name, desc, url, sort_order } = req.body
  db.prepare('UPDATE learning_resources SET subject = ?, category = ?, name = ?, desc = ?, url = ?, sort_order = ? WHERE id = ?').run(
    subject || row.subject,
    category || row.category,
    name || row.name,
    desc !== undefined ? desc : row.desc,
    url || row.url,
    sort_order !== undefined ? sort_order : row.sort_order,
    req.params.id
  )
  const updated = db.prepare('SELECT * FROM learning_resources WHERE id = ?').get(req.params.id)

  if (process.env.NODE_ENV !== 'production' || req.headers['x-maintenance-mode'] === 'true') {
    dumpLearningResources(db)
    bumpDatabaseVersion(`更新学科资源：${name || row.name}`)
  }

  res.json(updated)
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  const row = db.prepare('SELECT name FROM learning_resources WHERE id = ?').get(req.params.id)
  db.prepare('DELETE FROM learning_resources WHERE id = ?').run(req.params.id)

  if (process.env.NODE_ENV !== 'production' || req.headers['x-maintenance-mode'] === 'true') {
    dumpLearningResources(db)
    bumpDatabaseVersion(`删除学科资源：${row?.name || req.params.id}`)
  }

  res.json({ ok: true })
})

export default router

